import admin from "firebase-admin";
import FcmToken from "../models/FcmToken.js";

let initialized = false;

function initFirebase() {
  if (initialized) return;
  initialized = true;

  // Heroku: service account JSON stored as base64 env var
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, "base64").toString("utf8"),
    );
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // Local dev: GOOGLE_APPLICATION_CREDENTIALS path is read automatically
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
}

function urlToRoute(url) {
  if (!url) return "home";
  if (url.includes("/alerts"))    return "alerts";
  if (url.includes("/reports"))   return "reports";
  if (url.includes("/community")) return "community";
  if (url.includes("/resources")) return "resources";
  return "home";
}

function buildMulticastMessage(payload, tokens) {
  const urgent = payload.urgent ?? false;
  return {
    notification: {
      title: payload.title,
      body:  payload.body,
    },
    android: {
      priority: urgent ? "high" : "normal",
      notification: {
        channelId:            "etelly_alerts",
        priority:             urgent ? "max" : "default",
        defaultSound:         true,
        defaultVibrateTimings: true,
      },
    },
    apns: {
      headers: { "apns-priority": urgent ? "10" : "5" },
      payload: {
        aps: {
          sound:           "default",
          contentAvailable: true,
          badge:            1,
        },
      },
    },
    data: {
      url:    payload.url    ?? "/alerts",
      tag:    payload.tag    ?? "alert",
      urgent: String(urgent),
      route:  urlToRoute(payload.url),
    },
    tokens,
  };
}

export async function sendFCMToAll(payload) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log("[FCM] No Firebase credentials configured — skipping");
    return;
  }

  initFirebase();

  const tokenDocs = await FcmToken.find({}, "token").lean();
  if (!tokenDocs.length) {
    console.log("[FCM] No registered tokens — skipping");
    return;
  }

  const tokens = tokenDocs.map((d) => d.token);
  console.log(`[FCM] Sending to ${tokens.length} token(s)`);

  const BATCH_SIZE = 500;
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch   = tokens.slice(i, i + BATCH_SIZE);
    const message = buildMulticastMessage(payload, batch);

    const response = await admin.messaging().sendEachForMulticast(message);

    const toDelete = [];
    response.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          toDelete.push(batch[idx]);
        }
        console.error("[FCM] Send failed →", batch[idx].slice(0, 20), code);
      }
    });

    if (toDelete.length) {
      await FcmToken.deleteMany({ token: { $in: toDelete } });
      console.log(`[FCM] Cleaned up ${toDelete.length} stale token(s)`);
    }
  }
}
