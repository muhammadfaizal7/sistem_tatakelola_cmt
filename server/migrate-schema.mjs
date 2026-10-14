import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(__dirname, "migrations", "001_initial.sql");

try {
  const migration = await fs.readFile(migrationPath, "utf8");
  await pool.query(migration);
  console.log("PostgreSQL schema siap digunakan.");
} finally {
  await pool.end();
}
