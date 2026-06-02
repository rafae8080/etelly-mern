import mongoose from "mongoose";

const pledgeSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name:      { type: String, required: true },
  phone:     { type: String, default: null },
  message:   { type: String, default: "" },
  status:    { type: String, enum: ["pending","accepted","declined","withdrawn"], default: "pending" },
  // Helper's location captured when they offered, so the requester can see how
  // far each helper is and prioritize the closest. Optional — absent if the
  // helper denied location permission.
  pledgerLat:      { type: Number, default: null },
  pledgerLng:      { type: Number, default: null },
  pledgerBarangay: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const actionLogSchema = new mongoose.Schema({
  action:  { type: String, enum: ["approved","matched","released","rejected","fulfilled","cancelled"] },
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
  category:        { type: String, enum: ["food","water","clothing","medicine","hygiene","shelter","other"], required: true },
  itemDescription: { type: String, required: true },
  quantity:        { type: Number, required: true, min: 1 },
  unit:            { type: String, default: "pcs" },
  reason:          { type: String, default: "" },

  // Workflow
  status: { type: String, enum: ["pending","open","approved","matched","rejected","fulfilled","cancelled"], default: "open" },

  // Full audit trail
  actionLog: [actionLogSchema],

  // Peer-to-peer pledge tracking
  pledges:          { type: [pledgeSchema], default: [] },
  matchedPledgerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  deliveredAt:      { type: Date, default: null },

  // Mobile-app fields (optional — absent on web-form submissions)
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  resourceId:  { type: String, default: null },
  requestType: { type: String, enum: ["standard","emergency"], default: "standard" },
  urgent:      { type: Boolean, default: false },
  gpsLat:      { type: Number, default: null },
  gpsLng:      { type: Number, default: null },
  phone:       { type: String, default: null },
}, { timestamps: true });

export default mongoose.model("ResourceRequest", ResourceRequestSchema);
