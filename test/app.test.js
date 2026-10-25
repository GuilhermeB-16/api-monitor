import request from "supertest";
import { jest } from "@jest/globals";
import { createApp } from "../src/app.js";

function createTestApp(overrides = {}) {
  return createApp({
    docker: {
      listContainers: async () => [],
      getContainer: () => ({}),
    },
    pool: {
      query: async () => ({ rows: [] }),
    },
    saveMetrics: async () => {},
    getContainerStats: async () => ({
      CPU: "1.00",
      MEMORIA: 2,
      CPUS: 1,
    }),
    ...overrides,
  });
}

describe("GET /health", () => {
  it("deve retornar status 200 e a mensagem de que a API está rodando", async () => {
    const response = await request(createTestApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      message: "API is running",
    });
  });
});

describe("GET /services", () => {
  it("deve retornar os serviços e salvar suas métricas", async () => {
    const saveMetrics = jest.fn();
    const app = createTestApp({
      docker: {
        listContainers: async () => [
          {
            Id: "container-id",
            Names: ["/example-service"],
            Status: "Up",
          },
        ],
        getContainer: () => ({}),
      },
      saveMetrics,
    });

    const response = await request(app).get("/services");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: "container-id",
        name: "example-service",
        status: "Up",
        cpu: "1.00",
        memory: 2,
      },
    ]);
    expect(saveMetrics).toHaveBeenCalledWith("example-service", "1.00", 2);
  });
});
