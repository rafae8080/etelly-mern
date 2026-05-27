import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "user", "barangay_official"],
      default: "user",
    },
    mustChangePassword: { type: Boolean, default: false },
    contactEmail: { type: String, default: "" },
    address: { type: String, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
