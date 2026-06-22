const { Worker } = require("bullmq");
const { connection } = require("../queues");
const budgetRepository = require("../../data/repositories/budget.repository");
const expenseRepository = require("../../data/repositories/expense.repository");
const notificationService = require("../services/notification.service");
const logger = require("../../config/logger");

function monthRange(month, year) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Processes the "budget-alert" queue. Runs on a daily schedule (see
 * jobScheduler.js) and scans every budget for the current month that
 * hasn't already alerted. This is a safety net on top of the real-time
 * check in budget.service.checkAndAlertIfNeeded — it catches the edge case
 * where a budget is created or raised *after* spending already crossed the
 * threshold for the month, since no new expense write would otherwise
 * trigger a re-check.
 */
function startBudgetAlertWorker() {
  const worker = new Worker(
    "budget-alert",
    async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const budgets = await budgetRepository.findActiveForMonth(month, year);
      let alerted = 0;

      for (const budget of budgets) {
        const { start, end } = monthRange(month, year);
        const spent = await expenseRepository.sumByCategoryAndRange(
          budget.user._id,
          budget.category._id,
          start,
          end
        );
        const percentUsed = (spent / budget.limitAmount) * 100;

        if (percentUsed >= budget.alertThresholdPercent) {
          await budgetRepository.markAlertSent(budget._id);
          await notificationService.sendBudgetAlert(budget.user, {
            categoryName: budget.category.name,
            percentUsed,
            limitAmount: budget.limitAmount,
            spent,
          });
          alerted += 1;
        }
      }

      logger.info(`Budget alert worker: sent ${alerted} alert(s) out of ${budgets.length} budget(s) scanned`);
      return { alerted, scanned: budgets.length };
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    logger.error(`Budget alert job failed: ${err.message}`);
  });

  return worker;
}

module.exports = { startBudgetAlertWorker };
