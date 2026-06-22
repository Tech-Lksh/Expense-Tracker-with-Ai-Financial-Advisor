const recurringRuleRepository = require("../../data/repositories/recurringRule.repository");
const categoryRepository = require("../../data/repositories/category.repository");
const locationService = require("./location.service");
const ApiError = require("../../utils/ApiError");

function computeNextRunDate(frequency, from = new Date()) {
  const next = new Date(from);
  if (frequency === "daily") next.setDate(next.getDate() + 1);
  else if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  return next;
}

class RecurringRuleService {
  async create(userId, payload) {
    const category = await categoryRepository.findByIdForUser(payload.categoryId, userId);
    if (!category) throw ApiError.badRequest("Invalid category");

    let location = null;
    if (payload.location && (payload.location.placeId || (payload.location.lat != null && payload.location.lng != null))) {
      location = await locationService.resolveExpenseLocation(payload.location);
    }

    return recurringRuleRepository.create({
      user: userId,
      category: payload.categoryId,
      amount: payload.amount,
      note: payload.note,
      frequency: payload.frequency,
      nextRunDate: payload.startDate ? new Date(payload.startDate) : computeNextRunDate(payload.frequency),
      location,
      customCategory: payload.customCategory,
    });
  }

  async listForUser(userId) {
    const rules = await recurringRuleRepository.findAllForUser(userId);
    return rules.map((rule) => {
      const r = rule.toObject();
      return {
        ...r,
        categoryName: rule.category?.name || "Unknown",
        categoryColorCode: rule.category?.colorCode || "#cbd5e1",
        categoryIcon: rule.category?.icon || "tag",
      };
    });
  }

  async update(userId, ruleId, data) {
    const rule = await recurringRuleRepository.findByIdForUser(ruleId, userId);
    if (!rule) throw ApiError.notFound("Recurring rule not found");
    return recurringRuleRepository.updateById(ruleId, data);
  }

  async delete(userId, ruleId) {
    const rule = await recurringRuleRepository.findByIdForUser(ruleId, userId);
    if (!rule) throw ApiError.notFound("Recurring rule not found");
    await recurringRuleRepository.deleteById(ruleId);
  }
}

module.exports = new RecurringRuleService();
module.exports.computeNextRunDate = computeNextRunDate;
