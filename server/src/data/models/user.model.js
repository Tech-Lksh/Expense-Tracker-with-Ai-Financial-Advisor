const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const homeLocationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: { type: [Number], required: true }, // [lng, lat]
    formattedAddress: { type: String, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    refreshTokenHash: { type: String, select: false, default: null },
    defaultCurrency: { type: String, default: "INR" },
    homeLocation: {
      type: homeLocationSchema,
      default: null,
    },
    passwordResetToken: { type: String, select: false, default: null },
    passwordResetExpires: { type: Date, select: false, default: null },
  },
  { timestamps: true }
);

userSchema.index({ homeLocation: "2dsphere" });

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokenHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
