const { redisClient } = require("../../config/redis");
const geocodingClient = require("../../integrations/googleMaps/geocoding.client");
const placesClient = require("../../integrations/googleMaps/places.client");
const logger = require("../../config/logger");

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 1 week — addresses rarely change

/**
 * Thin caching layer in front of the Google Maps clients. Geocoding and
 * Places calls are billed per request, so caching identical lookups (e.g.
 * the same "Starbucks MP Nagar" search typed by many users) materially cuts
 * cost in a real deployment.
 */
async function withCache(key, fetchFn) {
  try {
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    // Cache failures should never break the feature — fall through to a
    // live API call and just log the degradation.
    logger.warn(`Location cache read failed: ${err.message}`);
  }

  const result = await fetchFn();

  try {
    await redisClient.set(key, JSON.stringify(result), "EX", CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn(`Location cache write failed: ${err.message}`);
  }

  return result;
}

class LocationService {
  async autocomplete(input, biasCoords) {
    const cacheKey = `geo:autocomplete:${input.toLowerCase()}:${biasCoords?.lat || ""},${biasCoords?.lng || ""}`;
    return withCache(cacheKey, () => placesClient.autocomplete(input, biasCoords));
  }

  async getPlaceDetails(placeId) {
    const cacheKey = `geo:place:${placeId}`;
    return withCache(cacheKey, () => placesClient.getPlaceDetails(placeId));
  }

  async geocodeAddress(address) {
    const cacheKey = `geo:geocode:${address.toLowerCase()}`;
    return withCache(cacheKey, () => geocodingClient.geocodeAddress(address));
  }

  async reverseGeocode(lat, lng) {
    // Round to ~11m precision so nearby clicks share a cache entry.
    const roundedLat = Number(lat).toFixed(4);
    const roundedLng = Number(lng).toFixed(4);
    const cacheKey = `geo:reverse:${roundedLat},${roundedLng}`;
    return withCache(cacheKey, () => geocodingClient.reverseGeocode(lat, lng));
  }

  /**
   * Resolves whatever location info an "add expense" request supplied
   * (placeId, or raw lat/lng, or nothing) into the canonical GeoJSON shape
   * stored on the Expense document. Returns null if no location was given.
   */
  async resolveExpenseLocation({ placeId, lat, lng }) {
    if (placeId) {
      const details = await this.getPlaceDetails(placeId);
      return {
        type: "Point",
        coordinates: [details.lng, details.lat],
        placeId,
        formattedAddress: details.formattedAddress,
        name: details.name,
      };
    }

    if (lat != null && lng != null) {
      const reverse = await this.reverseGeocode(lat, lng);
      return {
        type: "Point",
        coordinates: [lng, lat],
        placeId: reverse.placeId,
        formattedAddress: reverse.formattedAddress,
        name: null,
      };
    }

    return null;
  }
}

module.exports = new LocationService();
