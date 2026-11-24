const { getQueues } = require("../queues");
const { startRecurringExpenseWorker } = require("./recurringExpense.job");
const { startBudgetAlertWorker } = require("./budgetAlert.job");
const logger = require("../../config/logger");

/**
 * Registers repeatable background jobs and starts consumer workers.
 * If Redis is not available (e.g. local dev without Redis installed),
 * this gracefully skips without crashing the server.
 */
async function startJobScheduler(isRedisAvailable = false) {
  if (!isRedisAvailable) {
    logger.info("Job scheduler skipped: Redis is not available.");
    return { recurringWorker: null, budgetWorker: null };
  }

  try {
    const { recurringExpenseQueue, budgetAlertQueue } = getQueues();

    await recurringExpenseQueue.add(
      "tick",
      {},
      {
        repeat: { every: 60 * 60 * 1000 }, // hourly
        removeOnComplete: 50,
        removeOnFail: 50,
      }
    );

    await budgetAlertQueue.add(
      "sweep",
      {},
      {
        repeat: { every: 24 * 60 * 60 * 1000 }, // daily
        removeOnComplete: 20,
        removeOnFail: 20,
      }
    );

    const recurringWorker = startRecurringExpenseWorker();
    const budgetWorker = startBudgetAlertWorker();

    logger.info("Job scheduler started: recurring-expense (hourly), budget-alert (daily)");

    return { recurringWorker, budgetWorker };
  } catch (err) {
    logger.warn(`Failed to start BullMQ job scheduler: ${err.message}. Continuing without background workers.`);
    return { recurringWorker: null, budgetWorker: null };
  }
}

module.exports = { startJobScheduler };
