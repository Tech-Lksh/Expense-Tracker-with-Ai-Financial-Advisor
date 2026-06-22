const categoryService = require("../../business/services/category.service");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");

const create = asyncHandler(async (req, res) => {
  const category = await categoryService.create(req.user._id, req.body);
  new ApiResponse(201, category, "Category created").send(res);
});

const list = asyncHandler(async (req, res) => {
  const categories = await categoryService.listForUser(req.user._id);
  new ApiResponse(200, categories).send(res);
});

const update = asyncHandler(async (req, res) => {
  const category = await categoryService.update(req.user._id, req.params.id, req.body);
  new ApiResponse(200, category, "Category updated").send(res);
});

const remove = asyncHandler(async (req, res) => {
  await categoryService.delete(req.user._id, req.params.id);
  new ApiResponse(200, null, "Category deleted").send(res);
});

module.exports = { create, list, update, remove };
