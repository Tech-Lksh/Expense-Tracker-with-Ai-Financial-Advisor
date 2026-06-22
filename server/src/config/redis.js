const Redis = require("ioredis");
const { redis: redisConfig, env } = require("./env");
const logger = require("./logger");

// BullMQ requires maxRetriesPerRequest: null on the connection it manages.
// We create one shared connection factory so caching and queues reuse config
// without duplicating connection logic across the codebase.
function createRedisConnection({ forBullMQ = false } = {}) {
  const client = new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    maxRetriesPerRequest: forBullMQ ? null : 3,
    lazyConnect: env === "test",
  });

  client.on("error", (err) => {
    logger.error(`Redis connection error: ${err.message}`);
  });

  client.on("connect", () => {
    logger.info(`Redis connected${forBullMQ ? " (BullMQ)" : ""}`);
  });

  return client;
}

// Default shared client for simple caching (geocode/places cache, rate-limit store).
const redisClient = createRedisConnection();

module.exports = { redisClient, createRedisConnection };
