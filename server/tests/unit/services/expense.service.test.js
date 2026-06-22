jest.mock("../../../src/data/repositories/expense.repository");
jest.mock("../../../src/data/repositories/category.repository");
jest.mock("../../../src/business/services/location.service");
jest.mock("../../../src/business/services/budget.service");

const expenseRepository = require("../../../src/data/repositories/expense.repository");
const categoryRepository = require("../../../src/data/repositories/category.repository");
const locationService = require("../../../src/business/services/location.service");
const budgetService = require("../../../src/business/services/budget.service");
const expenseService = require("../../../src/business/services/expense.service");
const ApiError = require("../../../src/utils/ApiError");

describe("expenseService.create", () => {
  const userId = "user1";

  beforeEach(() => {
    jest.clearAllMocks();
    budgetService.checkAndAlertIfNeeded.mockResolvedValue();
  });

  it("throws if the category does not belong to the user", async () => {
    categoryRepository.findByIdForUser.mockResolvedValue(null);

    await expect(
      expenseService.create(userId, { categoryId: "bad-cat", amount: 100 })
    ).rejects.toThrow(ApiError);
  });

  it("resolves a Google placeId into a GeoJSON location before saving", async () => {
    categoryRepository.findByIdForUser.mockResolvedValue({ _id: "cat1" });
    locationService.resolveExpenseLocation.mockResolvedValue({
      type: "Point",
      coordinates: [77.41, 23.25],
      placeId: "place123",
      formattedAddress: "MP Nagar, Bhopal",
      name: "Starbucks",
    });
    expenseRepository.create.mockResolvedValue({ _id: "exp1", type: "expense", category: "cat1", date: new Date() });
    expenseRepository.findById.mockResolvedValue({ _id: "exp1" });

    await expenseService.create(userId, {
      categoryId: "cat1",
      amount: 250,
      location: { placeId: "place123" },
    });

    expect(locationService.resolveExpenseLocation).toHaveBeenCalledWith({ placeId: "place123" });
    expect(expenseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        location: expect.objectContaining({ placeId: "place123", coordinates: [77.41, 23.25] }),
      })
    );
  });

  it("skips location resolution entirely when none is provided", async () => {
    categoryRepository.findByIdForUser.mockResolvedValue({ _id: "cat1" });
    expenseRepository.create.mockResolvedValue({ _id: "exp1", type: "expense", category: "cat1", date: new Date() });
    expenseRepository.findById.mockResolvedValue({ _id: "exp1" });

    await expenseService.create(userId, { categoryId: "cat1", amount: 99 });

    expect(locationService.resolveExpenseLocation).not.toHaveBeenCalled();
    expect(expenseRepository.create).toHaveBeenCalledWith(expect.objectContaining({ location: null }));
  });

  it("triggers a non-blocking budget threshold check after creating an expense", async () => {
    categoryRepository.findByIdForUser.mockResolvedValue({ _id: "cat1" });
    expenseRepository.create.mockResolvedValue({
      _id: "exp1",
      type: "expense",
      category: "cat1",
      date: new Date("2026-06-15"),
    });
    expenseRepository.findById.mockResolvedValue({ _id: "exp1" });

    await expenseService.create(userId, { categoryId: "cat1", amount: 99 });

    expect(budgetService.checkAndAlertIfNeeded).toHaveBeenCalledWith(userId, "cat1", new Date("2026-06-15"));
  });
});
