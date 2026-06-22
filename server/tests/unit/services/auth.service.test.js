jest.mock("../../../src/data/repositories/user.repository");
jest.mock("../../../src/data/repositories/category.repository");

const userRepository = require("../../../src/data/repositories/user.repository");
const categoryRepository = require("../../../src/data/repositories/category.repository");
const tokenService = require("../../../src/business/services/token.service");
const authService = require("../../../src/business/services/auth.service");
const ApiError = require("../../../src/utils/ApiError");

function fakeUser(overrides = {}) {
  return {
    _id: "user123",
    email: "lokesh@example.com",
    comparePassword: jest.fn().mockResolvedValue(true),
    toSafeJSON: jest.fn().mockReturnValue({ _id: "user123", email: "lokesh@example.com" }),
    ...overrides,
  };
}

describe("authService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("rejects when the email is already taken", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser());

      await expect(
        authService.register({ name: "Lokesh", email: "lokesh@example.com", password: "Passw0rd!" })
      ).rejects.toThrow(ApiError);
    });

    it("creates a user, seeds default categories, and issues a token pair", async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(fakeUser());
      userRepository.updateRefreshTokenHash.mockResolvedValue({});

      const result = await authService.register({
        name: "Lokesh",
        email: "lokesh@example.com",
        password: "Passw0rd!",
      });

      expect(categoryRepository.seedDefaults).toHaveBeenCalledWith("user123");
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toEqual({ _id: "user123", email: "lokesh@example.com" });
    });
  });

  describe("login", () => {
    it("rejects an unknown email without revealing whether the account exists", async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login({ email: "nope@example.com", password: "x" })).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("rejects a wrong password", async () => {
      userRepository.findByEmail.mockResolvedValue(
        fakeUser({ comparePassword: jest.fn().mockResolvedValue(false) })
      );

      await expect(authService.login({ email: "lokesh@example.com", password: "wrong" })).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("issues a fresh token pair on valid credentials", async () => {
      userRepository.findByEmail.mockResolvedValue(fakeUser());
      userRepository.updateRefreshTokenHash.mockResolvedValue({});

      const result = await authService.login({ email: "lokesh@example.com", password: "Passw0rd!" });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });

  describe("refresh", () => {
    it("rejects when no token is supplied", async () => {
      await expect(authService.refresh(undefined)).rejects.toMatchObject({ statusCode: 401 });
    });

    it("rejects when the presented token's hash does not match what is stored (rotation theft check)", async () => {
      const refreshToken = tokenService.signRefreshToken({ sub: "user123" });
      userRepository.findById.mockResolvedValue(
        fakeUser({ refreshTokenHash: "stale-hash-that-will-never-match" })
      );

      await expect(authService.refresh(refreshToken)).rejects.toMatchObject({ statusCode: 401 });
      expect(userRepository.updateRefreshTokenHash).toHaveBeenCalledWith("user123", null);
    });

    it("rotates the refresh token when the presented hash matches", async () => {
      const refreshToken = tokenService.signRefreshToken({ sub: "user123" });
      const matchingHash = tokenService.hashToken(refreshToken);
      userRepository.findById.mockResolvedValue(fakeUser({ refreshTokenHash: matchingHash }));
      userRepository.updateRefreshTokenHash.mockResolvedValue({});

      const result = await authService.refresh(refreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      // The defining property of rotation is that a *new* hash gets persisted
      // for the issued token — not that the JWT string differs byte-for-byte
      // (two tokens signed with an identical payload in the same second can
      // legitimately be identical, since JWT `iat` has 1-second granularity).
      expect(userRepository.updateRefreshTokenHash).toHaveBeenCalledWith(
        "user123",
        tokenService.hashToken(result.refreshToken)
      );
    });
  });
});
