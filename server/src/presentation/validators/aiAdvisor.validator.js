const Joi = require("joi");

const chat = Joi.object({
  message: Joi.string().required().trim().max(2000),
  history: Joi.array()
    .items(
      Joi.object({
        sender: Joi.string().valid("user", "assistant").required(),
        content: Joi.string().required(),
        timestamp: Joi.date().optional(),
        confidence: Joi.number().optional(),
      })
    )
    .optional(),
});

module.exports = { chat };
