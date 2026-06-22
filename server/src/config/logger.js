const winston = require("winston");
const path = require("path");
const { env, logLevel, isProd } = require("./env");

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack }) => {
    return `${ts} [${level}]: ${stack || message}`;
  })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const transports = [
  new winston.transports.Console({
    silent: env === "test",
  }),
];

// File transports are skipped in test to keep CI output clean and avoid
// filesystem writes in ephemeral test containers.
if (env !== "test") {
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), "logs", "error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), "logs", "combined.log"),
    })
  );
}

const logger = winston.createLogger({
  level: logLevel,
  format: isProd ? prodFormat : devFormat,
  transports,
  exitOnError: false,
});

// Stream adapter so morgan (HTTP request logging) can pipe through Winston.
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
