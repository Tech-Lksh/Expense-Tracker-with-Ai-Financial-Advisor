const rateLimit = require("express-rate-limit");
const { env, rateLimit: rateLimitConfig } = require("../../config/env");

const isDev = env === "development";

// General API limiter: generous to support normal SPA activity without false positives.
const apiLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs || 15 * 60 * 1000,
  max: isDev ? 10000 : Math.max(rateLimitConfig.max, 3000),
  skip: (req) => req.method === "OPTIONS", // never rate-limit preflight requests
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later" },
});

// Auth endpoints get reasonable protection without blocking legitimate password resets or logins.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100, // 100 auth attempts per 15 min per IP
  skip: (req) => req.method === "OPTIONS",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many auth attempts, please try again later" },
});

// Location/geo endpoints (Google Maps / autocomplete)
const geoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 1000 : 120, // 120 per minute
  skip: (req) => req.method === "OPTIONS",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many location requests, slow down" },
});

module.exports = { apiLimiter, authLimiter, geoLimiter };
