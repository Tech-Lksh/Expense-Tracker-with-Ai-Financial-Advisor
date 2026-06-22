const tokenService = require("../../../src/business/services/token.service");

describe("tokenService", () => {
  const payload = { sub: "user123" };

  it("signs and verifies an access token round-trip", () => {
    const token = tokenService.signAccessToken(payload);
    const decoded = tokenService.verifyAccessToken(token);
    expect(decoded.sub).toBe("user123");
  });

  it("signs and verifies a refresh token round-trip", () => {
    const token = tokenService.signRefreshToken(payload);
    const decoded = tokenService.verifyRefreshToken(token);
    expect(decoded.sub).toBe("user123");
  });

  it("rejects an access token when verified with the refresh verifier", () => {
    const token = tokenService.signAccessToken(payload);
    expect(() => tokenService.verifyRefreshToken(token)).toThrow();
  });

  it("hashToken is deterministic and produces a 64-char hex SHA-256 digest", () => {
    const a = tokenService.hashToken("some-refresh-token");
    const b = tokenService.hashToken("some-refresh-token");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashToken produces different output for different input", () => {
    const a = tokenService.hashToken("token-a");
    const b = tokenService.hashToken("token-b");
    expect(a).not.toBe(b);
  });
});
