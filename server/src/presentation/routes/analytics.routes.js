const router = require("express").Router();
const controller = require("../controllers/analytics.controller");
const requireAuth = require("../middlewares/auth.middleware");

router.use(requireAuth);

router.get("/category-breakdown", controller.categoryBreakdown);
router.get("/monthly-trend", controller.monthlyTrend);
router.get("/trend", controller.trend);

module.exports = router;
