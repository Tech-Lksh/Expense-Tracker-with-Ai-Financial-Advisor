const router = require("express").Router();
const controller = require("../controllers/expense.controller");
const validate = require("../middlewares/validate.middleware");
const requireAuth = require("../middlewares/auth.middleware");
const schema = require("../validators/expense.validator");

router.use(requireAuth);

// IMPORTANT: these static-path routes must be declared before the
// "/:id" routes below, otherwise Express would match "nearby" or
// "map-data" as an :id value and 400 on the ObjectId cast.
router.get("/nearby", validate(schema.nearbyQuery, "query"), controller.nearby);
router.get("/map-data", validate(schema.mapQuery, "query"), controller.mapData);
router.get("/summary", validate(schema.mapQuery, "query"), controller.getSummary);

router.post("/", validate(schema.create), controller.create);
router.get("/", validate(schema.listQuery, "query"), controller.list);
router.get("/:id", controller.getById);
router.patch("/:id", validate(schema.update), controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
