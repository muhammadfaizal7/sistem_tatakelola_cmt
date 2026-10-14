import cors from "cors";
import crypto from "node:crypto";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "data.json");
const uploadDirectory = path.join(__dirname, "uploads");
const port = Number(process.env.PORT || 8787);
const sessions = new Map();

fs.mkdirSync(uploadDirectory, { recursive: true });

const hashPassword = (
  password,
  salt = crypto.randomBytes(16).toString("hex"),
) => ({
  salt,
  hash: crypto.scryptSync(password, salt, 64).toString("hex"),
});

const verifyPassword = (password, stored) => {
  const derived = crypto.scryptSync(password, stored.salt, 64);
  return crypto.timingSafeEqual(derived, Buffer.from(stored.hash, "hex"));
};

const seedUsers = [
  [
    "usr-admin",
    "Agus Riyanto",
    "admin@comtelindo.co.id",
    "admin",
    "admin123",
    "GCG & Kepatuhan",
  ],
  [
    "usr-manager",
    "Dina Maharani",
    "manager@comtelindo.co.id",
    "manager",
    "manager123",
    "Procurement",
  ],
  [
    "usr-karyawan",
    "Rudi Hartono",
    "karyawan@comtelindo.co.id",
    "karyawan",
    "karyawan123",
    "Business Operations Support",
  ],
].map(([id, name, email, role, password, unit]) => ({
  id,
  name,
  email,
  role,
  unit,
  password: hashPassword(password),
}));

const readStore = () => {
  if (!fs.existsSync(dataPath)) {
    const initial = {
      users: seedUsers,
      documents: [],
      approvals: [],
      auditLogs: [],
    };
    fs.writeFileSync(dataPath, JSON.stringify(initial, null, 2));
    return initial;
  }
  const store = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  store.users ??= seedUsers;
  store.documents ??= [];
  store.approvals ??= [];
  store.auditLogs ??= [];
  return store;
};

const writeStore = (store) =>
  fs.writeFileSync(dataPath, JSON.stringify(store, null, 2));
const publicUser = ({ password: _password, ...user }) => user;
const isWorkspaceRole = (role) => role === "admin" || role === "manager";
const isAdmin = (role) => role === "admin";

const appendAudit = (
  store,
  { actorId = null, action, entityType, entityId = null, metadata = {} },
) => {
  store.auditLogs.push({
    id: crypto.randomUUID(),
    actorId,
    action,
    entityType,
    entityId,
    metadata,
    createdAt: new Date().toISOString(),
  });
};

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const userId = token && sessions.get(token);
  const user =
    userId && readStore().users.find((candidate) => candidate.id === userId);
  if (!user) return res.status(401).json({ message: "Sesi tidak valid." });
  req.user = publicUser(user);
  next();
};

const requireWorkspaceRole = (req, res, next) => {
  if (!isWorkspaceRole(req.user.role))
    return res
      .status(403)
      .json({ message: "Role Anda tidak memiliki akses ke aksi ini." });
  next();
};

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

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "governance-hub-api" }),
);

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body ?? {};
  const store = readStore();
  const user = store.users.find(
    (candidate) =>
      candidate.email.toLowerCase() === String(email).toLowerCase(),
  );
  if (!user || !verifyPassword(String(password ?? ""), user.password))
    return res
      .status(401)
      .json({ message: "Email atau kata sandi belum sesuai." });
  const token = crypto.randomUUID();
  sessions.set(token, user.id);
  appendAudit(store, {
    actorId: user.id,
    action: "login",
    entityType: "session",
  });
  writeStore(store);
  res.json({ token, user: publicUser(user) });
});

app.post("/api/auth/logout", authenticate, (req, res) => {
  const store = readStore();
  const token = req.headers.authorization.replace("Bearer ", "");
  sessions.delete(token);
  appendAudit(store, {
    actorId: req.user.id,
    action: "logout",
    entityType: "session",
  });
  writeStore(store);
  res.status(204).end();
});

app.get("/api/documents", authenticate, (req, res) => {
  const store = readStore();
  const documents = isWorkspaceRole(req.user.role)
    ? store.documents
    : store.documents.filter((document) => document.status === "Berlaku");
  res.json({ documents });
});

