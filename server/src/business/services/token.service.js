const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { jwt: jwtConfig } = require("../../config/env");

function signAccessToken(payload) {
  return jwt.sign(payload, jwtConfig.accessSecret, { expiresIn: jwtConfig.accessExpiresIn });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpiresIn });
}

function verifyAccessToken(token) {
  return jwt.verify(token, jwtConfig.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, jwtConfig.refreshSecret);
}

/**
 * We never store raw refresh tokens — only a SHA-256 hash — so a database
 * leak can't be replayed as a valid session token.
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
