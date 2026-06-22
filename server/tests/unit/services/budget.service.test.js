jest.mock("../../../src/data/repositories/budget.repository");
jest.mock("../../../src/data/repositories/expense.repository");
jest.mock("../../../src/data/repositories/user.repository");
jest.mock("../../../src/data/repositories/category.repository");
jest.mock("../../../src/business/services/notification.service");

const budgetRepository = require("../../../src/data/repositories/budget.repository");
const expenseRepository = require("../../../src/data/repositories/expense.repository");
const userRepository = require("../../../src/data/repositories/user.repository");
const categoryRepository = require("../../../src/data/repositories/category.repository");
const notificationService = require("../../../src/business/services/notification.service");
const budgetService = require("../../../src/business/services/budget.service");

describe("budgetService.checkAndAlertIfNeeded", () => {
  const userId = "user123";
  const categoryId = "cat123";
  const expenseDate = new Date("2026-06-15");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does nothing when no budget exists for the category/month", async () => {
    budgetRepository.findOneForCategoryMonth.mockResolvedValue(null);

    await budgetService.checkAndAlertIfNeeded(userId, categoryId, expenseDate);

    expect(expenseRepository.sumByCategoryAndRange).not.toHaveBeenCalled();
    expect(budgetRepository.markAlertSent).not.toHaveBeenCalled();
  });

  it("does nothing when the alert was already sent this month", async () => {
    budgetRepository.findOneForCategoryMonth.mockResolvedValue({
      _id: "budget1",
      alertSent: true,
      limitAmount: 5000,
      alertThresholdPercent: 80,
    });

    await budgetService.checkAndAlertIfNeeded(userId, categoryId, expenseDate);

    expect(expenseRepository.sumByCategoryAndRange).not.toHaveBeenCalled();
  });

  it("sends an alert once spend crosses the configured threshold", async () => {
    budgetRepository.findOneForCategoryMonth.mockResolvedValue({
      _id: "budget1",
      alertSent: false,
      limitAmount: 5000,
      alertThresholdPercent: 80,
    });
    expenseRepository.sumByCategoryAndRange.mockResolvedValue(4200); // 84% of 5000
    userRepository.findById.mockResolvedValue({ email: "lokesh@example.com" });
    categoryRepository.findById.mockResolvedValue({ name: "Food & Dining" });

    await budgetService.checkAndAlertIfNeeded(userId, categoryId, expenseDate);

    expect(budgetRepository.markAlertSent).toHaveBeenCalledWith("budget1");
    expect(notificationService.sendBudgetAlert).toHaveBeenCalledTimes(1);
    const [, alertPayload] = notificationService.sendBudgetAlert.mock.calls[0];
    expect(alertPayload.percentUsed).toBeCloseTo(84, 0);
  });

  it("does not alert when spend is below the threshold", async () => {
    budgetRepository.findOneForCategoryMonth.mockResolvedValue({
      _id: "budget1",
      alertSent: false,
      limitAmount: 5000,
      alertThresholdPercent: 80,
    });
    expenseRepository.sumByCategoryAndRange.mockResolvedValue(1000); // 20%

    await budgetService.checkAndAlertIfNeeded(userId, categoryId, expenseDate);

    expect(budgetRepository.markAlertSent).not.toHaveBeenCalled();
    expect(notificationService.sendBudgetAlert).not.toHaveBeenCalled();
  });
});
