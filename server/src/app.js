const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");

const { clientUrl, apiVersion, env } = require("./config/env");
const logger = require("./config/logger");
const apiRoutes = require("./presentation/routes");
const { apiLimiter } = require("./presentation/middlewares/rateLimiter.middleware");
const notFoundMiddleware = require("./presentation/middlewares/notFound.middleware");
const errorMiddleware = require("./presentation/middlewares/error.middleware");
const ApiResponse = require("./utils/ApiResponse");

const app = express();

// Trust reverse proxy (Render, Cloudflare, Heroku) so req.ip reflects real client IP
app.set("trust proxy", 1);

// Parse configured origins (supports comma-separated URLs and trims trailing slashes)
const configuredOrigins = (clientUrl || "")
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  "http://localhost:5173",
  "http://localhost:3000",
  "https://expense-tracker-with-ai-financial-a.vercel.app",
]);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, "");

    // Allow configured origins or any Vercel preview deployment for this project
    if (
      allowedOrigins.has(normalizedOrigin) ||
      /^https:\/\/expense-tracker-with-ai-financial-.*\.vercel\.app$/.test(normalizedOrigin)
    ) {
      return callback(null, true);
    }

    logger.warn(`CORS blocked request from origin: ${origin}`);
    return callback(new Error(`CORS policy does not allow access from ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  optionsSuccessStatus: 204,
};

// ---- Security & parsing middleware (presentation-layer cross-cutting concerns) ----
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(mongoSanitize()); // strips $/. operators from req.body/query/params to block NoSQL injection
app.use(hpp()); // guards against HTTP parameter pollution (?a=1&a=2)

if (env !== "test") {
  app.use(morgan("combined", { stream: logger.stream }));
}

app.use(`/api/${apiVersion}`, apiLimiter);

// ---- API documentation ----
try {
  const openapiDocument = YAML.load(path.join(__dirname, "..", "docs", "openapi.yaml"));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));
} catch (err) {
  logger.warn(`Swagger UI not mounted: ${err.message}`);
}

// ---- Health check (used by Docker/load balancer liveness probes) ----
app.get("/health", (req, res) => {
  new ApiResponse(200, { uptime: process.uptime() }, "OK").send(res);
});

// ---- Versioned API routes ----
app.use(`/api/${apiVersion}`, apiRoutes);

// ---- 404 + centralized error handling (must be registered last) ----
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
