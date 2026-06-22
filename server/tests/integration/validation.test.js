const request = require("supertest");
const app = require("../../src/app");

describe("Request validation (auth routes)", () => {
  it("rejects registration with an invalid email and short password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "L", email: "not-an-email", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it("rejects login with a missing password", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "lokesh@example.com" });

    expect(res.status).toBe(400);
  });

  it("rejects protected routes without an Authorization header", async () => {
    const res = await request(app).get("/api/v1/expenses");
    expect(res.status).toBe(401);
  });
});
