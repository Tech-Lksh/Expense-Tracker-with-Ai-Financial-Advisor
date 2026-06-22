const router = require("express").Router();
const controller = require("../controllers/recurringRule.controller");
const validate = require("../middlewares/validate.middleware");
const requireAuth = require("../middlewares/auth.middleware");
const schema = require("../validators/recurringRule.validator");

router.use(requireAuth);

router.post("/", validate(schema.create), controller.create);
router.get("/", controller.list);
router.patch("/:id", validate(schema.update), controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
