import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: String,
  muted: { type: Boolean, default: false },
  soundsEnabled: { type: Boolean, default: true },
}, { versionKey: false });

export const notificationPreferenceKey = (userId, kind, chatId) =>
  `${userId}:${kind}:${chatId}`;

export default mongoose.model("ChatNotificationPreference", schema);
