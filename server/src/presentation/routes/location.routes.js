const router = require("express").Router();
const controller = require("../controllers/location.controller");
const validate = require("../middlewares/validate.middleware");
const requireAuth = require("../middlewares/auth.middleware");
const { geoLimiter } = require("../middlewares/rateLimiter.middleware");
const schema = require("../validators/location.validator");

router.use(requireAuth, geoLimiter);

router.get("/autocomplete", validate(schema.autocompleteQuery, "query"), controller.autocomplete);
router.get("/place-details", validate(schema.placeDetailsQuery, "query"), controller.placeDetails);
router.post("/geocode", validate(schema.geocodeBody), controller.geocode);
router.post("/reverse-geocode", validate(schema.reverseGeocodeBody), controller.reverseGeocode);

module.exports = router;
