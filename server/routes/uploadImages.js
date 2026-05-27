import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const isLocalMode = process.env.LOCAL_MODE === "true";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOADS_DIR = join(__dirname, "../uploads");

if (!isLocalMode) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error("Only JPEG, PNG, and WEBP images are accepted"), { status: 400 }));
    }
  },
});

function uploadToCloudinary(buffer, mimetype) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "etelly/reports", resource_type: "image", format: "jpg", quality: "auto" },
      (error, result) => {
        if (error) {
          console.error("[UploadImages] Cloudinary error:", error.message);
          reject(error);
        } else {
          console.log("[UploadImages] Cloudinary URL:", result.secure_url);
          resolve(result.secure_url);
        }
      }
    );
    stream.end(buffer);
  });
}

async function saveToLocalDisk(buffer, originalname) {
  if (!existsSync(UPLOADS_DIR)) await mkdir(UPLOADS_DIR, { recursive: true });
  const ext = originalname.split(".").pop() || "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await writeFile(join(UPLOADS_DIR, filename), buffer);
  return filename;
}

// POST /api/reports/upload-images
// Accepts up to 5 images as multipart/form-data field "images"
// Returns { success, urls, failed }
router.post("/upload-images", (req, res, next) => {
  upload.array("images", 5)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const msg =
        err.code === "LIMIT_FILE_COUNT"
          ? "Maximum 5 images per report"
          : err.code === "LIMIT_FILE_SIZE"
          ? "Each image must be under 5MB"
          : err.message;
      return res.status(400).json({ success: false, error: msg, urls: [], failed: 0 });
    }
    if (err) {
      return res.status(err.status || 400).json({ success: false, error: err.message, urls: [], failed: 0 });
    }
    next();
  });
}, async (req, res) => {
  const files = req.files ?? [];

  console.log(`[UploadImages] hit — files: ${files.length}, content-type: ${req.headers["content-type"]}`);

  if (files.length === 0) {
    return res.status(400).json({ success: false, error: "No images provided", urls: [], failed: 0 });
  }

  const results = await Promise.allSettled(
    files.map(async (file) => {
      if (isLocalMode) {
        const filename = await saveToLocalDisk(file.buffer, file.originalname);
        const host = req.get("host") ?? `localhost:${process.env.PORT || 5000}`;
        return `${req.protocol}://${host}/uploads/${filename}`;
      }
      return uploadToCloudinary(file.buffer, file.mimetype);
    })
  );

  const urls = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const failed = results.filter((r) => r.status === "rejected").length;

  if (urls.length === 0) {
    return res.status(500).json({ success: false, error: "All image uploads failed", urls: [], failed });
  }

  res.json({ success: true, urls, failed });
});

export default router;
