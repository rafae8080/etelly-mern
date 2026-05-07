import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    name:      { type: String, required: true },
    location:  { type: String, required: true },
    barangay:  { type: String, required: true, index: true },
    capacity:  { type: Number, required: true, min: 1, default: 100 },
    occupancy: { type: Number, default: 0, min: 0 },
    lat:       { type: Number, default: null },
    lng:       { type: Number, default: null },
    imageUrl:  { type: String, default: "" },
    available: { type: Boolean, default: true },
    updatedBy: {
      userId:   mongoose.Schema.Types.ObjectId,
      userName: String,
    },
  },
  { timestamps: true },
);

export default mongoose.model("EvacuationCenter", schema);
