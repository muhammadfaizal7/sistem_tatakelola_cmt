import "dotenv/config";
import crypto from "node:crypto";
import { pool } from "./db.mjs";

const accounts = [
  [
    "usr-admin-bootstrap",
    "Administrator GCG",
    "admin@comtelindo.co.id",
    "admin",
    "GCG & Kepatuhan",
    "admin123",
  ],
  [
    "usr-director",
    "Budi Santoso",
    "director@comtelindo.co.id",
    "director",
    "Direksi",
    "director123",
  ],
  [
    "usr-manager-bos",
    "Sari Wulandari",
    "manager.bos@comtelindo.co.id",
    "manager",
    "BOS",
    "manager123",
  ],
  [
    "usr-manager-finance",
    "Andi Pratama",
    "manager.finance@comtelindo.co.id",
    "manager",
    "Finance",
    "manager123",
  ],
  [
    "usr-manager-it",
    "Maya Putri",
    "manager.it@comtelindo.co.id",
    "manager",
    "IT",
    "manager123",
  ],
  [
    "usr-manager-legal",
    "Hendra Wijaya",
    "manager.legal@comtelindo.co.id",
    "manager",
    "Legal",
    "manager123",
  ],
];

for (const [legacyId, name, email, role, unit, password] of accounts) {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = JSON.stringify({
    salt,
    hash: crypto.scryptSync(password, salt, 64).toString("hex"),
  });
  await pool.query(
    `INSERT INTO users (legacy_id, name, email, role, unit, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, unit = EXCLUDED.unit, password_hash = EXCLUDED.password_hash, active = TRUE`,
    [legacyId, name, email, role, unit, passwordHash],
  );
}
console.log("Akun Admin, Director, dan Manager siap digunakan.");
await pool.end();
