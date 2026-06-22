const analyticsService = require("../../business/services/analytics.service");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");

const categoryBreakdown = asyncHandler(async (req, res) => {
  const data = await analyticsService.categoryBreakdown(req.user._id, req.query);
  new ApiResponse(200, data).send(res);
});

const monthlyTrend = asyncHandler(async (req, res) => {
  const data = await analyticsService.monthlyTrend(req.user._id, req.query.monthsBack);
  new ApiResponse(200, data).send(res);
});

const trend = asyncHandler(async (req, res) => {
  const data = await analyticsService.getTrend(req.user._id, req.query);
  new ApiResponse(200, data).send(res);
});

module.exports = { categoryBreakdown, monthlyTrend, trend };
