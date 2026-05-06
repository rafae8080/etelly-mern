import express from "express";
import webpush from "web-push";
import PushSubscription from "../models/PushSubscription.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Called lazily so env vars are available after dotenv.config() runs in index.js
function initVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_MAILTO,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

// POST /api/push/subscribe — save a browser push subscription
router.post("/subscribe", protect, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription object" });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { endpoint, keys, userId: req.user._id },
      { upsert: true, new: true },
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

// DELETE /api/push/unsubscribe — remove a subscription
router.delete("/unsubscribe", protect, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.deleteOne({ endpoint });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

// ---- START OF TEST CODE — delete from here ----
router.post("/test", async (_req, res) => {
  try {
    await sendPushToAll({
      title: "🔔 Test Notification",
      body: "Push notifications are working correctly!",
      url: "/alerts",
      tag: "push-test",
      urgent: false,
    });
    res.json({ success: true, message: "Test push sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ---- END OF TEST CODE — delete up to here ----

// Send a push notification to every stored subscription
export async function sendPushToAll(payload) {
  initVapid();
  const subs = await PushSubscription.find();
  console.log(`[Push] Sending to ${subs.length} subscriber(s)`);
  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload))
        .then(() => console.log("[Push] Sent OK →", sub.endpoint.slice(0, 60)))
        .catch(async (err) => {
          console.error("[Push] Failed →", err.statusCode, err.body ?? err.message);
          if (err.statusCode === 410) {
            await PushSubscription.deleteOne({ endpoint: sub.endpoint });
          }
        }),
    ),
  );
}

export default router;
