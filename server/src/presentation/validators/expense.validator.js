const Joi = require("joi");

// Either a Google placeId (from an autocomplete pick) or raw lat/lng
// (from device GPS / map pin drop) — never both required, both optional.
const locationSchema = Joi.object({
  placeId: Joi.string().optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
}).or("placeId", "lat");

const create = Joi.object({
  categoryId: Joi.string().hex().length(24).required(),
  type: Joi.string().valid("expense", "income").default("expense"),
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).uppercase().default("INR"),
  note: Joi.string().allow("").max(500).default(""),
  date: Joi.date().iso().optional(),
  tags: Joi.array().items(Joi.string().max(30)).default([]),
  location: locationSchema.optional(),
});

const update = Joi.object({
  categoryId: Joi.string().hex().length(24).optional(),
  type: Joi.string().valid("expense", "income").optional(),
  amount: Joi.number().positive().optional(),
  currency: Joi.string().length(3).uppercase().optional(),
  note: Joi.string().allow("").max(500).optional(),
  date: Joi.date().iso().optional(),
  tags: Joi.array().items(Joi.string().max(30)).optional(),
  location: locationSchema.optional(),
}).min(1);

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  category: Joi.string().hex().length(24).optional(),
  type: Joi.string().valid("expense", "income").optional(),
});

const nearbyQuery = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  radiusKm: Joi.number().positive().max(100).default(5),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

const mapQuery = Joi.object({
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
});

module.exports = { create, update, listQuery, nearbyQuery, mapQuery };
