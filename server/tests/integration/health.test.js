const request = require("supertest");
const app = require("../../src/app");

describe("App-level routes", () => {
  it("GET /health returns 200 with uptime info", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("uptime");
  });

  it("GET /api/v1/does-not-exist returns a structured 404", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Route not found/);
  });

  it("GET /api-docs serves the Swagger UI", async () => {
    const res = await request(app).get("/api-docs/");
    expect([200, 301, 302]).toContain(res.status);
  });
});
