import mongoose from "mongoose";

const actionLogSchema = new mongoose.Schema({
  action:  { type: String, enum: ["approved", "rejected", "fulfilled", "cancelled"] },
  by:      { type: String, required: true },
  byId:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  note:    { type: String, default: "" },
  at:      { type: Date, default: Date.now },
}, { _id: false });

const ResourceRequestSchema = new mongoose.Schema({
  // Requester info (from mobile profile)
  requesterName:  { type: String, required: true },
  requesterEmail: { type: String, required: true },
  barangay:       { type: String, required: true },
  address:        { type: String, required: true },

  // What they need
  category:        { type: String, enum: ["food", "water", "clothing", "medicine", "hygiene", "shelter", "other"], required: true },
  itemDescription: { type: String, required: true },
  quantity:        { type: Number, required: true, min: 1 },
  unit:            { type: String, default: "pcs" },
  reason:          { type: String, default: "" },

  // Workflow
  status: { type: String, enum: ["pending", "approved", "rejected", "fulfilled", "cancelled"], default: "pending" },

  // Set at creation if another request from same address+category is already active
  householdFlag: { type: Boolean, default: false },

  // Full audit trail
  actionLog: [actionLogSchema],
}, { timestamps: true });

export default mongoose.model("ResourceRequest", ResourceRequestSchema);
