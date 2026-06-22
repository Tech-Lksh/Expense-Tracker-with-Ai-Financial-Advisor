const recurringRuleService = require("../../business/services/recurringRule.service");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");

const create = asyncHandler(async (req, res) => {
  const rule = await recurringRuleService.create(req.user._id, req.body);
  new ApiResponse(201, rule, "Recurring rule created").send(res);
});

const list = asyncHandler(async (req, res) => {
  const rules = await recurringRuleService.listForUser(req.user._id);
  new ApiResponse(200, rules).send(res);
});

const update = asyncHandler(async (req, res) => {
  const rule = await recurringRuleService.update(req.user._id, req.params.id, req.body);
  new ApiResponse(200, rule, "Recurring rule updated").send(res);
});

const remove = asyncHandler(async (req, res) => {
  await recurringRuleService.delete(req.user._id, req.params.id);
  new ApiResponse(200, null, "Recurring rule deleted").send(res);
});

module.exports = { create, list, update, remove };
