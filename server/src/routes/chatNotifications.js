import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/requireAuth.js";
import Group from "../models/Group.js";
import ChatNotificationPreference, {
  notificationPreferenceKey,
} from "../models/ChatNotificationPreference.js";

const router = Router();

router.use("/:kind/:chatId", requireAuth, async (req, res, next) => {
  try {
    const { kind, chatId } = req.params;
    const userId = req.user._id;
    if (!["private", "group"].includes(kind) || !mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: "Invalid chat." });
    }
    if (kind === "group" && !await Group.exists({ _id: chatId, members: userId })) {
      return res.status(404).json({ message: "Group not found." });
    }
    res.locals.preferenceKey = notificationPreferenceKey(userId, kind, chatId.toLowerCase());
    next();
  } catch (error) {
    next(error);
  }
});

router.get("/:kind/:chatId", async (req, res, next) => {
  try {
    const settings = await ChatNotificationPreference.findById(res.locals.preferenceKey).lean();
    res.json({
      muted: settings?.muted ?? false,
      soundsEnabled: settings?.soundsEnabled ?? true,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:kind/:chatId", async (req, res, next) => {
  try {
    const changes = {};
    for (const name of ["muted", "soundsEnabled"]) {
      if (typeof req.body?.[name] === "boolean") changes[name] = req.body[name];
    }
    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ message: "Choose a notification setting to update." });
    }
    const settings = await ChatNotificationPreference.findOneAndUpdate(
      { _id: res.locals.preferenceKey }, { $set: changes }, { upsert: true, new: true }
    );
    res.json({ muted: settings.muted, soundsEnabled: settings.soundsEnabled });
  } catch (error) {
    next(error);
  }
});

export default router;
