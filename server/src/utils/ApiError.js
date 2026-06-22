/**
 * ApiError represents a known, "operational" failure (bad input, not found,
 * unauthorized, etc.) as opposed to a programming bug. The global error
 * middleware uses `isOperational` to decide whether to leak the message to
 * the client or hide it behind a generic 500.
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad request", details = null) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflict") {
    return new ApiError(409, message);
  }

  static tooManyRequests(message = "Too many requests") {
    return new ApiError(429, message);
  }

  static internal(message = "Internal server error") {
    return new ApiError(500, message, null, false);
  }

  static serviceUnavailable(message = "Upstream service unavailable") {
    return new ApiError(503, message, null, false);
  }
}

module.exports = ApiError;
