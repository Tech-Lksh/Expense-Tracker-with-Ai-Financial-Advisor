const { recurringExpenseQueue, budgetAlertQueue } = require("../queues");
const { startRecurringExpenseWorker } = require("./recurringExpense.job");
const { startBudgetAlertWorker } = require("./budgetAlert.job");
const logger = require("../../config/logger");

/**
 * Registers the repeatable (cron-like) producers and starts the worker
 * processes that consume them. Called once from server.js on boot.
 *
 * - recurring-expense ticks every hour: due rules are usually only a few
 *   minutes "late" at worst, which is fine for a personal finance app.
 * - budget-alert runs once a day: it's a safety net, not the primary alert
 *   path (that's the real-time check in budget.service), so a daily sweep
 *   is sufficient.
 */
async function startJobScheduler() {
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
}

module.exports = { startJobScheduler };