app.post(
  "/api/documents",
  authenticate,
  requireWorkspaceRole,
  upload.single("file"),
  (req, res) => {
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
    const store = readStore();
    if (
      store.documents.some(
        (document) =>
          document.code === req.body.code &&
          document.version === req.body.version,
      )
    ) {
      fs.rmSync(req.file.path, { force: true });
      return res
        .status(409)
        .json({ message: "Kode dan versi dokumen sudah terdaftar." });
    }
    const document = {
      id: crypto.randomUUID(),
      ...req.body,
      status: "Draft",
      fileName: req.file.originalname,
      filePath: req.file.filename,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user.id,
      createdAt: new Date().toISOString(),
    };
    store.documents.unshift(document);
    appendAudit(store, {
      actorId: req.user.id,
      action: "document.uploaded",
      entityType: "document",
      entityId: document.id,
      metadata: {
        code: document.code,
        version: document.version,
        fileName: document.fileName,
      },
    });
    writeStore(store);
    res.status(201).json({ document });
  },
);

app.get("/api/documents/:id/file", authenticate, (req, res) => {
  const document = readStore().documents.find(
    (candidate) => candidate.id === req.params.id,
  );
  if (
    !document ||
    (!isWorkspaceRole(req.user.role) && document.status !== "Berlaku")
  )
    return res.status(404).json({ message: "Dokumen tidak ditemukan." });
  const store = readStore();
  appendAudit(store, {
    actorId: req.user.id,
    action: "document.downloaded",
    entityType: "document",
    entityId: document.id,
  });
  writeStore(store);
  return res.download(
    path.join(uploadDirectory, document.filePath),
    document.fileName,
  );
});

app.get("/api/approvals", authenticate, requireWorkspaceRole, (req, res) => {
  const store = readStore();
  const userById = new Map(store.users.map((user) => [user.id, user]));
  const pending = store.documents
    .filter((document) => document.status === "Draft")
    .map((document) => ({
      id: document.id,
      documentId: document.id,
      code: document.code,
      title: document.title,
      step: "Pengesahan",
      requester:
        userById.get(document.uploadedBy)?.name ?? "Pengguna workspace",
      date: document.createdAt,
      tone: "amber",
    }));
  res.json({ approvals: pending });
});

app.get("/api/audit-logs", authenticate, (req, res) => {
  if (!isAdmin(req.user.role))
    return res
      .status(403)
      .json({ message: "Audit log hanya dapat dibaca Administrator Sistem." });
  const store = readStore();
  res.json({ auditLogs: [...store.auditLogs].reverse() });
});

app.post(
  "/api/approvals/:id/decision",
  authenticate,
  requireWorkspaceRole,
  (req, res) => {
    const { decision, comment } = req.body ?? {};
    if (!["Setujui", "Minta revisi", "Tolak"].includes(decision))
      return res.status(422).json({ message: "Keputusan tidak valid." });
    const store = readStore();
    const document = store.documents.find(
      (candidate) => candidate.id === req.params.id,
    );
    if (!document)
      return res.status(404).json({ message: "Dokumen tidak ditemukan." });
    const approval = {
      id: crypto.randomUUID(),
      documentId: document.id,
      decision,
      comment: comment ?? "",
      decidedBy: req.user.id,
      decidedAt: new Date().toISOString(),
    };
    store.approvals.push(approval);
    document.status =
      decision === "Setujui"
        ? "Berlaku"
        : decision === "Minta revisi"
          ? "Draft"
          : "Draft";
    appendAudit(store, {
      actorId: req.user.id,
      action: `approval.${decision === "Setujui" ? "approved" : decision === "Minta revisi" ? "revision_requested" : "rejected"}`,
      entityType: "document",
      entityId: document.id,
      metadata: { decision, comment },
    });
    writeStore(store);
    res.json({ approval, document });
  },
);

app.use((error, _req, res, _next) =>
  res
    .status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400)
    .json({ message: error.message || "Permintaan tidak dapat diproses." }),
);
const server = app.listen(port, () =>
  console.log(`Governance Hub API berjalan di http://127.0.0.1:${port}`),
);

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} sedang dipakai proses lain.`);
    console.error(`API mungkin sudah berjalan di http://127.0.0.1:${port}`);
    console.error("Gunakan port lain di Windows: set PORT=8788&& npm run api");
    process.exit(1);
  }
  console.error("API gagal dijalankan:", error);
  process.exit(1);
});
