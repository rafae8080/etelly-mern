import mongoose from "mongoose";

const actionLogSchema = new mongoose.Schema({
  action: { type: String, enum: ["scheduled", "received", "cancelled"] },
  by:     { type: String, required: true },
  byId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  note:   { type: String, default: "" },
  at:     { type: Date, default: Date.now },
}, { _id: false });

const ResourceDonationSchema = new mongoose.Schema({
  // Donor info (from mobile profile)
  donorName:  { type: String, required: true },
  donorEmail: { type: String, required: true },
  barangay:   { type: String, required: true },

  // What they're donating
  category:        { type: String, enum: ["food", "water", "clothing", "medicine", "hygiene", "shelter", "other"], required: true },
  itemDescription: { type: String, required: true },
  quantity:        { type: Number, required: true, min: 1 },
  unit:            { type: String, default: "pcs" },

  // Reference code shown to donor for drop-off verification
  referenceCode: { type: String, unique: true },

  // Workflow
  status: { type: String, enum: ["offered", "scheduled", "received", "cancelled"], default: "offered" },

  // Set when admin schedules the drop-off
  dropOffPoint:    { type: String, default: "" },
  scheduledWindow: { type: String, default: "" },

  // Full audit trail
  actionLog: [actionLogSchema],

  // Mobile-app fields (optional — absent on web-form submissions)
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  resourceId:    { type: String, default: null },
  phone:         { type: String, default: null },
  dob:           { type: Date, default: null },
  gpsLat:        { type: Number, default: null },
  gpsLng:        { type: Number, default: null },
  pickupAddress: { type: String, default: null },
  isAnonymous:   { type: Boolean, default: false },
}, { timestamps: true });

// Generate reference code before saving if not set
ResourceDonationSchema.pre("save", function (next) {
  if (!this.referenceCode) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "DON-";
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    this.referenceCode = code;
  }
  next();
});

export default mongoose.model("ResourceDonation", ResourceDonationSchema);
