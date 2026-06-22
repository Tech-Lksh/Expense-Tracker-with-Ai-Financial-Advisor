const locationService = require("../../business/services/location.service");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");

const autocomplete = asyncHandler(async (req, res) => {
  const { input, lat, lng } = req.query;
  const results = await locationService.autocomplete(input, lat != null ? { lat, lng } : undefined);
  new ApiResponse(200, results).send(res);
});

const placeDetails = asyncHandler(async (req, res) => {
  const details = await locationService.getPlaceDetails(req.query.placeId);
  new ApiResponse(200, details).send(res);
});

const geocode = asyncHandler(async (req, res) => {
  const result = await locationService.geocodeAddress(req.body.address);
  new ApiResponse(200, result).send(res);
});

const reverseGeocode = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;
  const result = await locationService.reverseGeocode(lat, lng);
  new ApiResponse(200, result).send(res);
});

module.exports = { autocomplete, placeDetails, geocode, reverseGeocode };
