const Joi = require("joi");

const create = Joi.object({
  categoryId: Joi.string().hex().length(24).required(),
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  limitAmount: Joi.number().positive().required(),
  alertThresholdPercent: Joi.number().min(1).max(100).default(80),
});

const update = Joi.object({
  limitAmount: Joi.number().positive().optional(),
  alertThresholdPercent: Joi.number().min(1).max(100).optional(),
}).min(1);

const listQuery = Joi.object({
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
});

module.exports = { create, update, listQuery };
