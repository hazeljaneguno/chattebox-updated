import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import ConversationSettings from "../models/ConversationSettings.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { conversationKey } from "./messages.js";
import Call from "../models/Call.js";
const router = Router();

const allowedBackgrounds = [
  "default",
  "lavender",
  "ocean",
  "sunset",
  "forest",
  "rose",
  "mint",
  "peach",
  "night",
  "sky",
];
async function requireAcceptedConversation(userId, currentUserId) {
  const key = conversationKey(currentUserId, userId);

  const conversation = await Conversation.findOne({
    conversationKey: key,
    participants: currentUserId,
  }).lean();

  if (!conversation || conversation.status !== "accepted") {
    return null;
  }

  return conversation;
}

// Get incoming private message requests
router.get("/requests", requireAuth, async (req, res, next) => {
  try {
    const requests = await Conversation.find({
      participants: req.user._id,
      requestedBy: { $ne: req.user._id },
      status: "pending",
    })
      .populate("requestedBy", "_id username profilePicture")
      .sort({ createdAt: -1 })
      .lean();

    const conversationKeys = requests.map(
      (conversation) => conversation.conversationKey
    );

    const firstMessages = await Message.find({
      conversationKey: { $in: conversationKeys },
    })
      .sort({ createdAt: 1 })
      .populate("sender", "_id username")
      .lean();

    const messageByConversation = new Map();

    for (const message of firstMessages) {
      if (!messageByConversation.has(message.conversationKey)) {
        messageByConversation.set(message.conversationKey, message);
      }
    }

    return res.json({
      requests: requests.filter((conversation) =>
        conversation.requestedBy && messageByConversation.has(conversation.conversationKey)
      ).map((conversation) => {
        const firstMessage = messageByConversation.get(
          conversation.conversationKey
        );

        return {
          conversationKey: conversation.conversationKey,
          user: conversation.requestedBy,
          status: conversation.status,
          createdAt: conversation.createdAt,
          message: firstMessage
            ? {
                id: firstMessage._id.toString(),
                text: firstMessage.text || "",
                attachment: firstMessage.attachment?.url
                  ? firstMessage.attachment
                  : null,
                createdAt: firstMessage.createdAt,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});


// Get pending incoming calls for the authenticated user.
router.get("/calls/pending", requireAuth, async (req, res, next) => {
  try {
    const now = new Date();

    // Expire any unanswered calls whose 45-second window has passed.
    await Call.updateMany(
      {
        receiver: req.user._id,
        status: "ringing",
        expiresAt: { $lte: now },
      },
      {
        $set: {
          status: "missed",
          endedAt: now,
        },
      }
    );

    // Retrieve unexpired incoming invitations.
    const calls = await Call.find({
      receiver: req.user._id,
      status: "ringing",
      expiresAt: { $gt: now },
    })
      .select("+offer")
      .populate("caller", "_id username")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      calls: calls.map((call) => ({
        callId: call.callId,
        callerId: String(call.caller._id),
        callerName: call.caller.username,
        callType: call.callType,
        offer: call.offer,
        expiresAt: call.expiresAt,
        status: call.status,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Accept an incoming private message request
router.post("/:userId/accept", requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (
      !mongoose.isValidObjectId(userId) ||
      String(userId) === String(req.user._id)
    ) {
      return res.status(400).json({
        message: "Invalid conversation.",
      });
    }

    const key = conversationKey(req.user._id, userId);

    const conversation = await Conversation.findOneAndUpdate({
      conversationKey: key,
      participants: req.user._id,
      requestedBy: userId,
      status: "pending",
    }, { $set: { status: "accepted", acceptedAt: new Date() } }, { new: true });

    if (!conversation) {
      return res.status(404).json({ message: "Pending message request not found." });
    }

    const update = {
      conversationKey: key,
      participantIds: [String(req.user._id), String(userId)],
      status: "accepted",
      acceptedAt: conversation.acceptedAt,
    };

    const io = req.app.get("io");

    io?.to(`user:${req.user._id}`).emit(
      "conversation:request:accepted",
      update
    );

    io?.to(`user:${userId}`).emit(
      "conversation:request:accepted",
      update
    );

    return res.json({
      message: "Message request accepted.",
      ...update,
    });
  } catch (error) {
    next(error);
  }
});
// Reject an incoming private message request
router.post("/:userId/reject", requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (
      !mongoose.isValidObjectId(userId) ||
      String(userId) === String(req.user._id)
    ) {
      return res.status(400).json({
        message: "Invalid conversation.",
      });
    }

    const key = conversationKey(req.user._id, userId);

    const conversation = await Conversation.findOneAndUpdate({
      conversationKey: key,
      participants: req.user._id,
      requestedBy: userId,
      status: "pending",
    }, { $set: { status: "rejected" } });

    if (!conversation) {
      return res.status(404).json({ message: "Pending message request not found." });
    }

    const update = {
      conversationKey: key,
      participantIds: [String(req.user._id), String(userId)],
      status: "rejected",
    };

    const io = req.app.get("io");

    io?.to(`user:${req.user._id}`).emit(
      "conversation:request:rejected",
      update
    );

    io?.to(`user:${userId}`).emit(
      "conversation:request:rejected",
      update
    );

    return res.json({
      message: "Message request rejected.",
      ...update,
    });
  } catch (error) {
    next(error);
  }
});

// Get shared private conversation settings
router.get("/:userId/settings", requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (
      !mongoose.isValidObjectId(userId) ||
      String(userId) === String(req.user._id)
    ) {
      return res.status(400).json({
        message: "Invalid conversation.",
      });
    }

    const otherUser = await User.findById(userId).select("_id");

    if (!otherUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const conversation = await requireAcceptedConversation(
      userId,
      req.user._id
    );

    if (!conversation) {
      return res.status(403).json({
        message: "You can only access settings for accepted conversations.",
      });
    }

    const key = conversationKey(req.user._id, otherUser._id);

    // Both participants read the same settings document.
    const settings = await ConversationSettings.findOne({
      conversationKey: key,
    }).lean();

    return res.json({
      conversationKey: key,
      background: settings?.background || "default",
      nicknames: settings?.nicknames ?? {},
    });
  } catch (error) {
    next(error);
  }
});


// Block a private conversation
router.post("/:userId/block", requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (
      !mongoose.isValidObjectId(userId) ||
      String(userId) === String(req.user._id)
    ) {
      return res.status(400).json({
        message: "Invalid conversation.",
      });
    }

    const otherUser = await User.findById(userId).select("_id");

    if (!otherUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const key = conversationKey(req.user._id, otherUser._id);

    const conversation = await Conversation.findOneAndUpdate({
      conversationKey: key,
    }, {
      $set: { status: "blocked", blockedBy: req.user._id, blockedAt: new Date() },
      $setOnInsert: { participants: [req.user._id, otherUser._id], requestedBy: req.user._id },
    }, { new: true, upsert: true });

    const update = {
      conversationKey: key,
      participantIds: [String(req.user._id), String(userId)],
      status: "blocked",
      blockedBy: String(req.user._id),
      blockedAt: conversation.blockedAt,
    };

    const io = req.app.get("io");

    io?.to(`user:${req.user._id}`).emit(
      "conversation:blocked",
      update
    );

    io?.to(`user:${otherUser._id}`).emit(
      "conversation:blocked",
      update
    );

    return res.json({
      message: "Conversation blocked.",
      ...update,
    });
  } catch (error) {
    next(error);
  }
});

// Delete an incoming private message request
router.delete("/:userId/request", requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (
      !mongoose.isValidObjectId(userId) ||
      String(userId) === String(req.user._id)
    ) {
      return res.status(400).json({
        message: "Invalid conversation.",
      });
    }

    const key = conversationKey(req.user._id, userId);

    const conversation = await Conversation.findOne({
      conversationKey: key,
      participants: req.user._id,
      requestedBy: userId,
      status: "pending",
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Pending message request not found.",
      });
    }

    // Delete messages belonging to this pending request.
    await Message.deleteMany({
      conversationKey: key,
    });

    // Delete the conversation request.
    await Conversation.deleteOne({
      _id: conversation._id,
    });

    const io = req.app.get("io");

    const update = {
      conversationKey: key,
      deletedBy: String(req.user._id),
    };

    io?.to(`user:${req.user._id}`).emit(
      "conversation:request:deleted",
      update
    );

    io?.to(`user:${userId}`).emit(
      "conversation:request:deleted",
      update
    );

    return res.json({
      message: "Message request deleted.",
      ...update,
    });
  } catch (error) {
    next(error);
  }
});
router.patch("/:userId/settings", requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const background = req.body?.background;

    if (
      !mongoose.isValidObjectId(userId) ||
      String(userId) === String(req.user._id)
    ) {
      return res.status(400).json({
        message: "Invalid conversation.",
      });
    }

    if (!allowedBackgrounds.includes(background)) {
      return res.status(400).json({
        message: "Invalid background.",
      });
    }

    const otherUser = await User.findById(userId).select("_id");

    if (!otherUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const conversation = await requireAcceptedConversation(
      userId,
      req.user._id
    );

    if (!conversation) {
      return res.status(403).json({
        message: "You can only update settings for accepted conversations.",
      });
    }

    const key = conversationKey(req.user._id, otherUser._id);

    // One shared settings document for both participants.
    const previousSettings = await ConversationSettings.findOneAndUpdate(
      { conversationKey: key },
      {
        $set: { background },
        $setOnInsert: { conversationKey: key },
      },
      {
        new: false,
        upsert: true,
        runValidators: true,
      }
    );

    const io = req.app.get("io");
    const participantIds = conversation.participants.map(String);
    let noticeMessage = null;

    if ((previousSettings?.background ?? "default") !== background) {
      const senderName = req.user.username || "A participant";
      const text = `${senderName} changed the chat theme to ${background}.`;
      const notice = await Message.create({
        conversationKey: key,
        sender: req.user._id,
        recipient: otherUser._id,
        type: "conversation_notice",
        text,
      });
      noticeMessage = {
        id: String(notice._id),
        type: notice.type,
        senderId: String(req.user._id),
        senderName,
        recipientId: String(otherUser._id),
        text: notice.text,
        createdAt: notice.createdAt,
      };
    }

    const update = { conversationKey: key, background, participantIds, noticeMessage };
    for (const participantId of participantIds) {
      const room = io?.to(`user:${participantId}`);
      room?.emit("conversation:background:updated", update);
    }

    return res.json({
      message: "Shared conversation background updated.",
      ...update,
    });
  } catch (error) {
    next(error);
  }
});


router.patch("/:userId/nickname", requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const actorId = String(req.user._id);
    const memberId = req.body?.memberId;
    const nickname = typeof req.body?.nickname === "string" ? req.body.nickname.trim() : null;
    if (!mongoose.isObjectIdOrHexString(userId) || userId.toLowerCase() === actorId ||
        ![actorId, userId.toLowerCase()].includes(memberId) || nickname === null || nickname.length > 60) {
      return res.status(400).json({ message: "Choose a participant and a nickname of up to 60 characters." });
    }

    const conversation = await requireAcceptedConversation(userId, actorId);
    if (!conversation) {
      return res.status(403).json({ message: "You can only set nicknames in accepted conversations." });
    }

    const participantIds = conversation.participants.map(String);
    if (!participantIds.includes(memberId)) {
      return res.status(404).json({ message: "Conversation member unavailable." });
    }
    const key = conversationKey(actorId, userId);
    const field = `nicknames.${memberId}`;
    const previous = await ConversationSettings.findOneAndUpdate(
      { conversationKey: key },
      {
        $setOnInsert: { conversationKey: key },
        ...(nickname ? { $set: { [field]: nickname } } : { $unset: { [field]: 1 } }),
      },
      { upsert: true, new: false, runValidators: true, setDefaultsOnInsert: false }
    );

    let noticeMessage = null;
    if ((previous?.nicknames?.get(memberId) ?? "") !== nickname) {
      const senderName = req.user.username || "A participant";
      const target = memberId === actorId ? null : await User.findById(memberId).select("username");
      const owner = memberId === actorId ? "their" : `${target?.username || "the other participant"}’s`;
      const text = nickname
        ? `${senderName} changed ${owner} nickname to ${nickname}.`
        : `${senderName} reset ${owner} nickname.`;
      const notice = await Message.create({
        conversationKey: key, sender: actorId, recipient: userId,
        type: "conversation_notice", text,
      });
      noticeMessage = {
        id: String(notice._id), senderId: actorId, senderName, recipientId: userId,
        type: notice.type, text: notice.text, createdAt: notice.createdAt,
      };
    }

    const update = { participantIds, memberId, nickname, noticeMessage };
    if (noticeMessage) {
      const io = req.app.get("io");
      for (const participantId of participantIds) {
        io?.to(`user:${participantId}`).emit("conversation:nickname:updated", update);
      }
    }
    return res.json(update);
  } catch (error) {
    next(error);
  }
});

// Update personal appearance theme
router.patch("/theme", requireAuth, async (req, res, next) => {
  try {
    const theme = req.body?.theme;

    if (!["light", "dark"].includes(theme)) {
      return res.status(400).json({
        message: "Invalid theme.",
      });
    }

    req.user.theme = theme;
    await req.user.save();

    return res.json({
      message: "Theme updated.",
      theme: req.user.theme,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
