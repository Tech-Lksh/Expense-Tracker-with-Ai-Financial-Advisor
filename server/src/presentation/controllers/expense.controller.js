const expenseService = require("../../business/services/expense.service");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");

const create = asyncHandler(async (req, res) => {
  const expense = await expenseService.create(req.user._id, req.body);
  new ApiResponse(201, expense, "Expense created").send(res);
});

const getById = asyncHandler(async (req, res) => {
  const expense = await expenseService.getById(req.user._id, req.params.id);
  new ApiResponse(200, expense).send(res);
});

const list = asyncHandler(async (req, res) => {
  const { items, meta } = await expenseService.list(req.user._id, req.query);
  new ApiResponse(200, items, "Success", meta).send(res);
});

const update = asyncHandler(async (req, res) => {
  const expense = await expenseService.update(req.user._id, req.params.id, req.body);
  new ApiResponse(200, expense, "Expense updated").send(res);
});

const remove = asyncHandler(async (req, res) => {
  await expenseService.delete(req.user._id, req.params.id);
  new ApiResponse(200, null, "Expense deleted").send(res);
});

// ---- Google Maps powered endpoints ----

const nearby = asyncHandler(async (req, res) => {
  const results = await expenseService.findNearby(req.user._id, req.query);
  new ApiResponse(200, results, "Nearby expenses").send(res);
});

const mapData = asyncHandler(async (req, res) => {
  const results = await expenseService.getMapData(req.user._id, req.query);
  new ApiResponse(200, results, "Map data").send(res);
});

const getSummary = asyncHandler(async (req, res) => {
  const result = await expenseService.getSummary(req.user._id, req.query);
  new ApiResponse(200, result, "Expense summary").send(res);
});

module.exports = { create, getById, list, update, remove, nearby, mapData, getSummary };
