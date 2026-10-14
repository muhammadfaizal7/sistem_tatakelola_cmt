import "dotenv/config";
import cors from "cors";
import crypto from "node:crypto";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { fileURLToPath } from "node:url";
import { pool } from "./db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.join(__dirname, "uploads");
const port = Number(process.env.PORT || 8787);
const sessions = new Map();

fs.mkdirSync(uploadDirectory, { recursive: true });

const verifyPassword = (password, storedJson) => {
  const stored =
    typeof storedJson === "string" ? JSON.parse(storedJson) : storedJson;
  const derived = crypto.scryptSync(password, stored.salt, 64);
  return crypto.timingSafeEqual(derived, Buffer.from(stored.hash, "hex"));
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  return JSON.stringify({
    salt,
    hash: crypto.scryptSync(password, salt, 64).toString("hex"),
  });
};

const publicUser = ({ password_hash: _passwordHash, ...user }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  unit: user.unit,
});
const isWorkspaceRole = (role) =>
  role === "admin" || role === "manager" || role === "director";
const canManageDocuments = (role) => role === "admin" || role === "manager";
const isAdmin = (role) => role === "admin";
const canVerifyFindings = (role) =>
  role === "admin" || role === "manager" || role === "director";

async function appendAudit({
  actorId = null,
  action,
  entityType,
  entityId = null,
  metadata = {},
}) {
  await pool.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actorId, action, entityType, entityId, JSON.stringify(metadata)],
  );
}

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = token && sessions.get(token);
    if (!userId) return res.status(401).json({ message: "Sesi tidak valid." });
    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND active = TRUE",
      [userId],
    );
    if (!result.rows[0])
      return res.status(401).json({ message: "Sesi tidak valid." });
    req.user = publicUser(result.rows[0]);
    next();
  } catch (error) {
    next(error);
  }
};

const requireWorkspaceRole = (req, res, next) => {
  if (!isWorkspaceRole(req.user.role))
    return res
      .status(403)
      .json({ message: "Role Anda tidak memiliki akses ke aksi ini." });
  next();
};

const requireDocumentManagerRole = (req, res, next) => {
  if (!canManageDocuments(req.user.role)) {
    return res.status(403).json({
      message: "Hanya Admin dan Manager yang dapat mengelola dokumen.",
    });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!isAdmin(req.user.role)) {
    return res.status(403).json({
      message: "Hanya Administrator Sistem yang dapat mengelola akun.",
    });
  }
  next();
};

const requireFindingVerifier = (req, res, next) => {
  if (!canVerifyFindings(req.user.role)) {
    return res.status(403).json({
      message:
        "Hanya Admin, Manager, atau Direktur yang dapat memverifikasi tindakan.",
    });
  }
  next();
};

const correctiveActionSelect = `
  SELECT ca.*, u.name AS assignee, verifier.name AS verified_by_name
  FROM corrective_actions ca
  LEFT JOIN users u ON u.id = ca.assignee_id
  LEFT JOIN users verifier ON verifier.id = ca.verified_by`;

