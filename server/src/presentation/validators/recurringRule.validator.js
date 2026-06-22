const Joi = require("joi");

const locationSchema = Joi.object({
  placeId: Joi.string().optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
}).or("placeId", "lat");

const create = Joi.object({
  categoryId: Joi.string().hex().length(24).required(),
  amount: Joi.number().positive().required(),
  note: Joi.string().allow("").max(500).default(""),
  frequency: Joi.string().valid("daily", "weekly", "monthly").required(),
  startDate: Joi.date().iso().optional(),
  location: locationSchema.optional(),
});

const update = Joi.object({
  amount: Joi.number().positive().optional(),
  note: Joi.string().allow("").max(500).optional(),
  frequency: Joi.string().valid("daily", "weekly", "monthly").optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

module.exports = { create, update };
