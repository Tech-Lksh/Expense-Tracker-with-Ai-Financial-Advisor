const router = require("express").Router();
const controller = require("../controllers/aiAdvisor.controller");
const requireAuth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const schema = require("../validators/aiAdvisor.validator");

router.use(requireAuth);

router.post("/chat", validate(schema.chat), controller.chat);
router.get("/insights", controller.getInsights);
router.get("/history", controller.getHistory);
router.delete("/history", controller.clearHistory);

module.exports = router;