const upload = multer({
  dest: uploadDirectory,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/png",
      "image/jpeg",
    ];
    callback(null, allowed.includes(file.mimetype));
  },
});

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      ok: true,
      service: "governance-hub-api",
      database: "postgresql",
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND active = TRUE",
      [String(email ?? "")],
    );
    const user = result.rows[0];
    if (!user || !verifyPassword(String(password ?? ""), user.password_hash)) {
      await appendAudit({
        actorId: user?.id ?? null,
        action: "login.failed",
        entityType: "session",
        metadata: {
          email: String(email ?? "")
            .trim()
            .toLowerCase(),
        },
      });
      return res
        .status(401)
        .json({ message: "Email atau kata sandi belum sesuai." });
    }
    const token = crypto.randomUUID();
    sessions.set(token, user.id);
    await appendAudit({
      actorId: user.id,
      action: "login",
      entityType: "session",
    });
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", authenticate, async (req, res, next) => {
  try {
    const token = req.headers.authorization.replace("Bearer ", "");
    sessions.delete(token);
    await appendAudit({
      actorId: req.user.id,
      action: "logout",
      entityType: "session",
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get(
  "/api/users",
  authenticate,
  requireWorkspaceRole,
  async (req, res, next) => {
    try {
      const role = req.query.role === "manager" ? "manager" : null;
      if (!role)
        return res.status(422).json({ message: "Role user wajib ditentukan." });
      const result = await pool.query(
        "SELECT id, name, unit FROM users WHERE role = $1 AND active = TRUE ORDER BY name",
        [role],
      );
      res.json({ users: result.rows });
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  "/api/evaluations",
  authenticate,
  requireWorkspaceRole,
  async (_req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT e.id, e.period, e.result, e.notes, e.state, e.created_at,
            i.document_id, d.title AS document_title,
            i.title AS control, i.process, i.owner_unit AS owner
         FROM evaluations e JOIN evaluation_items i ON i.id = e.item_id
         LEFT JOIN documents d ON d.id = i.document_id
       ORDER BY e.created_at DESC`,
      );
      res.json({ evaluations: result.rows });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/evaluations",
  authenticate,
  requireWorkspaceRole,
  async (req, res, next) => {
    const {
      control,
      process,
      owner,
      period,
      result = "Belum Dinilai",
      notes = "",
      documentId,
    } = req.body ?? {};
    if (!documentId || !control?.trim() || !owner?.trim() || !period?.trim())
      return res.status(422).json({
        message: "Dokumen, kontrol, unit pemilik, dan periode wajib diisi.",
      });
    if (
      ![
        "Belum Dinilai",
        "Sesuai",
        "Sebagian Sesuai",
        "Tidak Sesuai",
        "Tidak Berlaku",
      ].includes(result)
    )
      return res.status(422).json({ message: "Hasil evaluasi tidak valid." });
    try {
      const document = await pool.query(
        "SELECT id FROM documents WHERE id = $1",
        [documentId],
      );
      if (!document.rows[0])
        return res
          .status(404)
          .json({ message: "Dokumen evaluasi tidak ditemukan." });
      const item = await pool.query(
        `INSERT INTO evaluation_items (document_id, title, process, owner_unit) VALUES ($1, $2, $3, $4) RETURNING id`,
        [documentId, control.trim(), process?.trim() || null, owner.trim()],
      );
      const evaluation = await pool.query(
        `INSERT INTO evaluations (item_id, period, result, notes, evaluator_id, state)
       VALUES ($1, $2, $3, $4, $5, 'Final') RETURNING *`,
        [item.rows[0].id, period.trim(), result, notes, req.user.id],
      );
      await appendAudit({
        actorId: req.user.id,
        action: "evaluation.created",
        entityType: "evaluation",
        entityId: evaluation.rows[0].id,
        metadata: { control, period, result },
      });
      res.status(201).json({
        evaluation: { ...evaluation.rows[0], control, process, owner },
      });
    } catch (error) {
      next(error);
    }
  },
);

app.patch(
  "/api/evaluations/:id",
  authenticate,
  requireWorkspaceRole,
  async (req, res, next) => {
    const {
      control,
      process,
      owner,
      period,
      result,
      notes = "",
    } = req.body ?? {};
    if (!control?.trim() || !owner?.trim() || !period?.trim())
      return res
        .status(422)
        .json({ message: "Kontrol, unit pemilik, dan periode wajib diisi." });
    if (
      result &&
      ![
        "Belum Dinilai",
        "Sesuai",
        "Sebagian Sesuai",
        "Tidak Sesuai",
        "Tidak Berlaku",
      ].includes(result)
    )
      return res.status(422).json({ message: "Hasil evaluasi tidak valid." });
    try {
      const resultRow = await pool.query(
        `UPDATE evaluation_items i SET title = $1, process = $2, owner_unit = $3
         FROM evaluations e WHERE e.item_id = i.id AND e.id = $4
         RETURNING e.id, e.period, e.result, e.notes, e.state, e.created_at, i.document_id,
           (SELECT title FROM documents WHERE id = i.document_id) AS document_title,
           i.title AS control, i.process, i.owner_unit AS owner`,
        [control.trim(), process?.trim() || null, owner.trim(), req.params.id],
      );
      if (!resultRow.rows[0])
        return res.status(404).json({ message: "Evaluasi tidak ditemukan." });
      const updated = await pool.query(
        `UPDATE evaluations SET period = $1, result = $2, notes = $3 WHERE id = $4
         RETURNING id, period, result, notes, state, created_at`,
        [period.trim(), result ?? "Belum Dinilai", notes, req.params.id],
      );
      const evaluation = { ...resultRow.rows[0], ...updated.rows[0] };
      await appendAudit({
        actorId: req.user.id,
        action: "evaluation.updated",
        entityType: "evaluation",
        entityId: req.params.id,
        metadata: { control, period, result },
      });
      res.json({ evaluation });
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  "/api/evaluations/:id",
  authenticate,
  requireWorkspaceRole,
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const item = await client.query(
        `SELECT e.id, e.item_id FROM evaluations e WHERE e.id = $1 FOR UPDATE`,
        [req.params.id],
      );
      if (!item.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Evaluasi tidak ditemukan." });
      }
      await client.query(
        "DELETE FROM corrective_actions WHERE finding_id IN (SELECT id FROM findings WHERE evaluation_id = $1)",
        [req.params.id],
      );
      await client.query("DELETE FROM findings WHERE evaluation_id = $1", [
        req.params.id,
      ]);
      await client.query("DELETE FROM evaluations WHERE id = $1", [
        req.params.id,
      ]);
      await client.query("DELETE FROM evaluation_items WHERE id = $1", [
        item.rows[0].item_id,
      ]);
      await client.query("COMMIT");
      await appendAudit({
        actorId: req.user.id,
        action: "evaluation.deleted",
        entityType: "evaluation",
        entityId: req.params.id,
      });
      res.json({ ok: true, id: req.params.id });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      next(error);
    } finally {
      client.release();
    }
  },
);

app.get(
  "/api/findings",
  authenticate,
  requireWorkspaceRole,
  async (_req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT f.*, u.name AS assignee FROM findings f LEFT JOIN users u ON u.id = f.assignee_id ORDER BY f.created_at DESC`,
      );
      res.json({ findings: result.rows });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/findings",
  authenticate,
  requireWorkspaceRole,
  async (req, res, next) => {
    const {
      title,
      description = "",
      owner,
      risk = "Sedang",
      dueDate = null,
      assigneeId = null,
    } = req.body ?? {};
    if (!title?.trim() || !owner?.trim())
      return res
        .status(422)
        .json({ message: "Judul temuan dan unit pemilik wajib diisi." });
    if (!["Rendah", "Sedang", "Tinggi"].includes(risk))
      return res.status(422).json({ message: "Tingkat risiko tidak valid." });
    try {
      const result = await pool.query(
        `INSERT INTO findings (title, description, owner_unit, risk_level, due_date, assignee_id, evaluation_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          title.trim(),
          description,
          owner.trim(),
          risk,
          dueDate || null,
          assigneeId || null,
          req.body.evaluationId || null,
        ],
      );
      await appendAudit({
        actorId: req.user.id,
        action: "finding.created",
        entityType: "finding",
        entityId: result.rows[0].id,
        metadata: { title, risk, owner },
      });
      res.status(201).json({ finding: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },
);

app.patch(
  "/api/findings/:id",
  authenticate,
  requireWorkspaceRole,
  async (req, res, next) => {
    const {
      title,
      description = "",
      owner,
      risk = "Sedang",
      dueDate = null,
    } = req.body ?? {};
    if (!title?.trim() || !owner?.trim())
      return res
        .status(422)
        .json({ message: "Judul temuan dan unit pemilik wajib diisi." });
    if (!["Rendah", "Sedang", "Tinggi"].includes(risk))
      return res.status(422).json({ message: "Tingkat risiko tidak valid." });
    try {
      const result = await pool.query(
        `UPDATE findings SET title = $1, description = $2, owner_unit = $3, risk_level = $4, due_date = $5
         WHERE id = $6 RETURNING *`,
        [
          title.trim(),
          description,
          owner.trim(),
          risk,
          dueDate || null,
          req.params.id,
        ],
      );
      if (!result.rows[0])
        return res.status(404).json({ message: "Temuan tidak ditemukan." });
      await appendAudit({
        actorId: req.user.id,
        action: "finding.updated",
        entityType: "finding",
        entityId: req.params.id,
        metadata: { title, risk, owner },
      });
      const finding = await pool.query(
        `SELECT f.*, u.name AS assignee FROM findings f LEFT JOIN users u ON u.id = f.assignee_id WHERE f.id = $1`,
        [req.params.id],
      );
      res.json({ finding: finding.rows[0] });
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  "/api/findings/:id",
  authenticate,
  requireWorkspaceRole,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        "DELETE FROM findings WHERE id = $1 RETURNING id",
        [req.params.id],
      );
      if (!result.rows[0])
        return res.status(404).json({ message: "Temuan tidak ditemukan." });
      await appendAudit({
        actorId: req.user.id,
        action: "finding.deleted",
        entityType: "finding",
        entityId: req.params.id,
      });
      res.json({ ok: true, id: req.params.id });
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  "/api/findings/:id/actions",
  authenticate,
  requireWorkspaceRole,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `${correctiveActionSelect} WHERE ca.finding_id = $1 ORDER BY ca.due_date NULLS LAST, ca.id`,
        [req.params.id],
      );
      res.json({ actions: result.rows });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/findings/:id/actions",
  authenticate,
  requireWorkspaceRole,
  async (req, res, next) => {
    const { description, dueDate = null, assigneeId = null } = req.body ?? {};
    if (!description?.trim())
      return res
        .status(422)
        .json({ message: "Deskripsi tindakan wajib diisi." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const findingResult = await client.query(
        "SELECT id, assignee_id FROM findings WHERE id = $1 FOR UPDATE",
        [req.params.id],
      );
      const finding = findingResult.rows[0];
      if (!finding) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Temuan tidak ditemukan." });
      }
      const action = await client.query(
        `INSERT INTO corrective_actions (finding_id, description, assignee_id, due_date, state)
         VALUES ($1, $2, $3, $4, 'Terbuka') RETURNING id`,
        [
          req.params.id,
          description.trim(),
          assigneeId || finding.assignee_id,
          dueDate || null,
        ],
      );
      await client.query(
        "UPDATE findings SET state = 'Dalam Pengerjaan' WHERE id = $1 AND state <> 'Terverifikasi'",
        [req.params.id],
      );
      await client.query("COMMIT");
      await appendAudit({
        actorId: req.user.id,
        action: "corrective_action.created",
        entityType: "corrective_action",
        entityId: action.rows[0].id,
        metadata: { findingId: req.params.id },
      });
      const created = await pool.query(
        `${correctiveActionSelect} WHERE ca.id = $1`,
        [action.rows[0].id],
      );
      res.status(201).json({ action: created.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      next(error);
    } finally {
      client.release();
    }
  },
);

app.post(
  "/api/actions/:id/submit-verification",
  authenticate,
  requireWorkspaceRole,
  async (req, res, next) => {
    try {
      const actionResult = await pool.query(
        `SELECT ca.*, f.id AS finding_id FROM corrective_actions ca
         JOIN findings f ON f.id = ca.finding_id WHERE ca.id = $1`,
        [req.params.id],
      );
      const action = actionResult.rows[0];
      if (!action)
        return res.status(404).json({ message: "Tindakan tidak ditemukan." });
      if (
        action.assignee_id &&
        action.assignee_id !== req.user.id &&
        !canVerifyFindings(req.user.role)
      )
        return res.status(403).json({
          message: "Hanya PIC tindakan yang dapat mengajukan verifikasi.",
        });
      if (
        !["Terbuka", "Dalam Pengerjaan", "Perlu Perbaikan"].includes(
          action.state,
        )
      )
        return res
          .status(409)
          .json({ message: "Tindakan belum dapat diajukan untuk verifikasi." });
      const updated = await pool.query(
        "UPDATE corrective_actions SET state = 'Diajukan Verifikasi', submitted_at = NOW() WHERE id = $1 RETURNING id",
        [req.params.id],
      );
      await pool.query(
        "UPDATE findings SET state = 'Diajukan Verifikasi' WHERE id = $1",
        [action.finding_id],
      );
      await appendAudit({
        actorId: req.user.id,
        action: "corrective_action.submitted",
        entityType: "corrective_action",
        entityId: req.params.id,
        metadata: { findingId: action.finding_id },
      });
      const result = await pool.query(
        `${correctiveActionSelect} WHERE ca.id = $1`,
        [updated.rows[0].id],
      );
      res.json({ action: result.rows[0] });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/actions/:id/verify",
  authenticate,
  requireFindingVerifier,
  async (req, res, next) => {
    const { decision, note = "" } = req.body ?? {};
    if (!["Terverifikasi", "Perlu Perbaikan"].includes(decision))
      return res
        .status(422)
        .json({ message: "Keputusan verifikasi tidak valid." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const actionResult = await client.query(
        "SELECT * FROM corrective_actions WHERE id = $1 FOR UPDATE",
        [req.params.id],
      );
      const action = actionResult.rows[0];
      if (!action) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Tindakan tidak ditemukan." });
      }
      if (action.state !== "Diajukan Verifikasi") {
        await client.query("ROLLBACK");
        return res
          .status(409)
          .json({ message: "Tindakan belum diajukan untuk verifikasi." });
      }
      await client.query(
        `UPDATE corrective_actions
         SET state = $1, verified_by = $2, verified_at = NOW(), verification_note = $3
         WHERE id = $4`,
        [decision, req.user.id, note.trim(), req.params.id],
      );
      const findingState =
        decision === "Perlu Perbaikan"
          ? "Perlu Perbaikan"
          : (
                await client.query(
                  "SELECT COUNT(*)::int AS pending FROM corrective_actions WHERE finding_id = $1 AND id <> $2 AND state <> 'Terverifikasi'",
                  [action.finding_id, action.id],
                )
              ).rows[0].pending === 0
            ? "Terverifikasi"
            : "Dalam Pengerjaan";
      await client.query("UPDATE findings SET state = $1 WHERE id = $2", [
        findingState,
        action.finding_id,
      ]);
      await client.query("COMMIT");
      await appendAudit({
        actorId: req.user.id,
        action: `corrective_action.${decision === "Terverifikasi" ? "verified" : "rejected"}`,
        entityType: "corrective_action",
        entityId: req.params.id,
        metadata: { findingId: action.finding_id, note },
      });
      const result = await pool.query(
        `${correctiveActionSelect} WHERE ca.id = $1`,
        [req.params.id],
      );
      res.json({ action: result.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      next(error);
    } finally {
      client.release();
    }
  },
);

app.get(
  "/api/admin/users",
  authenticate,
  requireAdmin,
  async (_req, res, next) => {
    try {
      const result = await pool.query(
        "SELECT id, name, email, role, unit, active, created_at FROM users WHERE active = TRUE ORDER BY name",
      );
      res.json({ users: result.rows });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/admin/users",
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    const { name, email, password, role, unit } = req.body ?? {};
    if (
      !name?.trim() ||
      !email?.trim() ||
      !password ||
      !role ||
      !unit?.trim()
    ) {
      return res.status(422).json({
        message: "Nama, email, password, role, dan unit wajib diisi.",
      });
    }
    if (!["admin", "manager", "director", "karyawan"].includes(role)) {
      return res.status(422).json({ message: "Role tidak valid." });
    }
    if (String(password).length < 8) {
      return res.status(422).json({ message: "Password minimal 8 karakter." });
    }
    try {
      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, unit)
       VALUES ($1, LOWER($2), $3, $4, $5)
       RETURNING id, name, email, role, unit, active, created_at`,
        [
          name.trim(),
          email.trim(),
          hashPassword(String(password)),
          role,
          unit.trim(),
        ],
      );
      const user = result.rows[0];
      await appendAudit({
        actorId: req.user.id,
        action: "user.created",
        entityType: "user",
        entityId: user.id,
        metadata: { email: user.email, role: user.role, unit: user.unit },
      });
      res.status(201).json({ user });
    } catch (error) {
      if (error.code === "23505")
        return res.status(409).json({ message: "Email sudah terdaftar." });
      next(error);
    }
  },
);

app.patch(
  "/api/admin/users/:id",
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    const { name, role, unit, active, password } = req.body ?? {};
    if (req.params.id === req.user.id && active === false)
      return res.status(422).json({
        message: "Akun Admin yang sedang digunakan tidak dapat dinonaktifkan.",
      });
    if (role && !["admin", "manager", "director", "karyawan"].includes(role))
      return res.status(422).json({ message: "Role tidak valid." });
    if (password && String(password).length < 8)
      return res.status(422).json({ message: "Password minimal 8 karakter." });
    try {
      const result = await pool.query(
        `UPDATE users SET
         name = COALESCE($1, name), role = COALESCE($2, role), unit = COALESCE($3, unit),
         active = COALESCE($4, active), password_hash = COALESCE($5, password_hash)
       WHERE id = $6
       RETURNING id, name, email, role, unit, active, created_at`,
        [
          name?.trim() || null,
          role || null,
          unit?.trim() || null,
          typeof active === "boolean" ? active : null,
          password ? hashPassword(String(password)) : null,
          req.params.id,
        ],
      );
      if (!result.rows[0])
        return res.status(404).json({ message: "User tidak ditemukan." });
      const user = result.rows[0];
      await appendAudit({
        actorId: req.user.id,
        action: "user.updated",
        entityType: "user",
        entityId: user.id,
        metadata: { role: user.role, unit: user.unit, active: user.active },
      });
      res.json({ user });
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  "/api/admin/users/:id",
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    if (req.params.id === req.user.id)
      return res.status(422).json({
        message: "Akun Admin yang sedang digunakan tidak dapat dihapus.",
      });
    try {
      const result = await pool.query(
        "UPDATE users SET active = FALSE WHERE id = $1 RETURNING id, name, email, role, unit, active, created_at",
        [req.params.id],
      );
      if (!result.rows[0])
        return res.status(404).json({ message: "User tidak ditemukan." });
      const user = result.rows[0];
      await appendAudit({
        actorId: req.user.id,
        action: "user.deleted",
        entityType: "user",
        entityId: user.id,
        metadata: { email: user.email },
      });
      res.json({ user });
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  "/api/documents/:id",
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const documentResult = await client.query(
        "SELECT * FROM documents WHERE id = $1 FOR UPDATE",
        [req.params.id],
      );
      const document = documentResult.rows[0];
      if (!document) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Dokumen tidak ditemukan." });
      }

      await client.query(
        `DELETE FROM corrective_actions
         WHERE finding_id IN (
           SELECT f.id FROM findings f
           JOIN evaluations e ON e.id = f.evaluation_id
           JOIN evaluation_items i ON i.id = e.item_id
           WHERE i.document_id = $1
         )`,
        [document.id],
      );
      await client.query(
        `DELETE FROM findings
         WHERE evaluation_id IN (
           SELECT e.id FROM evaluations e
           JOIN evaluation_items i ON i.id = e.item_id
           WHERE i.document_id = $1
         )`,
        [document.id],
      );
      await client.query(
        `DELETE FROM evaluations
         WHERE item_id IN (SELECT id FROM evaluation_items WHERE document_id = $1)`,
        [document.id],
      );
      await client.query(
        "DELETE FROM evaluation_items WHERE document_id = $1",
        [document.id],
      );
      await client.query("DELETE FROM approvals WHERE document_id = $1", [
        document.id,
      ]);
      await client.query("DELETE FROM documents WHERE id = $1", [document.id]);
      await client.query("COMMIT");

      if (document.file_path)
        fs.rmSync(path.join(uploadDirectory, document.file_path), {
          force: true,
        });
      await appendAudit({
        actorId: req.user.id,
        action: "document.deleted",
        entityType: "document",
        entityId: document.id,
        metadata: {
          code: document.code,
          title: document.title,
          status: document.status,
        },
      });
      res.json({ ok: true, id: document.id });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      next(error);
    } finally {
      client.release();
    }
  },
);

app.patch(
  "/api/admin/documents/:id/manager-approver",
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const manager = await pool.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'manager' AND active = TRUE",
        [req.body?.managerApproverId],
      );
      if (!manager.rows[0])
        return res
          .status(422)
          .json({ message: "Manager approver tidak valid." });
      const result = await pool.query(
        `UPDATE document_approval_steps SET approver_user_id = $1
       WHERE document_id = $2 AND stage_number = 2 AND decision = 'Menunggu'
       RETURNING document_id`,
        [manager.rows[0].id, req.params.id],
      );
      if (!result.rows[0])
        return res.status(409).json({
          message:
            "Approver hanya dapat diubah sebelum tahap Manager diputuskan.",
        });
      await appendAudit({
        actorId: req.user.id,
        action: "approval.manager_assigned",
        entityType: "document",
        entityId: req.params.id,
        metadata: { managerApproverId: manager.rows[0].id },
      });
      res.json({ ok: true, managerApproverId: manager.rows[0].id });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/documents", authenticate, async (req, res, next) => {
  try {
    const query = isWorkspaceRole(req.user.role)
      ? `SELECT d.*, s.approver_user_id AS manager_approver_id
        FROM documents d LEFT JOIN document_approval_steps s ON s.document_id = d.id AND s.stage_number = 2
        ORDER BY d.created_at DESC`
      : `SELECT d.*, s.approver_user_id AS manager_approver_id
        FROM documents d LEFT JOIN document_approval_steps s ON s.document_id = d.id AND s.stage_number = 2
        WHERE d.status = 'Berlaku' ORDER BY d.created_at DESC`;
    const result = await pool.query(query);
    res.json({ documents: result.rows.map(toDocument) });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/documents",
  authenticate,
  requireDocumentManagerRole,
  upload.single("file"),
  async (req, res, next) => {
    if (!req.file)
      return res
        .status(422)
        .json({ message: "File wajib diunggah dengan format yang didukung." });
    const required = ["code", "title", "type", "unit", "version"];
    const missing = required.find((field) => !req.body[field]?.trim());
    if (missing) {
      fs.rmSync(req.file.path, { force: true });
      return res.status(422).json({ message: `Field ${missing} wajib diisi.` });
    }
    try {
      const managerApprover = await pool.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'manager' AND active = TRUE",
        [req.body.managerApproverId],
      );
      if (!managerApprover.rows[0]) {
        fs.rmSync(req.file.path, { force: true });
        return res.status(422).json({
          message: "Manager approver wajib dipilih dari akun Manager aktif.",
        });
      }
      const result = await pool.query(
        `INSERT INTO documents (code, title, type, unit, version, status, lifecycle_status, description, change_summary, effective_date, review_date, file_name, file_path, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, 'Draft', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
        [
          req.body.code,
          req.body.title,
          req.body.type,
          req.body.unit,
          req.body.version,
          ["Aktif", "Direvisi", "Dicabut"].includes(req.body.lifecycleStatus)
            ? req.body.lifecycleStatus
            : "Aktif",
          req.body.description?.trim() || null,
          req.body.changeSummary?.trim() || null,
          req.body.effectiveDate || null,
          req.body.reviewDate || null,
          req.file.originalname,
          req.file.filename,
          req.file.mimetype,
          req.file.size,
          req.user.id,
        ],
      );
      const document = result.rows[0];
      await pool.query(
        `INSERT INTO document_approval_steps (document_id, stage_number, stage_name, required_role, required_count, approver_user_id)
         VALUES
           ($1, 1, 'GCG & Internal Audit', 'admin', 1, NULL),
           ($1, 2, 'Pemeriksaan Manager Divisi', 'manager', 1, $2),
           ($1, 3, 'Pengesahan Direktur', 'director', 1, NULL)
         ON CONFLICT (document_id, stage_number) DO NOTHING`,
        [document.id, managerApprover.rows[0].id],
      );
      await appendAudit({
        actorId: req.user.id,
        action: "document.uploaded",
        entityType: "document",
        entityId: document.id,
        metadata: {
          code: document.code,
          version: document.version,
          fileName: document.file_name,
        },
      });
      res.status(201).json({ document: toDocument(document) });
    } catch (error) {
      fs.rmSync(req.file.path, { force: true });
      if (error.code === "23505")
        return res
          .status(409)
          .json({ message: "Kode dan versi dokumen sudah terdaftar." });
      next(error);
    }
  },
);

app.patch(
  "/api/documents/:id/metadata",
  authenticate,
  requireDocumentManagerRole,
  async (req, res, next) => {
    const {
      description,
      changeSummary,
      lifecycleStatus,
      effectiveDate,
      reviewDate,
    } = req.body ?? {};
    if (
      lifecycleStatus &&
      !["Aktif", "Direvisi", "Dicabut"].includes(lifecycleStatus)
    )
      return res.status(422).json({ message: "Status dokumen tidak valid." });
    try {
      const result = await pool.query(
        `UPDATE documents SET
          description = COALESCE($1, description),
          change_summary = COALESCE($2, change_summary),
          lifecycle_status = COALESCE($3, lifecycle_status),
          effective_date = COALESCE($4, effective_date),
          review_date = COALESCE($5, review_date)
         WHERE id = $6 RETURNING *`,
        [
          description?.trim() || null,
          changeSummary?.trim() || null,
          lifecycleStatus || null,
          effectiveDate || null,
          reviewDate || null,
          req.params.id,
        ],
      );
      if (!result.rows[0])
        return res.status(404).json({ message: "Dokumen tidak ditemukan." });
      await appendAudit({
        actorId: req.user.id,
        action: "document.metadata_updated",
        entityType: "document",
        entityId: req.params.id,
        metadata: { lifecycleStatus: result.rows[0].lifecycle_status },
      });
      res.json({ document: toDocument(result.rows[0]) });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/documents/:id/file", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM documents WHERE id = $1", [
      req.params.id,
    ]);
    const document = result.rows[0];
    if (
      !document ||
      (!isWorkspaceRole(req.user.role) && document.status !== "Berlaku")
    )
      return res.status(404).json({ message: "Dokumen tidak ditemukan." });
    const filePath = path.join(uploadDirectory, document.file_path ?? "");
    if (!document.file_path || !fs.existsSync(filePath)) {
      await appendAudit({
        actorId: req.user.id,
        action: "document.file_missing",
        entityType: "document",
        entityId: document.id,
        metadata: { fileName: document.file_name },
      });
      return res.status(410).json({
        message:
          "File dokumen tidak tersedia di storage server. Dokumen perlu diunggah ulang.",
      });
    }
    await appendAudit({
      actorId: req.user.id,
      action: "document.downloaded",
      entityType: "document",
      entityId: document.id,
    });
    res.setHeader(
      "Content-Type",
      document.file_type || "application/octet-stream",
    );
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(document.file_name || "dokumen")}`,
    );
    return res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

app.get(
  "/api/approvals",
  authenticate,
  requireWorkspaceRole,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT s.id, d.id AS document_id, d.code, d.title, d.created_at AS date,
          s.stage_number, s.stage_name AS step, s.required_role, s.required_count,
          (SELECT COUNT(*) FROM approvals a WHERE a.document_id = d.id AND a.stage_number = s.stage_number AND a.decision = 'Setujui') AS approved_count,
                COALESCE(u.name, 'Pengguna workspace') AS requester
         FROM document_approval_steps s
         JOIN documents d ON d.id = s.document_id
         LEFT JOIN users u ON u.id = d.uploaded_by
         WHERE s.decision = 'Menunggu'
           AND ($1 = 'admin' OR s.required_role = $1)
           AND ($1 = 'admin' OR s.required_role <> 'manager' OR s.approver_user_id = $2)
           AND NOT EXISTS (
             SELECT 1 FROM document_approval_steps previous
             WHERE previous.document_id = s.document_id
               AND previous.stage_number < s.stage_number
               AND previous.decision <> 'Disetujui'
           )
           AND (SELECT COUNT(*) FROM approvals a WHERE a.document_id = d.id AND a.stage_number = s.stage_number AND a.decision = 'Setujui') < s.required_count
           AND NOT EXISTS (SELECT 1 FROM approvals mine WHERE mine.document_id = d.id AND mine.stage_number = s.stage_number AND mine.decided_by = $2 AND mine.decision = 'Setujui')
         ORDER BY d.created_at DESC`,
        [req.user.role, req.user.id],
      );
      res.json({
        approvals: result.rows.map((row) => ({
          ...row,
          documentId: row.document_id,
          stageNumber: row.stage_number,
          requiredRole: row.required_role,
          stageStatus: row.decision,
          step: `Tahap ${row.stage_number}: ${row.step} (${row.approved_count}/${row.required_count})`,
          tone: "amber",
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/audit-logs", authenticate, async (req, res, next) => {
  if (!isAdmin(req.user.role))
    return res
      .status(403)
      .json({ message: "Audit log hanya dapat dibaca Administrator Sistem." });
  try {
    const result = await pool.query(
      `SELECT a.*, u.name AS actor_name
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC`,
    );
    res.json({ auditLogs: result.rows.map(toAuditLog) });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/approvals/:id/decision",
  authenticate,
  requireWorkspaceRole,
  async (req, res, next) => {
    const { decision, comment } = req.body ?? {};
    if (!["Setujui", "Minta revisi", "Tolak"].includes(decision))
      return res.status(422).json({ message: "Keputusan tidak valid." });
    if (decision === "Minta revisi" && !comment?.trim())
      return res.status(422).json({ message: "Catatan revisi wajib diisi." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const stepResult = await client.query(
        `SELECT s.*, d.* FROM document_approval_steps s
         JOIN documents d ON d.id = s.document_id
         WHERE s.document_id = $1
           AND ($2 = 'admin' OR s.required_role = $2)
           AND s.decision = 'Menunggu'
           AND ($2 = 'admin' OR s.required_role <> 'manager' OR s.approver_user_id = $3)
         AND NOT EXISTS (
           SELECT 1 FROM document_approval_steps previous
           WHERE previous.document_id = s.document_id
             AND previous.stage_number < s.stage_number
             AND previous.decision <> 'Disetujui'
         )
           AND (SELECT COUNT(*) FROM approvals a WHERE a.document_id = s.document_id AND a.stage_number = s.stage_number AND a.decision = 'Setujui') < s.required_count
           AND NOT EXISTS (SELECT 1 FROM approvals mine WHERE mine.document_id = s.document_id AND mine.stage_number = s.stage_number AND mine.decided_by = $3 AND mine.decision = 'Setujui')
         FOR UPDATE OF s, d`,
        [req.params.id, req.user.role, req.user.id],
      );
      const step = stepResult.rows[0];
      if (!step) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message:
            "Dokumen belum berada pada tahap approval yang menjadi kewenangan Anda.",
        });
      }
      const document = step;
      const approval = await client.query(
        `INSERT INTO approvals (document_id, stage_number, stage_name, approver_role, decision, comment, decided_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          document.id,
          step.stage_number,
          step.stage_name,
          step.required_role,
          decision,
          comment ?? "",
          req.user.id,
        ],
      );
      const countResult = await client.query(
        `SELECT COUNT(*)::int AS approved_count FROM approvals
         WHERE document_id = $1 AND stage_number = $2 AND decision = 'Setujui'`,
        [document.id, step.stage_number],
      );
      const approvedCount = countResult.rows[0].approved_count;
      const stageComplete =
        decision === "Setujui" && approvedCount >= step.required_count;
      if (stageComplete) {
        await client.query(
          `UPDATE document_approval_steps
           SET decision = 'Disetujui', comment = $1, decided_by = $2, decided_at = NOW()
           WHERE document_id = $3 AND stage_number = $4`,
          [comment ?? "", req.user.id, document.id, step.stage_number],
        );
      }
      const nextStatus =
        stageComplete && step.stage_number === 3
          ? "Berlaku"
          : decision === "Minta revisi"
            ? "Revisi"
            : decision === "Tolak"
              ? "Draft"
              : "Dalam review";
      await client.query(
        `UPDATE documents SET status = $1,
          revision_note = CASE WHEN $2 = 'Minta revisi' THEN $3 ELSE revision_note END
         WHERE id = $4`,
        [nextStatus, decision, comment ?? "", document.id],
      );
      await client.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, 'document', $3, $4::jsonb)`,
        [
          req.user.id,
          `approval.${decision === "Setujui" ? "approved" : decision === "Minta revisi" ? "revision_requested" : "rejected"}`,
          document.id,
          JSON.stringify({
            decision,
            comment: comment ?? "",
            stage: step.stage_number,
            approvedCount,
            requiredCount: step.required_count,
          }),
        ],
      );
      await client.query("COMMIT");
      res.json({
        approval: approval.rows[0],
        document: toDocument({ ...document, status: nextStatus }),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  },
);

function toDocument(document) {
  return {
    id: document.id,
    code: document.code,
    title: document.title,
    type: document.type,
    unit: document.unit,
    version: document.version,
    status: document.status,
    lifecycleStatus: document.lifecycle_status ?? "Aktif",
    description: document.description ?? "",
    changeSummary: document.change_summary ?? "",
    revisionNote: document.revision_note ?? "",
    effectiveDate: document.effective_date ?? "",
    reviewDate: document.review_date ?? "",
    effective:
      document.effective_date ??
      (document.status === "Berlaku" ? "Berlaku" : "Belum"),
    review: document.review_date ?? "Belum dijadwalkan",
    fileName: document.file_name,
    fileType: document.file_type,
    fileSize: document.file_size,
    managerApproverId: document.manager_approver_id,
    uploadedBy: document.uploaded_by,
    uploadedAt: document.created_at,
    source: "uploaded",
  };
}

function toAuditLog(log) {
  return {
    id: log.id,
    actorId: log.actor_id,
    actorName: log.actor_name ?? "Sistem",
    action: log.action,
    entityType: log.entity_type,
    entityId: log.entity_id,
    entityLabel: log.entity_id
      ? `${log.entity_type} · ${log.entity_id}`
      : log.entity_type,
    metadata: log.metadata ?? {},
    createdAt: log.created_at,
  };
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res
    .status(error.code === "LIMIT_FILE_SIZE" ? 413 : 500)
    .json({ message: error.message || "Permintaan tidak dapat diproses." });
});

const server = app.listen(port, () =>
  console.log(
    `Governance Hub API PostgreSQL berjalan di http://127.0.0.1:${port}`,
  ),
);
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} sedang dipakai proses lain.`);
    process.exit(1);
  }
  console.error("API gagal dijalankan:", error);
  process.exit(1);
});
