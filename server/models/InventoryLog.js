import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    itemId:   { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    itemName: String,
    barangay: String,
    action: {
      type: String,
      enum: ["item_created", "item_updated", "item_deleted"],
      required: true,
    },
    field:         String,
    previousValue: mongoose.Schema.Types.Mixed,
    newValue:      mongoose.Schema.Types.Mixed,
    user: {
      id:   mongoose.Schema.Types.ObjectId,
      name: String,
    },
  },
  { timestamps: true },
);

export default mongoose.model("InventoryLog", schema);
