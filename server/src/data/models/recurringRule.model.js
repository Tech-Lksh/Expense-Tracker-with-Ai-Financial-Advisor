const mongoose = require("mongoose");

const recurringLocationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
    placeId: { type: String, default: null },
    formattedAddress: { type: String, default: null },
    name: { type: String, default: null },
  },
  { _id: false }
);

const recurringRuleSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    amount: { type: Number, required: true, min: 0.01 },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
    nextRunDate: { type: Date, required: true },
    location: { type: recurringLocationSchema, default: null },
    isActive: { type: Boolean, default: true },
    customCategory: { type: String, default: null },
  },
  { timestamps: true }
);

recurringRuleSchema.index({ isActive: 1, nextRunDate: 1 });

module.exports = mongoose.model("RecurringRule", recurringRuleSchema);
