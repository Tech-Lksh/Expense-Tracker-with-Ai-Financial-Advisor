const router = require("express").Router();

router.use("/auth", require("./auth.routes"));
router.use("/categories", require("./category.routes"));
router.use("/expenses", require("./expense.routes"));
router.use("/budgets", require("./budget.routes"));
router.use("/recurring-rules", require("./recurringRule.routes"));
router.use("/analytics", require("./analytics.routes"));
router.use("/locations", require("./location.routes"));
router.use("/ai-advisor", require("./aiAdvisor.routes"));

module.exports = router;
