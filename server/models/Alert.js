// models/Alert.js
import mongoose from "mongoose";

const AlertSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ["system", "PAGASA", "PHIVOLCS", "NDRRMC", "OCD"],
    required: true,
  },
  type: {
    type: String,
    enum: [
      "flood",
      "river",
      "rainfall",
      "earthquake",
      "lahar",
      "typhoon",
      "other",
    ],
    required: true,
  },
  severity: {
    type: String,
    enum: ["watch", "warning", "critical", "evacuate"],
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, default: "Antipolo City, Rizal" },
  barangays: [String],
  raw: String,
  isActive: { type: Boolean, default: true },
  _dedupeKey: { type: String, index: true },
  rawKey: { type: String, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: Date,
});

export default mongoose.model("Alert", AlertSchema);
