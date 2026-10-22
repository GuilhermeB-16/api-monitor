import pool from "./database.js";

export async function saveMetrics(serviceName, cpu, memory) {
  await pool.query(
    `INSERT INTO api_monitor.metrics (service_name, cpu, memory) VALUES ($1, $2, $3)`,
    [serviceName, cpu, memory],
  );
}
