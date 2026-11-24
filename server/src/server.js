// Suppress harmless BullMQ advisory about Upstash's eviction policy
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("Eviction policy is")) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

const app = require("./app");
const { port, env } = require("./config/env");
const { connectDB, disconnectDB } = require("./config/db");
const { redisClient, initRedis } = require("./config/redis");
const { startJobScheduler } = require("./business/jobs/jobScheduler");
const logger = require("./config/logger");

let httpServer;
let workers = {};

async function bootstrap() {
  await connectDB();
  logger.info(`Environment: ${env}`);

  // Safely check and initialize Redis (or activate fallback mode if Redis is offline)
  const isRedisAvailable = await initRedis();

  httpServer = app.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
  });

  // Background workers + repeatable jobs only start if Redis is running
  workers = await startJobScheduler(isRedisAvailable);
}

async function shutdown(signal) {
  logger.info(`${signal} received: shutting down gracefully`);

  try {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
      logger.info("HTTP server closed");
    }

    if (workers?.recurringWorker) await workers.recurringWorker.close();
    if (workers?.budgetWorker) await workers.budgetWorker.close();

    await disconnectDB();
    if (redisClient && typeof redisClient.disconnect === "function") {
      redisClient.disconnect();
    }

    logger.info("Shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error(`Error during shutdown: ${err.message}`);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err.stack || err.message}`);
  process.exit(1);
});

bootstrap().catch((err) => {
  logger.error(`Failed to start server: ${err.stack || err.message}`);
  process.exit(1);
});
