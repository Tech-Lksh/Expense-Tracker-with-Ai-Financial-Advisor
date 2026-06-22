const ApiError = require("../../utils/ApiError");

/**
 * Usage: validate(schema, "body" | "query" | "params")
 * Replaces req[property] with the validated/coerced value (e.g. Joi turns
 * "42" into 42 for number fields) so controllers always receive clean data.
 */
function validate(schema, property = "body") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => d.message);
      return next(ApiError.badRequest("Validation failed", details));
    }

    req[property] = value;
    next();
  };
}

module.exports = validate;
