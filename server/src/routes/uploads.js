
import express from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { saveAttachment } from "../services/attachmentStorage.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

const uploadExtensions = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["audio/webm", ".webm"],
  ["audio/ogg", ".ogg"],
  ["audio/mp4", ".m4a"],
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"],
  ["video/3gpp", ".3gp"],
  ["application/pdf", ".pdf"],
  ["text/plain", ".txt"],
  ["text/csv", ".csv"],
  ["application/zip", ".zip"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
  ["application/msword", ".doc"],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!uploadExtensions.has(file.mimetype)) {
      return callback(
        new Error("This file type is not allowed.")
      );
    }

    callback(null, true);
  },
});

router.post("/", requireAuth, receiveUpload);
router.post("/profile-picture", requireAuth, receiveUpload);

function isProfileImage({ buffer, mimetype }) {
  if (mimetype === "image/jpeg") return buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (mimetype === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return mimetype === "image/webp" && buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
}

function receiveUpload(req, res, next) {
  upload.single("file")(req, res, async (error) => {
    if (error) {
      const status = error instanceof multer.MulterError ? 400 : 415;
      return res.status(status).json({
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "File must be 10 MB or smaller."
            : error.message || "Unable to upload file.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Please select a file." });
    }

    const isProfilePicture = req.path === "/profile-picture";
    if (isProfilePicture && !isProfileImage(req.file)) {
      return res.status(415).json({ message: "Choose a JPEG, PNG, or WebP photo." });
    }

    const filename = crypto.randomUUID() + uploadExtensions.get(req.file.mimetype);
    try {
      await saveAttachment(filename, req.file);
      if (isProfilePicture) {
        req.user.profilePicture = `/uploads/${filename}`;
        await req.user.save();
        return res.status(201).json({ profilePicture: req.user.profilePicture });
      }
    } catch (error) {
      return next(error);
    }

    return res.status(201).json({
      attachment: {
        url: `/uploads/${filename}`,
        originalName: path.basename(req.file.originalname).slice(0, 255),
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  });
}

export default router;
