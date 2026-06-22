const { Queue } = require("bullmq");
const { createRedisConnection } = require("../../config/redis");

const connection = createRedisConnection({ forBullMQ: true });

// Recurring expenses: a repeatable job that ticks periodically and inserts
// any RecurringRule whose nextRunDate has passed.
const recurringExpenseQueue = new Queue("recurring-expense", { connection });

// Budget alert sweep: a periodic safety-net scan, complementing the
// real-time check that already runs inline when an expense is created
// (budget.service.checkAndAlertIfNeeded). Catches edge cases like a budget
// created *after* expenses already crossed the threshold for the month.
const budgetAlertQueue = new Queue("budget-alert", { connection });

module.exports = { connection, recurringExpenseQueue, budgetAlertQueue };
