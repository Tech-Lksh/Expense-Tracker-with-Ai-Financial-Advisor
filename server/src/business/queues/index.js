const { Queue } = require("bullmq");

/**
 * Creates BullMQ queues with safe error handlers.
 * Called lazily by jobScheduler only when Redis is verified to be online.
 */
function createQueues(connection) {
  const recurringExpenseQueue = new Queue("recurring-expense", { connection });
  const budgetAlertQueue = new Queue("budget-alert", { connection });

  // Attach error listeners to queues so unhandled connection events don't crash Node
  recurringExpenseQueue.on("error", () => {});
  budgetAlertQueue.on("error", () => {});

  return { recurringExpenseQueue, budgetAlertQueue };
}

module.exports = { createQueues };
