import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import User from "../models/user.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

await mongoose.connect(process.env.MONGO_URI);
console.log("Connected to MongoDB...");

const existing = await User.findOne({ email: "admin@etelly.com" });

if (existing) {
  console.log("⚠️  Admin already exists!");
} else {
  const hashed = await bcrypt.hash("Admin@1234", 12);
  await User.create({
    name: "Admin",
    email: "admin@etelly.com",
    password: hashed,
    role: "admin",
  });
  console.log("✅ Admin account created!");
  console.log("   Email:    admin@etelly.com");
  console.log("   Password: Admin@1234");
}

await mongoose.disconnect();
process.exit(0);
