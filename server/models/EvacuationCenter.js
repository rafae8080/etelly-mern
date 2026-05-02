import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name:      { type: String, required: true },
    location:  { type: String, required: true },
    barangay:  { type: String, required: true, index: true },
    capacity:  { type: Number, required: true, min: 1, default: 100 },
    occupancy: { type: Number, default: 0, min: 0 },
    imageUrl:  { type: String, default: "" },
    updatedBy: {
      userId:   mongoose.Schema.Types.ObjectId,
      userName: String,
    },
  },
  { timestamps: true },
);

export default mongoose.model("EvacuationCenter", schema);
