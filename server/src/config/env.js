const dotenv = require("dotenv");
const path = require("path");
const Joi = require("joi");

// Load .env.test in test mode, .env otherwise. Real secrets are never committed;
// .env.example documents every key a deployer needs to set.
const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().default(5000),
  CLIENT_URL: Joi.string().uri().required(),
  API_VERSION: Joi.string().default("v1"),

  MONGO_URI: Joi.string().required(),

  REDIS_HOST: Joi.string().default("127.0.0.1"),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow("").default(""),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),
  COOKIE_DOMAIN: Joi.string().default("localhost"),

  GOOGLE_MAPS_API_KEY: Joi.string().required(),

  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(200),

  LOG_LEVEL: Joi.string().default("info"),
}).unknown(true);

const { value: envVars, error } = envSchema.validate(process.env);

if (error) {
  // Fail fast: a misconfigured deployment should never silently start.
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  isProd: envVars.NODE_ENV === "production",
  isTest: envVars.NODE_ENV === "test",
  port: envVars.PORT,
  clientUrl: envVars.CLIENT_URL,
  apiVersion: envVars.API_VERSION,

  mongo: {
    uri: envVars.MONGO_URI,
  },

  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD || undefined,
  },

  jwt: {
    accessSecret: envVars.JWT_ACCESS_SECRET,
    accessExpiresIn: envVars.JWT_ACCESS_EXPIRES_IN,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
    cookieDomain: envVars.COOKIE_DOMAIN,
  },

  googleMaps: {
    apiKey: envVars.GOOGLE_MAPS_API_KEY,
  },

  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    max: envVars.RATE_LIMIT_MAX_REQUESTS,
  },

  logLevel: envVars.LOG_LEVEL,
};
