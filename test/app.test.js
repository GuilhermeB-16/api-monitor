import request from "supertest";
import app from "../src/app.js";

describe("GET /health", () => {
  it("deve retornar status 200 e a mensagem de que a API está rodando", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      message: "API is running",
    });
  });
});
