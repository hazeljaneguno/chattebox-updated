import User from "../models/User.js";

export async function loadReceiptReaders(messages) {
  const ids = new Set();
  for (const message of messages) {
    if (message.isDeleted) continue;
    for (const { userId } of message.readBy ?? []) {
      if (userId) ids.add(String(userId));
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

export function messageReceipts(message, readers) {
  if (message.isDeleted) return { deliveredTo: [], readBy: [] };

  return {
    deliveredTo: (message.deliveredTo ?? []).filter((receipt) => receipt.userId).map(serializeReceipt),
    readBy: (message.readBy ?? []).filter((receipt) => receipt.userId).map((receipt) => {
      const reader = readers.get(String(receipt.userId));
      return {
        ...serializeReceipt(receipt),
        username: reader?.username || "User",
        profilePicture: reader?.profilePicture || "",
      };
    }),
  };
}
