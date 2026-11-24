const Redis = require("ioredis");
const { redis: redisConfig, env } = require("./env");
const logger = require("./logger");

let isConnected = false;
let redisClientInstance = null;

// Suppress unhandled ioredis connection error spam when Redis is offline locally
function attachClientListeners(client, label = "Redis") {
  client.on("error", (err) => {
    if (isConnected) {
      logger.warn(`${label} connection lost: ${err.message}`);
      isConnected = false;
    }
  });

  client.on("connect", () => {
    isConnected = true;
    logger.info(`${label} connected`);
  });

  return client;
}

/**
 * Probes whether a live Redis server is reachable with a short timeout.
 * Returns true if Redis is running, false otherwise.
 */
async function checkRedisAvailability() {
  if (env === "test") return false;

  const probeClient = redisConfig.url
    ? new Redis(redisConfig.url, {
        connectTimeout: 800,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy: () => null,
      })
    : new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        connectTimeout: 800,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy: () => null,
      });

  probeClient.on("error", () => {}); // silence connection errors during probe

  try {
    await probeClient.connect();
    const pong = await probeClient.ping();
    probeClient.disconnect();
    return pong === "PONG";
  } catch {
    try {
      probeClient.disconnect();
    } catch {}
    return false;
  }
}

/**
 * Creates an ioredis client connection configured for standard caching or BullMQ.
 */
function createRedisConnection({ forBullMQ = false } = {}) {
  const options = {
    maxRetriesPerRequest: forBullMQ ? null : 3,
    lazyConnect: env === "test",
    retryStrategy(times) {
      // If Redis is not available locally, slow down retry attempts to avoid terminal flooding
      if (times > 3) {
        return 15000;
      }
      return 1000;
    },
  };

  const client = redisConfig.url
    ? new Redis(redisConfig.url, options)
    : new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        ...options,
      });

  return attachClientListeners(client, forBullMQ ? "Redis (BullMQ)" : "Redis");
}

// In-memory fallback client used when Redis is not installed/running locally.
// Guarantees withCache in location.service.js continues to function smoothly.
const inMemoryStore = new Map();
const fallbackClient = {
  get: async (key) => inMemoryStore.get(key) || null,
  set: async (key, value) => {
    inMemoryStore.set(key, value);
    return "OK";
  },
  del: async (key) => {
    inMemoryStore.delete(key);
    return 1;
  },
  disconnect: () => {},
  status: "fallback",
};

// Proxy redisClient so calls to get/set transparently use live Redis if connected,
// or use fallbackClient when Redis is offline.
const redisClient = new Proxy(
  {},
  {
    get(target, prop) {
      if (redisClientInstance) {
        const val = redisClientInstance[prop];
        return typeof val === "function" ? val.bind(redisClientInstance) : val;
      }
      const fallbackVal = fallbackClient[prop];
      return typeof fallbackVal === "function" ? fallbackVal.bind(fallbackClient) : fallbackVal;
    },
  }
);

/**
 * Initializes Redis connection on server startup if available.
 */
async function initRedis() {
  const available = await checkRedisAvailability();
  if (available) {
    redisClientInstance = createRedisConnection();
    return true;
  } else {
    logger.warn(
      "Redis server is not running on 127.0.0.1:6379. Operating in fallback mode (in-memory caching; background queues disabled)."
    );
    return false;
  }
}

module.exports = {
  redisClient,
  createRedisConnection,
  checkRedisAvailability,
  initRedis,
};
