const { Category } = require("../models");

class CategoryRepository {
  create(data) {
    return Category.create(data);
  }

  findAllByUser(userId) {
    return Category.find({ user: userId }).sort({ name: 1 }).exec();
  }

  findById(id) {
    return Category.findById(id).exec();
  }

  findByIdForUser(id, userId) {
    return Category.findOne({ _id: id, user: userId }).exec();
  }

  updateById(id, data) {
    return Category.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  deleteById(id) {
    return Category.findByIdAndDelete(id).exec();
  }

  seedDefaults(userId) {
    const defaults = [
      { name: "Food & Dining", icon: "utensils", colorCode: "#E07A5F" },
      { name: "Transportation", icon: "car", colorCode: "#3D5A80" },
      { name: "Shopping", icon: "shopping-bag", colorCode: "#9B5DE5" },
      { name: "Bills & Utilities", icon: "file-text", colorCode: "#F4A261" },
      { name: "Entertainment", icon: "film", colorCode: "#2A9D8F" },
      { name: "Health", icon: "heart", colorCode: "#E63946" },
      { name: "Other", icon: "tag", colorCode: "#6C757D" },
    ];
    return Category.insertMany(
      defaults.map((d) => ({ ...d, user: userId, isDefault: true }))
    );
  }
}

module.exports = new CategoryRepository();
