const budgetService = require("../../business/services/budget.service");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");

const create = asyncHandler(async (req, res) => {
  const budget = await budgetService.create(req.user._id, req.body);
  new ApiResponse(201, budget, "Budget created").send(res);
});

const list = asyncHandler(async (req, res) => {
  const budgets = await budgetService.listForMonth(req.user._id, Number(req.query.month), Number(req.query.year));
  new ApiResponse(200, budgets).send(res);
});

const update = asyncHandler(async (req, res) => {
  const budget = await budgetService.update(req.user._id, req.params.id, req.body);
  new ApiResponse(200, budget, "Budget updated").send(res);
});

const remove = asyncHandler(async (req, res) => {
  await budgetService.delete(req.user._id, req.params.id);
  new ApiResponse(200, null, "Budget deleted").send(res);
});

module.exports = { create, list, update, remove };
