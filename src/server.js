import express from "express";
import Docker from "dockerode";
import pool from "./database.js";
import { saveMetrics } from "./metrics.js";

const docker = new Docker();
const app = express();
const PORT = process.env.PORT || 3000;

/* Essa função calcula as estatísticas do container para saber exatamente o uso de CPU e memória. Filtramos informações desnecessárias e pegamos apenas as informações relevantes para o cálculo. */
async function getContainerStats(container) {
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
/* Essa função basicamente pegou a parte que estava dentro do /services e trasformei em uma função. Ele coleta as métricas de todos os containers monitorados. */
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
        const container = docker.getContainer(containerInfo.Id);
        const metrics = await getContainerStats(container);
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

/* Aqui estou fazendo uma conexão assíncrona com os meus containers Docker e listando informações sobre eles como ID, nome ,status, uso de CPU, uso de memória. Caso ocorra algum erro, será retornado um erro 500. */

app.get("/services", async (req, res) => {
  try {
    const containers = await docker.listContainers();

    const services = await Promise.all(
      /* O Promise.all é usado para executar várias operações assíncronas em paralelo e esperar todas elas serem concluídas. */
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

/* Aqui vamos obter informações mais específicas sobre um container, como CPU, memória e rede. O comando await container.stats() é como o comando docker stats --no-stream. Ele retorna uma impressão das estatísticas do container. */
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
/* Nesse trecho de código estamos criando um endpoint para obter as métricas de um serviço específico */
app.get("/services/:name/metrics", async (req, res) => {
  try {
    const { name } = req.params;
    const result = await pool.query(
      `SELECT
        service_name,
        cpu,
        memory,
        collected_at
      FROM api_monitor.metrics
      WHERE service_name = $1
      ORDER BY collected_at DESC`,
      [name],
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Não foi possível obter as métricas do serviço",
    });
  }
});

// Garante que exista um schema separado para a aplicação e cria a tabela de métricas
// caso ela ainda não exista. Assim, o banco fica preparado antes de a API usá-la.
await pool.query(`
  CREATE SCHEMA IF NOT EXISTS api_monitor;
  CREATE TABLE IF NOT EXISTS api_monitor.metrics (
    id BIGSERIAL PRIMARY KEY,
    service_name TEXT NOT NULL,
    cpu NUMERIC(5, 2) NOT NULL,
    memory NUMERIC(10, 2) NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

/*Estou fazendo uma conexão com banco de dados que está dentro de um contêiner  Docker*/
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("Erro ao conectar ao banco de dados:", err);
    return;
  }

  console.log("Database connected:", res.rows[0]);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

collectMetrics();
setInterval(collectMetrics, 60000);
