import express from "express";
import mongoose from "mongoose";

const router = express.Router();

// POST /api/sync/receive-batch — runs on the CLOUD server
// Accepts a batch of reports pushed from a barangay hall local server
router.post("/receive-batch", async (req, res) => {
  try {
    const { reports, barangayName } = req.body;

    if (!Array.isArray(reports) || reports.length === 0) {
      return res.status(400).json({ message: "No reports provided" });
    }

    const col = mongoose.connection.db.collection("emergency_reports");
    let inserted = 0;
    let skipped = 0;

    for (const reportData of reports) {
      // Deduplicate: same submitter + type + offline timestamp
      const exists = await col.findOne({
        userName: reportData.userName,
        emergencyType: reportData.emergencyType,
        offlineSubmittedAt: reportData.offlineSubmittedAt
          ? new Date(reportData.offlineSubmittedAt)
          : null,
      });

      if (exists) {
        skipped++;
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
      skipped,
      message: `Sync complete: ${inserted} new, ${skipped} duplicates skipped`,
    });
  } catch (err) {
    console.error("[Sync] receive-batch error:", err);
    res.status(500).json({ message: "Sync failed", error: err.message });
  }
});

export default router;
