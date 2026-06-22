jest.mock("../../../src/config/redis", () => ({
  redisClient: { get: jest.fn(), set: jest.fn() },
}));
jest.mock("../../../src/integrations/googleMaps/geocoding.client");
jest.mock("../../../src/integrations/googleMaps/places.client");

const { redisClient } = require("../../../src/config/redis");
const geocodingClient = require("../../../src/integrations/googleMaps/geocoding.client");
const placesClient = require("../../../src/integrations/googleMaps/places.client");
const locationService = require("../../../src/business/services/location.service");

describe("locationService caching", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a cached geocode result without calling the Google API", async () => {
    const cached = { lat: 23.25, lng: 77.41, formattedAddress: "Bhopal, MP", placeId: "p1" };
    redisClient.get.mockResolvedValue(JSON.stringify(cached));

    const result = await locationService.geocodeAddress("Bhopal");

    expect(result).toEqual(cached);
    expect(geocodingClient.geocodeAddress).not.toHaveBeenCalled();
  });

  it("calls the Google API and caches the result on a cache miss", async () => {
    redisClient.get.mockResolvedValue(null);
    const fresh = { lat: 23.25, lng: 77.41, formattedAddress: "Bhopal, MP", placeId: "p1" };
    geocodingClient.geocodeAddress.mockResolvedValue(fresh);

    const result = await locationService.geocodeAddress("Bhopal");

    expect(result).toEqual(fresh);
    expect(redisClient.set).toHaveBeenCalledWith(
      expect.stringContaining("geo:geocode:"),
      JSON.stringify(fresh),
      "EX",
      expect.any(Number)
    );
  });

  it("falls back to a live API call if the cache read itself fails", async () => {
    redisClient.get.mockRejectedValue(new Error("Redis unreachable"));
    const fresh = { placeId: "p2", name: "Cafe", formattedAddress: "MP Nagar", lat: 1, lng: 2 };
    placesClient.getPlaceDetails.mockResolvedValue(fresh);

    const result = await locationService.getPlaceDetails("p2");

    expect(result).toEqual(fresh);
  });

  it("resolveExpenseLocation builds a GeoJSON point from a placeId", async () => {
    redisClient.get.mockResolvedValue(null);
    placesClient.getPlaceDetails.mockResolvedValue({
      name: "Starbucks",
      formattedAddress: "MP Nagar, Bhopal",
      lat: 23.25,
      lng: 77.41,
    });

    const location = await locationService.resolveExpenseLocation({ placeId: "abc" });

    expect(location).toEqual({
      type: "Point",
      coordinates: [77.41, 23.25],
      placeId: "abc",
      formattedAddress: "MP Nagar, Bhopal",
      name: "Starbucks",
    });
  });

  it("resolveExpenseLocation returns null when neither placeId nor coordinates are given", async () => {
    const location = await locationService.resolveExpenseLocation({});
    expect(location).toBeNull();
  });
});
