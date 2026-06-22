const Joi = require("joi");

const create = Joi.object({
  name: Joi.string().trim().min(1).max(50).required(),
  icon: Joi.string().max(50).optional(),
  colorCode: Joi.string()
    .pattern(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

const update = Joi.object({
  name: Joi.string().trim().min(1).max(50).optional(),
  icon: Joi.string().max(50).optional(),
  colorCode: Joi.string()
    .pattern(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
}).min(1);

module.exports = { create, update };
