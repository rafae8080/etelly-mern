import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { ObjectId } from "mongodb";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import hazardRoutes from "./routes/hazard.js";
import alertRoutes from "./routes/alerts.js";
import { startAlertEngine } from "./scripts/alertEngine.js";

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:3000"] }));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/hazard", hazardRoutes);
app.use("/api/alerts", alertRoutes);

// Socket.IO
io.on("connection", (socket) => {
  console.log("Admin connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("Admin disconnected:", socket.id);
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// Get all reports - FIXED CONNECTION
app.get("/api/reports", async (req, res) => {
  try {
    // Make sure mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      return res
        .status(500)
        .json({ success: false, error: "Database not connected" });
    }

    const db = mongoose.connection.db;
    const reportsCollection = db.collection("emergency_reports");

    // Get all reports
    const reports = await reportsCollection
      .find({})
      .sort({ timestamp: -1 })
      .toArray();

    console.log(`Found ${reports.length} reports in database`);
    console.log("First report:", reports[0]?.emergencyType);

    res.json({ success: true, reports });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Notify emergency endpoint
app.post("/api/notify-emergency", (req, res) => {
  const report = req.body;
  console.log("========================================");
  console.log("NEW EMERGENCY REPORT FROM MOBILE APP!");
  console.log("Type:", report.emergencyType);
  console.log("Severity:", report.severity);
  console.log("========================================");

  io.emit("new_emergency_report", {
    id: report.reportId,
    emergencyType: report.emergencyType,
    severity: report.severity,
    location: report.location,
    barangay: report.barangay,
    city: report.city || "Navotas",
    timestamp: new Date().toISOString(),
    userName: report.userName,
    phoneNumber: report.phoneNumber,
    description: report.description || "",
    status: "pending",
  });

  res.json({ success: true });
});

// Update report status
app.post("/api/reports/update-status", async (req, res) => {
  try {
    const { reportId, status, adminNotes, adminEmail } = req.body;
    console.log("Updating report:", reportId, "to status:", status);

    const db = mongoose.connection.db;
    const reportsCollection = db.collection("emergency_reports");

    const result = await reportsCollection.updateOne(
      { _id: new ObjectId(reportId) },
      {
        $set: {
          status: status,
          adminNotes: adminNotes || "",
          reviewedBy: adminEmail || "admin",
          reviewedAt: new Date().toISOString(),
        },
      },
    );

    if (result.modifiedCount > 0) {
      io.emit("report_updated", { reportId, status, adminNotes });
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// MongoDB connection - USE THE SAME DATABASE AS FLUTTER
const MONGO_URI =
  "mongodb+srv://demo_user:demouser123@cluster0.4vcql9o.mongodb.net/?retryWrites=true&w=majority";

mongoose
  .connect(MONGO_URI, {
    dbName: "etelly", // IMPORTANT: Use "etelly" database
  })
  .then(() => {
    console.log("Connected to MongoDB Atlas - Database: etelly");
    startAlertEngine(); // ← add this

    // Verify the connection
    const db = mongoose.connection.db;
    console.log("Database name:", db.databaseName);

    // Check if emergency_reports collection exists
    db.listCollections().toArray((err, collections) => {
      const collectionNames = collections.map((c) => c.name);
      console.log("Collections:", collectionNames);

      if (collectionNames.includes("emergency_reports")) {
        console.log("✅ emergency_reports collection found");
        // Count documents
        const reportsCollection = db.collection("emergency_reports");
        reportsCollection.countDocuments().then((count) => {
          console.log(`📊 Total reports in database: ${count}`);
        });
      } else {
        console.log("⚠️ emergency_reports collection not found");
      }
    });

    server.listen(5000, () => {
      console.log(`Server running on http://localhost:5000`);
    });
  })
  .catch((err) => console.error("MongoDB connection failed:", err));
