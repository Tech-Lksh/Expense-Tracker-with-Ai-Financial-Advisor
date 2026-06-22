const Joi = require("joi");

const autocompleteQuery = Joi.object({
  input: Joi.string().trim().min(1).max(200).required(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
});

const placeDetailsQuery = Joi.object({
  placeId: Joi.string().required(),
});

const geocodeBody = Joi.object({
  address: Joi.string().trim().min(1).max(300).required(),
});

const reverseGeocodeBody = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

module.exports = { autocompleteQuery, placeDetailsQuery, geocodeBody, reverseGeocodeBody };
