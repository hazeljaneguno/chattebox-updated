import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import GroupMessage from "../models/GroupMessage.js";
import Group from "../models/Group.js";
import { loadReceiptReaders, messageReceipts } from "../utils/messageReceipts.js";

export function registerMessageReceiptHandlers(io, socket) {
  const userId = String(socket.user.id);

  async function updateReceipt(type, payload, callback) {
    try {
      const { messageId, status } = payload || {};

      if (!mongoose.isValidObjectId(messageId)) {
        return callback?.({
          ok: false,
          message: "Invalid message ID.",
        });
      }

      if (!["delivered", "seen"].includes(status)) {
        return callback?.({
          ok: false,
          message: "Invalid receipt status.",
        });
      }

      const isGroup = type === "group";
      const Model = isGroup ? GroupMessage : Message;

      const message = await Model.findById(messageId);

      if (!message || message.isDeleted) {
        return callback?.({
          ok: false,
          message: "Message not found.",
        });
      }

      const senderId = String(message.sender);

      if (senderId === userId) {
        return callback?.({
          ok: false,
          message: "Cannot acknowledge your own message.",
        });
      }

      let group = null;

      if (isGroup) {
        group = await Group.findOne({
          _id: message.group,
          members: userId,
        }).select("_id members");

        if (!group) {
          return callback?.({
            ok: false,
            message: "Not a group member.",
          });
        }
      } else if (String(message.recipient) !== userId) {
        return callback?.({
          ok: false,
          message: "Not authorized.",
        });
      }

      if (!isGroup && await Conversation.exists({
        conversationKey: message.conversationKey,
        status: { $in: ["pending", "rejected", "blocked"] },
      })) {
        return callback?.({ ok: false, message: "Chat approval is required." });
      }

      const now = new Date();

      const fields =
        status === "seen"
          ? ["deliveredTo", "readBy"]
          : ["deliveredTo"];

      for (const field of fields) {
        await Model.updateOne(
          {
            _id: message._id,
            [`${field}.userId`]: { $ne: userId },
          },
          {
            $push: {
              [field]: {
                userId,
                at: now,
              },
            },
          },
          { timestamps: false }
        );
      }

      const updated = await Model.findById(message._id)
        .select("deliveredTo readBy");

      if (!updated) return callback?.({ ok: false, message: "Message not found." });
      const readers = await loadReceiptReaders([updated]);

      const receiptUpdate = {
        messageId: String(message._id),
        ...(isGroup && {
          groupId: String(message.group),
        }),
        status,

        ...messageReceipts(updated, readers),
      };

      const event = isGroup
        ? "group:message:receipt"
        : "message:receipt";

      if (isGroup) {
        for (const memberId of group.members) {
          io.to(`user:${memberId}`).emit(
            event,
            receiptUpdate
          );
        }
      } else {
        io.to(`user:${senderId}`).emit(
          event,
          receiptUpdate
        );

        io.to(`user:${userId}`).emit(
          event,
          receiptUpdate
        );
      }

      return callback?.({
        ok: true,
        receipt: receiptUpdate,
      });
    } catch (error) {
      console.error("Message receipt error:", error);

      return callback?.({
        ok: false,
        message: "Unable to update receipt.",
      });
    }
  }

  socket.on("message:receipt", (payload, callback) => {
    updateReceipt("private", payload, callback);
  });

  socket.on("group:message:receipt", (payload, callback) => {
    updateReceipt("group", payload, callback);
  });
}
