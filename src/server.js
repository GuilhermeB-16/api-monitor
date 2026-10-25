import { readFile } from "node:fs/promises";
import Docker from "dockerode";
import pool from "./database.js";
import { createApp } from "./app.js";
import { getContainerStats, saveMetrics } from "./metrics.js";

const docker = new Docker();
const PORT = Number(process.env.PORT || 3000);
const app = createApp({ docker, pool, saveMetrics, getContainerStats });

async function collectMetrics() {
  try {
    const containers = await docker.listContainers();
    const monitoredContainers = containers.filter(
      (container) =>
        !container.Names.includes("/monitoring-db") &&
        !container.Names.includes("/monitoring-db-previous"),
    );

    await Promise.all(
      monitoredContainers.map(async (containerInfo) => {
        const dockerContainer = docker.getContainer(containerInfo.Id);
        const metrics = await getContainerStats(dockerContainer);
        const serviceName = containerInfo.Names[0].replace("/", "");

        await saveMetrics(serviceName, metrics.CPU, metrics.MEMORIA);
        console.log(
          `${serviceName} - CPU: ${metrics.CPU}%, Memory: ${metrics.MEMORIA}MB`,
        );
      }),
    );
  } catch (error) {
    console.error("Erro ao coletar métricas:", error);
  }
}

const schema = await readFile(new URL("./init.sql", import.meta.url), "utf8");
await pool.query(schema);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

collectMetrics();
setInterval(collectMetrics, 60000);
