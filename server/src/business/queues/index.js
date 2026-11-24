const { Queue } = require("bullmq");
const { createRedisConnection } = require("../../config/redis");

let connection = null;
let recurringExpenseQueue = null;
let budgetAlertQueue = null;

function getQueues() {
  if (!connection) {
    connection = createRedisConnection({ forBullMQ: true });
    recurringExpenseQueue = new Queue("recurring-expense", { connection });
    budgetAlertQueue = new Queue("budget-alert", { connection });
  }
  return { connection, recurringExpenseQueue, budgetAlertQueue };
}

module.exports = {
  getQueues,
  get connection() {
    return getQueues().connection;
  },
  get recurringExpenseQueue() {
    return getQueues().recurringExpenseQueue;
  },
  get budgetAlertQueue() {
    return getQueues().budgetAlertQueue;
  },
};
