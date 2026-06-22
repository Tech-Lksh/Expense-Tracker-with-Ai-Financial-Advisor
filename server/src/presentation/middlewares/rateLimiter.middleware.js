const rateLimit = require("express-rate-limit");
const { env, rateLimit: rateLimitConfig } = require("../../config/env");

const isDev = env === "development";

// General API limiter: generous, just to blunt abuse/scraping.
const apiLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: isDev ? 10000 : rateLimitConfig.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later" },
});

// Auth endpoints get a much tighter limit to slow down credential
// stuffing / brute-force login attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 20, // Generous limit in dev to prevent blocking credentials testing
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many auth attempts, please try again later" },
});

// Location/geo endpoints (OpenStreetMap)
const geoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 1000 : 30, // Generous limit in dev to prevent blocking location entry/autocompletes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many location requests, slow down" },
});

module.exports = { apiLimiter, authLimiter, geoLimiter };
