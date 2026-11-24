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

// ---- CORS: Allow all origins permanently with full credentials & preflight support ----
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// Also mount standard cors middleware supporting all origins
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.options("*", cors({ origin: true, credentials: true }));

// ---- Security & parsing middleware (presentation-layer cross-cutting concerns) ----
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
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
