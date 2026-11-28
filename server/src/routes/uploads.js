
import express from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { saveAttachment } from "../services/attachmentStorage.js";
import { requireAuth } from "../middleware/requireAuth.js";

import mongoose from "mongoose";
import Group from "../models/Group.js";
import { postGroupNotice } from "../services/groupNotices.js";

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

router.post("/groups/:groupId/profile-picture", requireAuth, receiveUpload);

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
    const { groupId } = req.params;
    if ((isProfilePicture || groupId) && !isProfileImage(req.file)) {
      return res.status(415).json({ message: "Choose a JPEG, PNG, or WebP photo." });
    }

    const filename = crypto.randomUUID() + uploadExtensions.get(req.file.mimetype);
    try {
      if (groupId && (!mongoose.isValidObjectId(groupId) ||
          !(await Group.exists({ _id: groupId, members: req.user._id })))) {
        return res.status(404).json({ message: "Group not found or you are not a member." });
      }
      await saveAttachment(filename, req.file);
      const io = req.app.get("io");
      if (groupId) {
        const group = await Group.findOneAndUpdate(
          { _id: groupId, members: req.user._id },
          { $set: { profilePicture: `/uploads/${filename}` } },
          { new: true }
        ).lean();
        if (!group) return res.status(404).json({ message: "Group membership changed." });

        const update = { groupId: String(group._id), profilePicture: group.profilePicture };
        for (const memberId of group.members) {
          io?.to(`user:${memberId}`).emit("group:profile-picture:updated", update);
        }
        const actor = req.user.username || "A group member";
        await postGroupNotice(io, group, req.user, `${actor} changed the group photo.`);
        return res.status(201).json(update);
      }
      if (isProfilePicture) {
        req.user.profilePicture = `/uploads/${filename}`;
        await req.user.save();
        io?.emit("user:profile-picture:updated", {
          userId: String(req.user._id),
          profilePicture: req.user.profilePicture,
        });
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
