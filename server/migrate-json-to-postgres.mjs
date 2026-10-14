import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { pool } from "./db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(__dirname, "data.json");
const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const client = await pool.connect();
const userIds = new Map();
const documentIds = new Map();

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const safeUuid = (value) => (isUuid(value) ? value : crypto.randomUUID());

try {
  await client.query("BEGIN");
  await client.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_id VARCHAR(100) UNIQUE",
  );

  for (const user of source.users ?? []) {
    const result = await client.query(
      `INSERT INTO users (id, legacy_id, name, email, role, unit, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET
         legacy_id = EXCLUDED.legacy_id,
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         unit = EXCLUDED.unit,
         password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [
        safeUuid(user.id),
        user.id,
        user.name,
        user.email,
        user.role,
        user.unit,
        JSON.stringify(user.password),
      ],
    );
    userIds.set(user.id, result.rows[0].id);
  }

  for (const document of source.documents ?? []) {
    const result = await client.query(
      `INSERT INTO documents
         (id, code, title, type, unit, version, status, file_name, file_path, file_type, file_size, uploaded_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (code, version) DO UPDATE SET
         title = EXCLUDED.title,
         type = EXCLUDED.type,
         unit = EXCLUDED.unit,
         status = EXCLUDED.status,
         file_name = EXCLUDED.file_name,
         file_path = EXCLUDED.file_path,
         file_type = EXCLUDED.file_type,
         file_size = EXCLUDED.file_size,
         uploaded_by = EXCLUDED.uploaded_by
       RETURNING id`,
      [
        safeUuid(document.id),
        document.code,
        document.title,
        document.type,
        document.unit,
        document.version,
        document.status,
        document.fileName ?? null,
        document.filePath ?? null,
        document.fileType ?? null,
        document.fileSize ?? null,
        userIds.get(document.uploadedBy) ?? null,
        document.createdAt ?? new Date().toISOString(),
      ],
    );
    documentIds.set(document.id, result.rows[0].id);
  }

  for (const approval of source.approvals ?? []) {
    if (!documentIds.get(approval.documentId)) continue;
    await client.query(
      `INSERT INTO approvals (id, document_id, decision, comment, decided_by, decided_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        safeUuid(approval.id),
        documentIds.get(approval.documentId),
        approval.decision,
        approval.comment ?? null,
        userIds.get(approval.decidedBy) ?? null,
        approval.decidedAt ?? new Date().toISOString(),
      ],
    );
  }

  for (const log of source.auditLogs ?? []) {
    await client.query(
      `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        safeUuid(log.id),
        userIds.get(log.actorId) ?? null,
        log.action,
        log.entityType,
        documentIds.get(log.entityId) ?? null,
        JSON.stringify(log.metadata ?? {}),
        log.createdAt ?? new Date().toISOString(),
      ],
    );
  }

  await client.query("COMMIT");
  const counts = await client.query(`SELECT
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM documents) AS documents,
    (SELECT COUNT(*) FROM approvals) AS approvals,
    (SELECT COUNT(*) FROM audit_logs) AS audit_logs`);
  console.log("Migrasi JSON ke PostgreSQL berhasil:", counts.rows[0]);
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Migrasi dibatalkan:", error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
