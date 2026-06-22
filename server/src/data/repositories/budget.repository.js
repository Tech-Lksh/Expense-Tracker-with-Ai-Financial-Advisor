const { Budget } = require("../models");

class BudgetRepository {
  create(data) {
    return Budget.create(data);
  }

  findByIdForUser(id, userId) {
    return Budget.findOne({ _id: id, user: userId }).populate("category", "name colorCode icon").exec();
  }

  findAllForUserMonth(userId, month, year) {
    return Budget.find({ user: userId, month, year })
      .populate("category", "name colorCode icon")
      .exec();
  }

  updateById(id, data) {
    return Budget.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  deleteById(id) {
    return Budget.findByIdAndDelete(id).exec();
  }

  findOneForCategoryMonth(userId, categoryId, month, year) {
    return Budget.findOne({ user: userId, category: categoryId, month, year }).exec();
  }

  markAlertSent(id) {
    return Budget.findByIdAndUpdate(id, { alertSent: true });
  }

  /**
   * Used by the scheduled budget-alert job to scan every active budget for
   * the current month across all users.
   */
  findActiveForMonth(month, year) {
    return Budget.find({ month, year, alertSent: false }).populate("category user").exec();
  }
}

module.exports = new BudgetRepository();
