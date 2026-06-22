const budgetRepository = require("../../data/repositories/budget.repository");
const expenseRepository = require("../../data/repositories/expense.repository");
const userRepository = require("../../data/repositories/user.repository");
const categoryRepository = require("../../data/repositories/category.repository");
const notificationService = require("./notification.service");
const ApiError = require("../../utils/ApiError");
const logger = require("../../config/logger");

function monthRange(month, year) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

class BudgetService {
  create(userId, data) {
    return budgetRepository.create({ ...data, user: userId, category: data.categoryId });
  }

  async listForMonth(userId, month, year) {
    const budgets = await budgetRepository.findAllForUserMonth(userId, month, year);
    const { start, end } = monthRange(month, year);
    const spentMap = await expenseRepository.sumAllCategoriesByRange(userId, start, end);

    return budgets.map((b) => {
      const budgetObj = b.toObject ? b.toObject() : b;
      const category = budgetObj.category || {};
      return {
        _id: budgetObj._id,
        user: budgetObj.user,
        category: category._id ? category._id.toString() : budgetObj.category,
        categoryName: category.name || "Unknown",
        categoryColorCode: category.colorCode || "#cbd5e1",
        categoryIcon: category.icon || "tag",
        month: budgetObj.month,
        year: budgetObj.year,
        limitAmount: budgetObj.limitAmount,
        alertThresholdPercent: budgetObj.alertThresholdPercent,
        alertSent: budgetObj.alertSent,
        currentSpent: spentMap[category._id ? category._id.toString() : ""] || 0,
        createdAt: budgetObj.createdAt,
        updatedAt: budgetObj.updatedAt,
      };
    });
  }

  async update(userId, budgetId, data) {
    const budget = await budgetRepository.findByIdForUser(budgetId, userId);
    if (!budget) throw ApiError.notFound("Budget not found");
    return budgetRepository.updateById(budgetId, data);
  }

  async delete(userId, budgetId) {
    const budget = await budgetRepository.findByIdForUser(budgetId, userId);
    if (!budget) throw ApiError.notFound("Budget not found");
    await budgetRepository.deleteById(budgetId);
  }

  /**
   * Called right after a new expense is saved. Computes month-to-date
   * spend for that category and flips `alertSent` once the configured
   * threshold is crossed. The actual notification dispatch is delegated to
   * notification.service so this method stays focused on the business
   * rule, not delivery mechanics.
   */
  async checkAndAlertIfNeeded(userId, categoryId, expenseDate) {
    const month = expenseDate.getMonth() + 1;
    const year = expenseDate.getFullYear();

    const budget = await budgetRepository.findOneForCategoryMonth(userId, categoryId, month, year);
    if (!budget || budget.alertSent) return;

    const { start, end } = monthRange(month, year);
    const spent = await expenseRepository.sumByCategoryAndRange(userId, categoryId, start, end);
    const percentUsed = (spent / budget.limitAmount) * 100;

    if (percentUsed >= budget.alertThresholdPercent) {
      await budgetRepository.markAlertSent(budget._id);

      const [user, category] = await Promise.all([
        userRepository.findById(userId),
        categoryRepository.findById(categoryId),
      ]);

      if (user && category) {
        await notificationService.sendBudgetAlert(user, {
          categoryName: category.name,
          percentUsed,
          limitAmount: budget.limitAmount,
          spent,
        });
      }

      logger.info(
        `Budget alert: user=${userId} category=${categoryId} spent=${spent}/${budget.limitAmount} (${percentUsed.toFixed(1)}%)`
      );
    }
  }
}

module.exports = new BudgetService();
