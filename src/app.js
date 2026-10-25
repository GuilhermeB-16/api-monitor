import express from "express";

export function createApp({ docker, pool, saveMetrics, getContainerStats }) {
  const app = express();

  app.use(express.json());

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", message: "API is running" });
  });

  app.get("/services", async (req, res) => {
    try {
      const containers = await docker.listContainers();

      const services = await Promise.all(
        containers.map(async (containerInfo) => {
          const container = docker.getContainer(containerInfo.Id);
          const metrics = await getContainerStats(container);
          const serviceName = containerInfo.Names[0].replace("/", "");

          await saveMetrics(serviceName, metrics.CPU, metrics.MEMORIA);

          return {
            id: containerInfo.Id,
            name: serviceName,
            status: containerInfo.Status,
            cpu: metrics.CPU,
            memory: metrics.MEMORIA,
          };
        }),
      );

      res.json(services);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Não foi possível obter os serviços",
      });
    }
  });

  app.get("/services/:id/stats", async (req, res) => {
    try {
      const container = docker.getContainer(req.params.id);
      const metrics = await getContainerStats(container);

      res.json(metrics);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Não foi possível obter as métricas",
      });
    }
  });

  app.get("/services/:name/metrics", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
          service_name,
          cpu,
          memory,
          collected_at
        FROM api_monitor.metrics
        WHERE service_name = $1
        ORDER BY collected_at DESC`,
        [req.params.name],
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Não foi possível obter as métricas do serviço",
      });
    }
  });

  return app;
}
