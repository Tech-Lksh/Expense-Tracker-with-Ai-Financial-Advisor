const ApiError = require("../../utils/ApiError");
const logger = require("../../config/logger");

const USER_AGENT = "SpendWise-Tracker/1.0 (lokeshpardhi161@gmail.com)";

/**
 * Address string -> Coordinates + Place ID using Nominatim Search
 */
async function geocodeAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=in`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) {
      throw new Error(`Nominatim geocode returned status: ${res.status}`);
    }

    const results = await res.json();
    const result = results[0];

    if (!result) {
      throw ApiError.notFound("No location found for that address");
    }

    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      formattedAddress: result.display_name,
      placeId: `osm_${result.osm_type}_${result.osm_id}`,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.error(`OpenStreetMap Geocoding error: ${err.message}`);
    throw ApiError.serviceUnavailable("OpenStreetMap geocoding failed");
  }
}

/**
 * Coordinates -> Address string using Nominatim Reverse Geocoding
 */
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) {
      throw new Error(`Nominatim reverse geocode returned status: ${res.status}`);
    }

    const result = await res.json();

    if (!result || !result.display_name) {
      throw ApiError.notFound("No address found for that location");
    }

    return {
      formattedAddress: result.display_name,
      placeId: `osm_${result.osm_type || "node"}_${result.osm_id || ""}`,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.error(`OpenStreetMap Reverse Geocoding error: ${err.message}`);
    throw ApiError.serviceUnavailable("OpenStreetMap reverse geocoding failed");
  }
}

module.exports = { geocodeAddress, reverseGeocode };
