// server/routes/reports.js
import express from "express";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const router = express.Router();

// GET /api/reports/approved - Get approved reports
router.get("/approved", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        success: false,
        error: "Database not connected",
      });
    }

    const db = mongoose.connection.db;
    const reportsCollection = db.collection("emergency_reports");

    const { emergencyType, limit = 100 } = req.query;

    // Build query
    const query = { status: "approved" };

    // Filter by emergency type if specified
    if (emergencyType && emergencyType !== "all") {
      query.emergencyType = emergencyType;
    }

    const reports = await reportsCollection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .toArray();

    // Transform for frontend
    const formattedReports = reports.map((report) => ({
      _id: report._id,
      emergencyType: report.emergencyType,
      severity: report.severity,
      description: report.description || "",
      location: report.location || {},
      latitude: report.latitude,
      longitude: report.longitude,
      timestamp: report.timestamp,
      images: report.images || [],
      status: report.status,
      userData: {
        fullName: report.userName || "Anonymous",
        phone: report.phoneNumber || null,
      },
    }));

    res.json({
      success: true,
      reports: formattedReports,
      count: formattedReports.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch reports",
      details: error.message,
    });
  }
});

// POST /api/reports/create - Create new report
router.post("/create", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const reportsCollection = db.collection("emergency_reports");

    const {
      emergencyType, severity, description, location,
      latitude, longitude, userName, phoneNumber, images, barangay,
    } = req.body;

    const reportData = {
      emergencyType, severity, description, location,
      latitude, longitude, userName, phoneNumber,
      images: Array.isArray(images) ? images : [],
      barangay: barangay || "",
      timestamp: new Date(),
      status: "pending",
    };

    const result = await reportsCollection.insertOne(reportData);

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("new_emergency_report", {
        _id: result.insertedId,
        ...reportData,
      });
    }

    res.json({
      success: true,
      reportId: result.insertedId,
      message: "Report created successfully",
    });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create report",
    });
  }
});

// Export as default for ES modules
export default router;
