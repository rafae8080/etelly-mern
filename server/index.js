import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import hazardRoutes from "./routes/hazard.js";
import alertRoutes from "./routes/alerts.js";
import reportRoutes from "./routes/reports.js";
import evacuationRoutes from "./routes/evacuation.js";
import communityRoutes from "./routes/community.js";
import pushRoutes from "./routes/push.js";
import { startAlertEngine } from "./scripts/alertEngine.js";

dotenv.config();

const app = express();
const server = createServer(app);
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
  /\.vercel\.app$/,
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some((o) =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    callback(allowed ? null : new Error("Not allowed by CORS"), allowed);
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

const io = new Server(server, { cors: corsOptions });

app.use(cors(corsOptions));
app.use(express.json());

// Make io accessible inside route handlers via req.app.get("io")
app.set("io", io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/hazard", hazardRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/evacuation", evacuationRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/push", pushRoutes);

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

// GET all reports — raw collection access for the base /api/reports path (not covered by reportRoutes)
app.get("/api/reports", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1)
      return res.status(500).json({ success: false, error: "Database not connected" });
    const reports = await mongoose.connection.db
      .collection("emergency_reports")
      .find({})
      .sort({ timestamp: -1 })
      .toArray();
    res.json({ success: true, reports });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Receives push from mobile app and broadcasts via Socket.IO
app.post("/api/notify-emergency", (req, res) => {
  const report = req.body;
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

    const report = status === "approved"
      ? await mongoose.connection.db.collection("emergency_reports").findOne({ _id: new mongoose.Types.ObjectId(reportId) })
      : null;

    const result = await mongoose.connection.db
      .collection("emergency_reports")
      .updateOne(
        { _id: new mongoose.Types.ObjectId(reportId) },
        {
          $set: {
            status,
            adminNotes: adminNotes || "",
            reviewedBy: adminEmail || "admin",
            reviewedAt: new Date().toISOString(),
          },
          $push: {
            logs: {
              action: status,
              by: adminEmail || "admin",
              at: new Date().toISOString(),
              notes: adminNotes || "",
            },
          },
        },
      );
    if (result.modifiedCount > 0) {
      io.emit("report_updated", { reportId, status, adminNotes });
      io.emit("report_status_updated", { reportId, status });

      if (status === "approved" && report) {
        const severityMap = { high: "critical", medium: "warning", low: "advisory" };
        const alertSeverity = severityMap[report.severity?.toLowerCase()] || "warning";
        const typeName = report.emergencyType?.charAt(0).toUpperCase() + report.emergencyType?.slice(1) || "Emergency";
        const alertDoc = {
          type: report.emergencyType || "emergency",
          title: `Community Report: ${typeName}`,
          message: report.description || "Emergency report approved by CDRRMO",
          severity: alertSeverity,
          location: report.location?.exactAddress || (typeof report.location === "string" ? report.location : "") || "Unknown location",
          source: "community_report",
          active: true,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          reportId,
        };
        const alertResult = await mongoose.connection.db.collection("alerts").insertOne(alertDoc);
        io.emit("new_alert", { ...alertDoc, _id: alertResult.insertedId });
      }

      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error("Error updating report status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resolve report
app.post("/api/reports/resolve", async (req, res) => {
  try {
    const { reportId, resolvedBy, resolutionNotes } = req.body;
    const result = await mongoose.connection.db
      .collection("emergency_reports")
      .updateOne(
        { _id: new mongoose.Types.ObjectId(reportId) },
        {
          $set: {
            status: "resolved",
            resolvedBy: resolvedBy || "admin",
            resolvedAt: new Date().toISOString(),
            resolutionNotes: resolutionNotes || "",
          },
          $push: {
            logs: {
              action: "resolved",
              by: resolvedBy || "admin",
              at: new Date().toISOString(),
              notes: resolutionNotes || "",
            },
          },
        },
      );
    if (result.modifiedCount > 0) {
      io.emit("report_updated", { reportId, status: "resolved" });
      io.emit("report_status_updated", { reportId, status: "resolved" });
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error("Error resolving report:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

mongoose
  .connect(process.env.MONGO_URI, { dbName: "etelly" })
  .then(() => {
    console.log("Connected to MongoDB Atlas — etelly");
    startAlertEngine();
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("MongoDB connection failed:", err));
