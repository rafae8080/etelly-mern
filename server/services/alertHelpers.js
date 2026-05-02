import Alert from "../models/Alert.js";

export function toDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function toHourKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function upsertSystemAlert({ _dedupeKey, ...alertData }) {
  await Alert.findOneAndUpdate(
    { _dedupeKey, isActive: true },
    {
      $set: {
        ...alertData,
        source: "system",
        _dedupeKey,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date(), isActive: true },
    },
    { upsert: true, new: true },
  );
}

export async function upsertAlert({ _dedupeKey, source, ...alertData }) {
  await Alert.findOneAndUpdate(
    { _dedupeKey, isActive: true },
    {
      $set: {
        ...alertData,
        source,
        _dedupeKey,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date(), isActive: true },
    },
    { upsert: true, new: true },
  );
}
