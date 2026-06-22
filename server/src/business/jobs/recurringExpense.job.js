const { Worker } = require("bullmq");
const { connection } = require("../queues");
const recurringRuleRepository = require("../../data/repositories/recurringRule.repository");
const expenseRepository = require("../../data/repositories/expense.repository");
const userRepository = require("../../data/repositories/user.repository");
const notificationService = require("../services/notification.service");
const recurringRuleService = require("../services/recurringRule.service");
const logger = require("../../config/logger");

/**
 * Processes the "recurring-expense" queue. On every tick (scheduled via a
 * repeatable job — see jobScheduler.js) it finds every active rule whose
 * nextRunDate has passed, creates the corresponding Expense (carrying over
 * the rule's saved location, so e.g. a monthly gym membership keeps its
 * gym's map pin), and rolls nextRunDate forward.
 */
function startRecurringExpenseWorker() {
  const worker = new Worker(
    "recurring-expense",
    async () => {
      const dueRules = await recurringRuleRepository.findDue();
      let created = 0;

      for (const rule of dueRules) {
        const expense = await expenseRepository.create({
          user: rule.user,
          category: rule.category._id,
          type: "expense",
          amount: rule.amount,
          note: `${rule.note} (auto-generated, recurring)`.trim(),
          date: rule.nextRunDate,
          location: rule.location,
          recurringRule: rule._id,
          customCategory: rule.customCategory,
        });

        await recurringRuleRepository.updateById(rule._id, {
          nextRunDate: recurringRuleService.computeNextRunDate(rule.frequency, rule.nextRunDate),
        });

        const user = await userRepository.findById(rule.user);
        if (user) await notificationService.sendRecurringExpenseCreated(user, expense);

        created += 1;
      }

      logger.info(`Recurring expense worker: materialized ${created} due rule(s)`);
      return { created };
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    logger.error(`Recurring expense job failed: ${err.message}`);
  });

  return worker;
}

module.exports = { startRecurringExpenseWorker };
