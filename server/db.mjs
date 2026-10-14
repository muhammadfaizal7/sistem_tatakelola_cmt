import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const databaseConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST ?? "127.0.0.1",
      port: Number(process.env.PGPORT ?? 55432),
      database: process.env.PGDATABASE ?? "gcg_monev",
      user: process.env.PGUSER ?? "gcg_app",
      password: process.env.PGPASSWORD ?? "Faizal070104",
    };

export const pool = new Pool(databaseConfig);
