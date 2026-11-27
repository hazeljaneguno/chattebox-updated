
import { API_URL } from "../api";

export function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

export function getMessageId(message) {
  return message?.id ?? message?._id;
}

export function formatTime(date) {
  if (!date) return "";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getAttachmentUrl(attachment) {
  if (!attachment?.url) return "";

  if (
    attachment.url.startsWith("http://") ||
    attachment.url.startsWith("https://")
  ) {
    return attachment.url;
  }

  return `${API_URL}${attachment.url.startsWith("/") ? "" : "/"}${attachment.url}`;
}

export function getAttachmentMediaType(attachment) {
  const mime = attachment?.mimeType?.toLowerCase() || "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";

  const filename = attachment?.originalName || attachment?.url || "";
  const extension = filename.split(/[?#]/)[0].split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif"].includes(extension)) return "image";
  if (["m4a", "ogg", "opus", "mp3", "wav"].includes(extension)) return "audio";
  if (["mp4", "webm", "mov", "3gp", "m4v"].includes(extension)) return "video";
  return "";
}

export function getReplyPreview(message) {
  if (!message) return "Message unavailable";

  if (message.isDeleted) {
    return "This message was deleted";
  }

  if (message.text?.trim()) return message.text;

  const media = getAttachmentMediaType(message.attachment);
  if (media === "image") return "Photo";
  if (media === "video") return "Video";
  if (media === "audio") return "Voice message";

  if (message.attachment) return "📎 Attachment";

  return "Message";
}
