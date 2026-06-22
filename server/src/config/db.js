const mongoose = require("mongoose");
const { mongo } = require("./env");
const logger = require("./logger");

mongoose.set("strictQuery", true);

let isConnected = false;

async function connectDB() {
  if (isConnected) return mongoose.connection;

  mongoose.connection.on("connected", () => {
    isConnected = true;
    logger.info("MongoDB connected");
  });

  mongoose.connection.on("error", (err) => {
    logger.error(`MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    logger.warn("MongoDB disconnected");
  });

  await mongoose.connect(mongo.uri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
  isConnected = false;
}

module.exports = { connectDB, disconnectDB, mongoose };
