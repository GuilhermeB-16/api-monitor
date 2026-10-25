import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

function requiredEnv(name) {
  const value = process.env[name];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `Variável de ambiente ${name} não definida. Configure-a no arquivo .env ou no ambiente do processo.`,
    );
  }

  return value;
}

const pool = new Pool({
  host: requiredEnv("DB_HOST"),
  port: Number(process.env.DB_PORT || 5432),
  user: requiredEnv("POSTGRES_USER"),
  password: requiredEnv("POSTGRES_PASSWORD"),
  database: requiredEnv("POSTGRES_DB"),
});

export default pool;
