const expenseRepository = require("../../data/repositories/expense.repository");
const categoryRepository = require("../../data/repositories/category.repository");
const locationService = require("./location.service");
const budgetService = require("./budget.service");
const { parsePagination, buildMeta } = require("../../utils/pagination");
const ApiError = require("../../utils/ApiError");
const logger = require("../../config/logger");

class ExpenseService {
  async create(userId, payload) {
    const category = await categoryRepository.findByIdForUser(payload.categoryId, userId);
    if (!category) throw ApiError.badRequest("Invalid category");

    // Location is optional: the caller sends either a Google placeId (from
    // an autocomplete selection) or raw {lat, lng} (from device GPS / a
    // pin drop on the map). Both are resolved to the same GeoJSON shape.
    let location = null;
    if (payload.location && (payload.location.placeId || (payload.location.lat != null && payload.location.lng != null))) {
      location = await locationService.resolveExpenseLocation(payload.location);
    }

    const expense = await expenseRepository.create({
      user: userId,
      category: payload.categoryId,
      type: payload.type || "expense",
      amount: payload.amount,
      currency: payload.currency,
      note: payload.note,
      date: payload.date || new Date(),
      tags: payload.tags || [],
      location,
      customCategory: payload.customCategory,
    });

    if (expense.type === "expense") {
      // Non-fatal: a budget-alert failure must never roll back the actual
      // expense write, so failures here are logged, not thrown.
      budgetService
        .checkAndAlertIfNeeded(userId, expense.category, expense.date)
        .catch((err) => logger.error(`Budget threshold check failed: ${err.message}`));
    }

    return expenseRepository.findById(expense._id);
  }

  async getById(userId, expenseId) {
    const expense = await expenseRepository.findByIdForUser(expenseId, userId);
    if (!expense) throw ApiError.notFound("Expense not found");
    return expense;
  }

  async list(userId, query) {
    const { page, limit, skip } = parsePagination(query);
    const { items, total } = await expenseRepository.findPaginated(userId, {
      from: query.from,
      to: query.to,
      category: query.category,
      type: query.type,
      skip,
      limit,
    });
    return { items, meta: buildMeta({ page, limit, total }) };
  }

  async update(userId, expenseId, payload) {
    const existing = await expenseRepository.findByIdForUser(expenseId, userId);
    if (!existing) throw ApiError.notFound("Expense not found");

    const updateData = { ...payload };
    delete updateData.categoryId;
    if (payload.categoryId) updateData.category = payload.categoryId;

    if (payload.location) {
      updateData.location = await locationService.resolveExpenseLocation(payload.location);
    }

    return expenseRepository.updateById(expenseId, updateData);
  }

  async delete(userId, expenseId) {
    const existing = await expenseRepository.findByIdForUser(expenseId, userId);
    if (!existing) throw ApiError.notFound("Expense not found");
    await expenseRepository.deleteById(expenseId);
  }

  /**
   * "Expenses near me" — powers a map screen showing past spending around
   * the user's current GPS position.
   */
  async findNearby(userId, { lat, lng, radiusKm = 5, limit = 50 }) {
    if (lat == null || lng == null) {
      throw ApiError.badRequest("lat and lng query parameters are required");
    }
    return expenseRepository.findNearby(userId, {
      latitude: Number(lat),
      longitude: Number(lng),
      radiusMeters: Number(radiusKm) * 1000,
      limit: Number(limit),
    });
  }

  /**
   * Lightweight dataset for rendering all geotagged expenses as pins/a
   * heatmap on the frontend map view.
   */
  async getMapData(userId, query) {
    return expenseRepository.findForMap(userId, { from: query.from, to: query.to });
  }

  async getSummary(userId, query) {
    return expenseRepository.getSummary(userId, { from: query.from, to: query.to });
  }
}

module.exports = new ExpenseService();
