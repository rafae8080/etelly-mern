import express from "express";
import mongoose from "mongoose";
import { syncStatus } from "../scripts/syncToCloud.js";

const router = express.Router();

// GET /api/sync/status — returns current sync state (local mode only)
router.get("/status", async (req, res) => {
  try {
    const col = mongoose.connection.db.collection("emergency_reports");
    const unsyncedCount = await col.countDocuments({ syncedToCloud: { $ne: true } });
    syncStatus.unsyncedCount = unsyncedCount;
    res.json({
      unsyncedCount,
      lastSyncAt: syncStatus.lastSyncAt,
      lastSyncResult: syncStatus.lastSyncResult,
    });
  } catch (err) {
    res.status(500).json({ message: "Status check failed", error: err.message });
  }
});

// GET /api/sync/export — downloads all unsynced reports as JSON backup
router.get("/export", async (req, res) => {
  try {
    const col = mongoose.connection.db.collection("emergency_reports");
    const unsynced = await col.find({ syncedToCloud: { $ne: true } }).toArray();
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="etelly-offline-reports-${Date.now()}.json"`
    );
    res.json({ exportedAt: new Date().toISOString(), count: unsynced.length, reports: unsynced });
  } catch (err) {
    res.status(500).json({ message: "Export failed", error: err.message });
  }
});

// POST /api/sync/receive-batch — runs on the CLOUD server
// Accepts a batch of reports pushed from a barangay hall local server
router.post("/receive-batch", async (req, res) => {
  // Verify shared sync secret
  const key = req.headers["x-sync-key"];
  if (!key || key !== process.env.SYNC_SECRET) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { reports, barangayName } = req.body;

    if (!Array.isArray(reports) || reports.length === 0) {
      return res.status(400).json({ message: "No reports provided" });
    }

    const col = mongoose.connection.db.collection("emergency_reports");
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const reportData of reports) {
      // Deduplicate: prefer reportId UUID, fall back to triple-key check
      const exists = reportData.reportId
        ? await col.findOne({ reportId: reportData.reportId })
        : await col.findOne({
            userName: reportData.userName,
            emergencyType: reportData.emergencyType,
            offlineSubmittedAt: reportData.offlineSubmittedAt
              ? new Date(reportData.offlineSubmittedAt)
              : null,
          });

      if (exists) {
        // Update approval/resolution data so cloud reflects local barangay actions
        const hasUpdate =
          reportData.status !== exists.status ||
          (reportData.logs || []).length !== (exists.logs || []).length;

        if (hasUpdate) {
          await col.updateOne(
            { _id: exists._id },
            {
              $set: {
                status: reportData.status,
                adminNotes: reportData.adminNotes || "",
                reviewedBy: reportData.reviewedBy || "",
                reviewedAt: reportData.reviewedAt || null,
                resolvedBy: reportData.resolvedBy || "",
                resolvedAt: reportData.resolvedAt || null,
                resolutionNotes: reportData.resolutionNotes || "",
                logs: reportData.logs || [],
              },
            }
          );
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      // Drop the local _id so MongoDB generates a fresh one in Atlas
      const { _id, ...rest } = reportData;

      await col.insertOne({
        ...rest,
        offlineSubmittedAt: rest.offlineSubmittedAt
          ? new Date(rest.offlineSubmittedAt)
          : null,
        syncedToCloud: true,
        receivedFromLocal: true,
        barangaySource: barangayName || "unknown",
      });
      inserted++;
    }

    res.json({
      success: true,
      inserted,
      updated,
      skipped,
      message: `Sync complete: ${inserted} new, ${updated} updated, ${skipped} unchanged`,
    });
  } catch (err) {
    console.error("[Sync] receive-batch error:", err);
    res.status(500).json({ message: "Sync failed", error: err.message });
  }
});

export default router;
