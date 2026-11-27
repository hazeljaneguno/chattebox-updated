import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Group from "../models/Group.js";

export function registerTypingHandlers(io, socket) {
  const userId = String(socket.user.id);
  let lastStartAt = 0;

  socket.on("chat:typing", async (payload) => {
    const { chatId, isGroup, isTyping } = payload ?? {};

    if (
      typeof chatId !== "string" ||
      !mongoose.isValidObjectId(chatId) ||
      typeof isGroup !== "boolean" ||
      typeof isTyping !== "boolean" ||
      (!isGroup && chatId === userId)
    ) return;

    if (isTyping) {
      const now = Date.now();
      if (now - lastStartAt < 500) return;
      lastStartAt = now;
    }

    try {
      let recipientIds;

      if (isGroup) {
        const group = await Group.findOne({
          _id: chatId,
          members: userId,
        }).select("members").lean();

        if (!group) return;
        recipientIds = group.members.map(String).filter((id) => id !== userId);
      } else {
        const conversation = await Conversation.exists({
          participants: { $all: [userId, chatId] },
          status: "accepted",
        });

        if (!conversation) return;
        recipientIds = [chatId];
      }

      if (!socket.connected || recipientIds.length === 0) return;

      io.to(recipientIds.map((id) => `user:${id}`)).emit("chat:typing", {
        chatId: isGroup ? chatId : userId,
        isGroup,
        isTyping,
        userId,
        sourceId: socket.id,
      });
    } catch (error) {
      console.error("Could not relay typing status:", error.message);
    }
  });
}