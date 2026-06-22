/**
 * Wraps an async Express handler so any rejected promise is forwarded to
 * next(err) automatically, eliminating repetitive try/catch in every
 * controller method.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
