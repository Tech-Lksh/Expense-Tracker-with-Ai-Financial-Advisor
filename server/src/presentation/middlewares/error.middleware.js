const ApiError = require("../../utils/ApiError");
const logger = require("../../config/logger");
const { isProd } = require("../../config/env");

/**
 * Translates known error types (Mongoose validation/cast errors, JWT
 * errors, our own ApiError) into a consistent JSON shape. Anything
 * unrecognized is treated as a bug: logged in full, but the client only
 * ever sees a generic message in production (never leak stack traces).
 */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  let error = err;

  if (!(error instanceof ApiError)) {
    if (error.name === "ValidationError") {
      error = ApiError.badRequest("Validation failed", Object.values(error.errors).map((e) => e.message));
    } else if (error.name === "CastError") {
      error = ApiError.badRequest(`Invalid ${error.path}: ${error.value}`);
    } else if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || "field";
      error = ApiError.conflict(`Duplicate value for ${field}`);
    } else if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      error = ApiError.unauthorized("Invalid or expired token");
    } else {
      error = ApiError.internal(isProd ? "Something went wrong" : error.message);
    }
  }

  if (!error.isOperational) {
    logger.error(err.stack || err.message);
  } else if (error.statusCode >= 500) {
    logger.error(error.message);
  }

  res.status(error.statusCode).json({
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
    ...(isProd ? {} : { stack: err.stack }),
  });
}

module.exports = errorMiddleware;
