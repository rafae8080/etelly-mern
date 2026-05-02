// models/Alert.js
import mongoose from "mongoose";

const actionLogSchema = new mongoose.Schema({
  action: { type: String, enum: ["created", "dismissed"] },
  by:     { type: String, required: true },
  at:     { type: Date, default: Date.now },
});

const AlertSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ["system", "residents", "CDRRMO"],
    required: true,
  },
  type: {
    type: String,
    enum: ["flood", "rainfall", "earthquake", "lahar", "typhoon", "other"],
    required: true,
  },
  severity: {
    type: String,
    enum: ["watch", "warning", "critical", "evacuate"],
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, default: "" },
  barangays: [String],
  raw: String,
  isActive: { type: Boolean, default: true },
  actionLog: [actionLogSchema],
  _dedupeKey: { type: String, index: true },
  rawKey: { type: String, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: Date,
});

export default mongoose.model("Alert", AlertSchema);
