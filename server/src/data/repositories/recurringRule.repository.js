const { RecurringRule } = require("../models");

class RecurringRuleRepository {
  create(data) {
    return RecurringRule.create(data);
  }

  findAllForUser(userId) {
    return RecurringRule.find({ user: userId }).populate("category", "name colorCode icon").exec();
  }

  findByIdForUser(id, userId) {
    return RecurringRule.findOne({ _id: id, user: userId }).exec();
  }

  updateById(id, data) {
    return RecurringRule.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  deleteById(id) {
    return RecurringRule.findByIdAndDelete(id).exec();
  }

  /**
   * Rules due to run right now — picked up by the recurring-expense
   * BullMQ worker on its scheduled tick.
   */
  findDue(asOf = new Date()) {
    return RecurringRule.find({ isActive: true, nextRunDate: { $lte: asOf } })
      .populate("category")
      .exec();
  }
}

module.exports = new RecurringRuleRepository();
