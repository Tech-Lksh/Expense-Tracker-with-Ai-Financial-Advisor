const aiAdvisorService = require("../../business/services/aiAdvisor.service");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");

/**
 * @desc    Submit message to AI advisor chat stream or fallback rules processor
 * @route   POST /api/v1/ai-advisor/chat
 * @access  Private
 */
const chat = asyncHandler(async (req, res) => {
  const { message, history } = req.body;
  const result = await aiAdvisorService.handleChat(req.user._id, message, history || []);
  
  new ApiResponse(200, result, "Advice generated successfully").send(res);
});

/**
 * @desc    Load aggregated financial health score and forecast insights
 * @route   GET /api/v1/ai-advisor/insights
 * @access  Private
 */
const getInsights = asyncHandler(async (req, res) => {
  const result = await aiAdvisorService.getInsights(req.user._id);
  new ApiResponse(200, result, "Financial insights loaded successfully").send(res);
});

/**
 * @desc    Retrieve persistent chat logs history
 * @route   GET /api/v1/ai-advisor/history
 * @access  Private
 */
const getHistory = asyncHandler(async (req, res) => {
  const result = await aiAdvisorService.getHistory(req.user._id);
  new ApiResponse(200, result, "Conversation history loaded").send(res);
});

/**
 * @desc    Nuke conversation history log
 * @route   DELETE /api/v1/ai-advisor/history
 * @access  Private
 */
const clearHistory = asyncHandler(async (req, res) => {
  const result = await aiAdvisorService.clearHistory(req.user._id);
  new ApiResponse(200, result, "Conversation history cleared").send(res);
});

module.exports = {
  chat,
  getInsights,
  getHistory,
  clearHistory,
};
