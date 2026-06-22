const ApiError = require("../../utils/ApiError");
const logger = require("../../config/logger");

const USER_AGENT = "SpendWise-Tracker/1.0 (lokeshpardhi161@gmail.com)";

/**
 * OpenStreetMap Nominatim Search -> list of place suggestions,
 * mapped to match Google Autocomplete signatures.
 */
function matchesInput(tags, input) {
  if (!tags) return false;
  const searchStr = input.toLowerCase();

  // Synonyms and category mapping
  const synonyms = {
    kirana: ["grocery", "convenience", "supermarket", "general", "shop", "store", "dukan"],
    grocery: ["kirana", "convenience", "supermarket", "general", "shop", "store", "dukan"],
    medical: ["pharmacy", "chemist", "medicine", "health", "hospital", "clinic", "dawakhana"],
    medicine: ["pharmacy", "chemist", "medical", "health", "hospital", "clinic", "dawakhana"],
    pharmacy: ["medical", "chemist", "medicine", "health", "hospital", "clinic", "dawakhana"],
    cafe: ["restaurant", "coffee", "tea", "bakery", "food", "hotel"],
    restaurant: ["cafe", "food", "hotel", "dhaba", "canteen"],
    hotel: ["restaurant", "cafe", "tourism", "hostel", "lodging"]
  };

  const name = (tags.name || "").toLowerCase();
  const shop = (tags.shop || "").toLowerCase();
  const amenity = (tags.amenity || "").toLowerCase();
  const tourism = (tags.tourism || "").toLowerCase();

  // Direct match
  if (name.includes(searchStr) || shop.includes(searchStr) || amenity.includes(searchStr) || tourism.includes(searchStr)) {
    return true;
  }

  // Synonym match
  for (const [key, list] of Object.entries(synonyms)) {
    if (searchStr.includes(key)) {
      if (list.some(syn => shop.includes(syn) || amenity.includes(syn) || tourism.includes(syn) || name.includes(syn))) {
        return true;
      }
    }
  }

  return false;
}

async function searchOverpass(input, lat, lng) {
  try {
    const offset = 0.03; // ~3km radius
    const south = lat - offset;
    const west = lng - offset;
    const north = lat + offset;
    const east = lng + offset;

    const query = `[out:json][timeout:5];
(
  node["shop"](${south},${west},${north},${east});
  node["amenity"](${south},${west},${north},${east});
  node["tourism"](${south},${west},${north},${east});
  way["shop"](${south},${west},${north},${east});
  way["amenity"](${south},${west},${north},${east});
);
out center 50;`;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: "data=" + encodeURIComponent(query),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT
      }
    });

    if (!res.ok) {
      logger.warn(`Overpass API search failed: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const elements = data.elements || [];

    const matches = [];
    for (const item of elements) {
      if (item.tags && matchesInput(item.tags, input)) {
        matches.push(item);
      }
    }

    return matches.map((item) => {
      const osmType = item.type || "node";
      const osmId = item.id || "";
      const latVal = item.lat || item.center?.lat || "";
      const lonVal = item.lon || item.center?.lon || "";
      const placeId = `osm_${osmType}_${osmId}_${latVal}_${lonVal}`;

      const name = item.tags.name || (item.tags.shop ? `${item.tags.shop.replace(/_/g, " ")} shop` : item.tags.amenity || "Local Shop");
      const street = item.tags["addr:street"] || item.tags["addr:place"] || "";
      const city = item.tags["addr:city"] || "";
      const description = `${name}${street ? ", " + street : ""}${city ? ", " + city : ""}`;

      return {
        placeId,
        description,
        mainText: name,
        secondaryText: `${street} ${city}`.trim() || `${item.tags.shop || item.tags.amenity || 'Local Shop'}`
      };
    });
  } catch (err) {
    logger.warn(`Overpass API query failed: ${err.message}`);
    return [];
  }
}

async function fetchNominatim(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Nominatim search returned status: ${res.status}`);
  }

  const results = await res.json();

  return results.map((item) => {
    const osmType = item.osm_type || "node";
    const osmId = item.osm_id || "";
    const lat = item.lat || "";
    const lon = item.lon || "";
    const placeId = `osm_${osmType}_${osmId}_${lat}_${lon}`;

    const parts = item.display_name.split(",");
    const mainText = parts[0]?.trim() || "";
    const secondaryText = parts.slice(1).join(",").trim() || "";

    return {
      placeId,
      description: item.display_name,
      mainText,
      secondaryText,
    };
  });
}

/**
 * OpenStreetMap Nominatim Search + Overpass local POI search -> list of place suggestions,
 * mapped to match Google Autocomplete signatures.
 */
async function autocomplete(input, biasCoords = null) {
  try {
    let nominatimResults = [];
    let overpassResults = [];

    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&limit=8&addressdetails=1&countrycodes=in`;

    // Bias results if coords are available
    if (biasCoords && biasCoords.lat != null && biasCoords.lng != null) {
      const lat = parseFloat(biasCoords.lat);
      const lng = parseFloat(biasCoords.lng);
      const offset = 0.5; // Bounding box range (approx 50km)
      url += `&viewbox=${lng - offset},${lat + offset},${lng + offset},${lat - offset}`;

      // Perform parallel Nominatim and Overpass lookups
      [nominatimResults, overpassResults] = await Promise.all([
        fetchNominatim(url),
        searchOverpass(input, lat, lng)
      ]);
    } else {
      nominatimResults = await fetchNominatim(url);
    }

    // Combine results (prioritize local Overpass POI matches first)
    const combined = [...overpassResults, ...nominatimResults];

    // Deduplicate by placeId
    const seen = new Set();
    return combined.filter((item) => {
      if (seen.has(item.placeId)) return false;
      seen.add(item.placeId);
      return true;
    }).slice(0, 10);
  } catch (err) {
    logger.error(`OpenStreetMap Autocomplete error: ${err.message}`);
    throw ApiError.serviceUnavailable("OpenStreetMap autocomplete failed");
  }
}

/**
 * Resolves osm placeId to coordinates and full address using Nominatim Lookup.
 */
async function getPlaceDetails(placeId) {
  try {
    if (placeId && placeId.startsWith("osm_")) {
      const parts = placeId.split("_");
      const osmType = parts[1];
      const osmId = parts[2];
      const latVal = parts[3];
      const lonVal = parts[4];

      if (osmId) {
        const typePrefix = osmType.substring(0, 1).toUpperCase(); // 'N' | 'W' | 'R'
        const lookupUrl = `https://nominatim.openstreetmap.org/lookup?osm_ids=${typePrefix}${osmId}&format=json`;
        
        const res = await fetch(lookupUrl, {
          headers: { "User-Agent": USER_AGENT },
        });

        if (res.ok) {
          const lookupResults = await res.json();
          if (lookupResults && lookupResults.length > 0) {
            const item = lookupResults[0];
            const parts = item.display_name.split(",");
            return {
              name: parts[0]?.trim() || "Location",
              formattedAddress: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            };
          }
        }
      }

      // Fallback to parsed parameters if network lookup failed
      if (latVal && lonVal) {
        return {
          name: "Location",
          formattedAddress: `OSM ${osmType} ${osmId}`,
          lat: parseFloat(latVal),
          lng: parseFloat(lonVal),
        };
      }
    }
    
    throw ApiError.notFound("Place details not found");
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.error(`OpenStreetMap Place Details error: ${err.message}`);
    throw ApiError.serviceUnavailable("OpenStreetMap details lookup failed");
  }
}

module.exports = { autocomplete, getPlaceDetails };
