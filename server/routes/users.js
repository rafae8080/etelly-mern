import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/user.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// GET all users
router.get("/", protect, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// POST create new user
router.post("/", protect, async (req, res) => {
  const { email, firstName, lastName, role, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 12);
    const fullName = `${firstName} ${lastName}`.trim();

    const newUser = await User.create({
      name: fullName,
      email,
      password: hashed,
      role,
    });

    res.status(201).json({
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create user" });
  }
});

// PUT update user
router.put("/:id", protect, async (req, res) => {
  const { firstName, lastName, role, password } = req.body;
  try {
    const fullName = `${firstName} ${lastName}`.trim();
    const updateData = { name: fullName, role };

    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    const updated = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    }).select("-password");

    if (!updated) return res.status(404).json({ message: "User not found" });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update user" });
  }
});

// DELETE user
router.delete("/:id", protect, async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found" });

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user" });
  }
});

export default router;
