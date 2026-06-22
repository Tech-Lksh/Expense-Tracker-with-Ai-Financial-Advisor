const ApiError = require("../../utils/ApiError");

function notFoundMiddleware(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = notFoundMiddleware;
