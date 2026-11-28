
export function sameId(a, b) {
  return String(a) === String(b);
}

export function canAddGroupMembers(chat, userId) {
  if (!chat?.isGroup || userId == null) return false;
  if (sameId(chat.creatorId, userId)) return true;
  if (!(chat.members || []).some((member) => sameId(member.id ?? member._id, userId))) {
    return false;
  }
  return chat.memberAddPolicy === "members" ||
    (chat.adminIds || []).some((id) => sameId(id, userId));
}

export function getTime(value) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function messageTimestamp(message) {
  return Date.parse(message?.createdAt) || 0;
}

export function latestChatMessage(chat) {
  return (chat.messages || []).reduce((latest, message) =>
    messageTimestamp(message) >= messageTimestamp(latest) ? message : latest,
  chat.latestMessage || null);
}

export function formatChatDate(value, today = new Date()) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";
  if (date.toDateString() === today.toDateString()) return getTime(date);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== today.getFullYear() && { year: "numeric" }),
  }).format(date);
}

export function isInboxChat(chat) {
  if (chat.isGroup || chat.conversationStatus === "accepted") return true;
  return !chat.conversationStatus && Boolean(latestChatMessage(chat));
}
