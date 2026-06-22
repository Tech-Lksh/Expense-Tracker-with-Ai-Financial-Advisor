const tokenService = require("../../business/services/token.service");
const userRepository = require("../../data/repositories/user.repository");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");

/**
 * Protects routes: expects `Authorization: Bearer <accessToken>`. On
 * success, attaches the authenticated user document (minus secrets) to
 * req.user for downstream controllers/services.
 */
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) throw ApiError.unauthorized("Access token missing");

  let decoded;
  try {
    decoded = tokenService.verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid or expired access token");
  }

  const user = await userRepository.findById(decoded.sub);
  if (!user) throw ApiError.unauthorized("User no longer exists");

  req.user = user;
  next();
});

module.exports = requireAuth;
