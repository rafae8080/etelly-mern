import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name:        { type: String, required: true },
    category:    { type: String, required: true },
    quantity:    { type: Number, required: true, min: 0 },
    unit:        { type: String, default: "pcs" },
    minQuantity: { type: Number, required: true, min: 0 },
    barangay:    { type: String, required: true },
    expiryDate:  { type: Date, default: null },
    donatedBy:   [{ type: String }],
  },
  { timestamps: true },
);

export default mongoose.model("InventoryItem", schema);
