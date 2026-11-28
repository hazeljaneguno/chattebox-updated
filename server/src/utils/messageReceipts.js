import User from "../models/User.js";

export async function loadReceiptReaders(messages = []) {
  const ids = new Set();
  for (const message of messages) {
    if (!message || message.isDeleted) continue;
    for (const receipt of message.readBy ?? []) {
      if (receipt?.userId) ids.add(String(receipt.userId));
    }
  }

  if (!ids.size) return new Map();
  const readers = await User.find({ _id: { $in: [...ids] } })
    .select("_id username profilePicture")
    .lean();
  return new Map(readers.map((reader) => [String(reader._id), reader]));
}

function serializeReceipt({ userId, at }) {
  return { userId: String(userId), at };
}

export function messageReceipts(message, readers = new Map()) {
  if (!message || message.isDeleted) return { deliveredTo: [], readBy: [] };

  return {
    deliveredTo: (message.deliveredTo ?? []).filter((receipt) => receipt?.userId).map(serializeReceipt),
    readBy: (message.readBy ?? []).filter((receipt) => receipt?.userId).map((receipt) => {
      const reader = readers.get(String(receipt.userId));
      return {
        ...serializeReceipt(receipt),
        username: reader?.username || "User",
        profilePicture: reader?.profilePicture || "",
      };
    }),
  };
}
