const categoryRepository = require("../../data/repositories/category.repository");
const ApiError = require("../../utils/ApiError");

class CategoryService {
  create(userId, data) {
    return categoryRepository.create({ ...data, user: userId });
  }

  listForUser(userId) {
    return categoryRepository.findAllByUser(userId);
  }

  async update(userId, categoryId, data) {
    const category = await categoryRepository.findByIdForUser(categoryId, userId);
    if (!category) throw ApiError.notFound("Category not found");
    return categoryRepository.updateById(categoryId, data);
  }

  async delete(userId, categoryId) {
    const category = await categoryRepository.findByIdForUser(categoryId, userId);
    if (!category) throw ApiError.notFound("Category not found");
    if (category.isDefault) throw ApiError.badRequest("Default categories cannot be deleted");
    await categoryRepository.deleteById(categoryId);
  }
}

module.exports = new CategoryService();
