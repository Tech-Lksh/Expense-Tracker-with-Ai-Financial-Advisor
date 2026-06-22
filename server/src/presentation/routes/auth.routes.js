const router = require("express").Router();
const controller = require("../controllers/auth.controller");
const validate = require("../middlewares/validate.middleware");
const requireAuth = require("../middlewares/auth.middleware");
const { authLimiter } = require("../middlewares/rateLimiter.middleware");
const schema = require("../validators/auth.validator");

router.post("/register", authLimiter, validate(schema.register), controller.register);
router.post("/login", authLimiter, validate(schema.login), controller.login);
router.post("/refresh", authLimiter, validate(schema.refresh), controller.refresh);
router.post("/logout", requireAuth, controller.logout);
router.get("/me", requireAuth, controller.me);
router.post("/forgot-password", authLimiter, validate(schema.forgotPassword), controller.forgotPassword);
router.post("/reset-password", authLimiter, validate(schema.resetPassword), controller.resetPassword);

module.exports = router;
