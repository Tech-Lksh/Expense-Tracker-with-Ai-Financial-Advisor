const mongoose = require("mongoose");

/**
 * `location` stores a GeoJSON Point so MongoDB can run native geospatial
 * queries ($near, $geoNear) for the "nearby expenses" and "map view"
 * features. Coordinates are always [longitude, latitude] per GeoJSON spec
 * (note: this is reversed from how Google's APIs return lat/lng).
 */
const locationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true }, // [lng, lat]
    placeId: { type: String, default: null },
    formattedAddress: { type: String, default: null },
    name: { type: String, default: null }, // e.g. "Starbucks, MP Nagar"
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    type: { type: String, enum: ["expense", "income"], default: "expense" },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: "INR" },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    date: { type: Date, required: true, default: Date.now },
    location: { type: locationSchema, default: null },
    recurringRule: { type: mongoose.Schema.Types.ObjectId, ref: "RecurringRule", default: null },
    tags: { type: [String], default: [] },
    customCategory: { type: String, default: null },
  },
  { timestamps: true }
);

expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ user: 1, category: 1 });
expenseSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Expense", expenseSchema);
