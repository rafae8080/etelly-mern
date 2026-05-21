import mongoose from "mongoose";

const FcmTokenSchema = new mongoose.Schema({
  token:    { type: String, required: true, unique: true },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  platform: { type: String, enum: ["android", "ios"], required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("FcmToken", FcmTokenSchema);
