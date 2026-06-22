const { Client } = require("@googlemaps/google-maps-services-js");
const { googleMaps } = require("./env");

// Single shared client instance for all Google Maps Platform calls
// (Geocoding, Places Autocomplete, Place Details). Centralizing the API key
// here means no other module ever touches process.env directly.
const googleMapsClient = new Client({});

module.exports = {
  googleMapsClient,
  apiKey: googleMaps.apiKey,
};
