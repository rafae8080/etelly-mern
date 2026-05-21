import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import admin from "firebase-admin";
import User from "../models/user.js";
import { protect } from "../middleware/auth.js";
import { initFirebase } from "../services/fcm.js";

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(400)
        .json({ message: "Incorrect username or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res
        .status(400)
        .json({ message: "Incorrect username or password" });

    const token = jwt.sign(
      { id: user._id, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword ?? false,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/register — citizen self-registration (role always "user")
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ message: "Name, email, and password are required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  try {
    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({
      name:  name.trim(),
      email: email.trim().toLowerCase(),
      password: hashed,
      role: "user",
    });

    const token = jwt.sign(
      { id: user._id, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.status(201).json({
      token,
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        mustChangePassword: false,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/change-password
// Authenticated — changes the caller's own password and clears mustChangePassword.
const STRONG_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?`~]).{8,}$/;

router.post("/change-password", protect, async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword || !STRONG_RE.test(newPassword)) {
    return res.status(400).json({
      message:
        "Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character.",
    });
  }

  try {
    const hashed = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(req.user.id, {
      password: hashed,
      mustChangePassword: false,
    });
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/google — Firebase ID token exchange for Google Sign-In.
// Mobile sends the Firebase ID token obtained after Google Sign-In.
// Backend verifies it, creates the user if first-time login, returns a backend JWT.
router.post("/google", async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ message: "idToken is required" });
  }

  try {
    initFirebase();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const { email, name } = decoded;

    if (!email) {
      return res.status(400).json({ message: "Google account has no email address" });
    }

    const normalizedEmail = email.toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // First-time Google login — create account with a random placeholder password.
      // Google users never use email/password login so this value is never compared.
      user = await User.create({
        name:     name || normalizedEmail.split("@")[0],
        email:    normalizedEmail,
        password: randomBytes(32).toString("hex"),
        role:     "user",
      });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      token,
      user: {
        id:                 user._id,
        name:               user.name,
        email:              user.email,
        role:               user.role,
        mustChangePassword: user.mustChangePassword ?? false,
      },
    });
  } catch (err) {
    console.error("[Auth] Google verify failed:", err.message);
    if (err.code?.startsWith("auth/")) {
      return res.status(401).json({ message: "Invalid or expired Google token" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
