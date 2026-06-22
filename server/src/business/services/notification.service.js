const logger = require("../../config/logger");

/**
 * Deliberately minimal: in a real deployment this would call an email
 * provider (SES/SendGrid) or push service (FCM). Kept as an isolated
 * module so swapping the delivery channel never touches business logic
 * in budget.service or the recurring/alert jobs.
 */
class NotificationService {
  async sendBudgetAlert(user, { categoryName, percentUsed, limitAmount, spent }) {
    logger.info(
      `[NOTIFY] ${user.email}: You've used ${percentUsed.toFixed(0)}% of your "${categoryName}" budget (Rs.${spent}/Rs.${limitAmount})`
    );
    // TODO: integrate real email/push provider here.
  }

  async sendRecurringExpenseCreated(user, expense) {
    logger.info(`[NOTIFY] ${user.email}: Recurring expense of Rs.${expense.amount} was logged automatically`);
  }
}

module.exports = new NotificationService();
