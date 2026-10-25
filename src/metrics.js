import pool from "./database.js";

export async function getContainerStats(container) {
  const firstStats = await container.stats({
    stream: false,
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const secondStats = await container.stats({
    stream: false,
  });

  const cpuDelta =
    secondStats.cpu_stats.cpu_usage.total_usage -
    firstStats.cpu_stats.cpu_usage.total_usage;
  const systemDelta =
    secondStats.cpu_stats.system_cpu_usage -
    firstStats.cpu_stats.system_cpu_usage;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;

  const memoryInMB = secondStats.memory_stats.usage / (1024 * 1024);

  return {
    CPU: cpuPercent.toFixed(2),
    MEMORIA: Number(memoryInMB.toFixed(2)),
    CPUS: secondStats.cpu_stats.online_cpus,
  };
}

export async function saveMetrics(serviceName, cpu, memory) {
  await pool.query(
    `INSERT INTO api_monitor.metrics (service_name, cpu, memory) VALUES ($1, $2, $3)`,
    [serviceName, cpu, memory],
  );
}
