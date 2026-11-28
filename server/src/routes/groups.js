
import { loadReceiptReaders, messageReceipts } from "../utils/messageReceipts.js";
import { Router } from "express";
import mongoose from "mongoose";
import { latestGroupMessages } from "../services/conversationActivity.js";
import Group from "../models/Group.js";
import GroupCall from "../models/GroupCall.js";
import GroupMessage from "../models/GroupMessage.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";

import { postGroupNotice } from "../services/groupNotices.js";

const router = Router();

function groupSummary(group) {
  return {
    id: String(group._id),
    name: group.name,
    creatorId: String(group.creator),
    background: group.background || "default",
    profilePicture: group.profilePicture || "",
    adminIds: [...new Set([group.creator, ...(group.admins || [])].map(String))],
    memberAddPolicy: group.memberAddPolicy ?? "admins",
    members: group.members.map((member) => ({
      id: String(member._id),
      username: member.username,
      profilePicture: member.profilePicture || "",
      nickname: group.nicknames?.[String(member._id)] ?? "",
    })),
  };
}

async function publishGroupMembers(io, groupId) {
  const group = await Group.findById(groupId)
    .populate("members", "_id username profilePicture")
    .lean();
  const update = { group: groupSummary(group) };
  for (const member of group.members) {
    io?.to(`user:${member._id}`).emit("group:members:updated", update);
  }
  return update;
}

// Get groups that the logged-in user belongs to
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const groups = await Group.find({
      members: req.user._id,
    })
      .populate("members", "_id username profilePicture")
      .sort({ updatedAt: -1 })
      .lean();

    const activity = await latestGroupMessages(
      groups.map((group) => group._id), req.user._id
    );

    res.json({
      groups: groups.map((group) => ({
        ...groupSummary(group),
        latestMessage: activity.get(String(group._id)) || null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

 // Delete a group and its messages
router.delete("/:groupId", requireAuth, async (req, res, next) => {
  try {
    const { groupId } = req.params;

    // Check whether the group ID is valid
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID.",
      });
    }

    // Only the creator can delete the group
    const group = await Group.findOne({
      _id: groupId,
      creator: req.user._id,
    });

    if (!group) {
      return res.status(404).json({
        message: "Group not found or you are not allowed to delete it.",
      });
    }

    // Delete all messages belonging to this group
    await GroupMessage.deleteMany({
      group: group._id,
    });

    // Delete the group itself
    await Group.deleteOne({
      _id: group._id,
    });

    return res.json({
      message: "Group deleted successfully.",
      groupId: group._id.toString(),
    });
  } catch (error) {
    next(error);
  }
});

// Create a group
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const { memberIds: requestedMembers, memberAddPolicy = "admins" } = req.body ?? {};

    if (!["admins", "members"].includes(memberAddPolicy)) {
      return res.status(400).json({ message: "Choose who can add members." });
    }

    if (name.length < 2 || name.length > 50) {
      return res.status(400).json({
        message: "Group name must be between 2 and 50 characters.",
      });
    }

    if (
      !Array.isArray(requestedMembers) ||
      requestedMembers.length < 1 ||
      requestedMembers.length > 49
    ) {
      return res.status(400).json({
        message: "Choose between 1 and 49 other members.",
      });
    }

    const memberIds = [
      ...new Set([
        String(req.user._id),
        ...requestedMembers.map(String),
      ]),
    ];

    if (
      memberIds.some((id) => !mongoose.isValidObjectId(id))
    ) {
      return res.status(400).json({
        message: "One or more member IDs are invalid.",
      });
    }

    const users = await User.find({
      _id: { $in: memberIds },
    }).select("_id");

    if (users.length !== memberIds.length) {
      return res.status(400).json({
        message: "One or more selected users do not exist.",
      });
    }

    const group = await Group.create({
      name,
      creator: req.user._id,
      memberAddPolicy,
      members: memberIds,
    });

    const savedGroup = await Group.findById(group._id)
      .populate("members", "_id username profilePicture")
      .lean();

    res.status(201).json({
      group: groupSummary(savedGroup),
    });
  } catch (error) {
    next(error);
  }
});

// Load a group's message history
router.get("/:groupId/messages", requireAuth, async (req, res, next) => {
  try {
    const { groupId } = req.params;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID.",
      });
    }

    const group = await Group.findOne({
      _id: groupId,
      members: req.user._id,
    }).select("_id");

    if (!group) {
      return res.status(404).json({
        message: "Group not found.",
      });
    }

    const messages = await GroupMessage.find({
  group: group._id,
})
  .sort({ createdAt: -1, _id: -1 })
  .limit(500)
  .populate("sender", "_id username")
  .populate({
    path: "replyTo",
    select: "_id text sender isDeleted deletedBy",
    populate: {
      path: "sender",
      select: "_id username",
    },
  })
  .lean();

const receiptReaders = await loadReceiptReaders(messages);
const history = messages.map((message) => ({
    id: message._id.toString(),
    groupId: message.group?.toString() || group._id.toString(),

    type: message.type ?? "text",
    callId: message.callId ?? null,
    callType: message.callType ?? null,
    status: message.status ?? null,
    startedAt: message.startedAt ?? null,
    endedAt: message.endedAt ?? null,

    senderId: message.sender?._id?.toString() || null,
    senderName: message.sender?.username || "Deleted User",

    text: message.isDeleted ? "This message was deleted" : message.text,

    isDeleted: Boolean(message.isDeleted),

    attachment: message.attachment?.url
      ? {
          url: message.attachment.url,
          originalName: message.attachment.originalName,
          mimeType: message.attachment.mimeType,
          size: message.attachment.size,
          photoBatchId: message.attachment.photoBatchId,
        }
      : null,

   reactions: message.isDeleted
  ? []
  : (message.reactions || []).map((reaction) => ({
      userId: String(reaction.user),
      emoji: reaction.emoji,
      createdAt: reaction.createdAt,
    })),

createdAt: message.createdAt,
updatedAt: message.updatedAt,
...messageReceipts(message, receiptReaders),
}));

const endedCalls = await GroupCall.find({ group: group._id, status: "ended" })
  .select("_id host callType startedAt endedAt createdAt")
  .sort({ startedAt: -1, _id: -1 })
  .limit(500)
  .lean();

const endedCallIds = new Set(endedCalls.map((call) => String(call._id)));
const callEventTypes = new Set(["group_call", "group_call_started", "group_call_ended"]);
const callHistory = endedCalls.map((call) => ({
  id: `group-call-${call._id}`,
  groupId: String(group._id),
  type: "group_call",
  callId: String(call._id),
  callType: call.callType,
  status: "ended",
  senderId: String(call.host),
  startedAt: call.startedAt,
  endedAt: call.endedAt,
  createdAt: call.startedAt ?? call.createdAt ?? call.endedAt,
}));

res.json({
  messages: [
    ...history.filter((message) =>
      !callEventTypes.has(message.type) || !endedCallIds.has(String(message.callId))
    ),
    ...callHistory,
  ].sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
    .slice(0, 500),
});

  } catch (error) {
    next(error);
  }
});

// Add multiple members to an existing group
router.patch("/:groupId/members", requireAuth, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const requestedMembers = req.body?.memberIds;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID.",
      });
    }

    if (
      !Array.isArray(requestedMembers) ||
      requestedMembers.length === 0
    ) {
      return res.status(400).json({
        message: "Please select at least one member.",
      });
    }

    if (
      requestedMembers.some(
        (id) => !mongoose.isValidObjectId(String(id))
      )
    ) {
      return res.status(400).json({
        message: "One or more member IDs are invalid.",
      });
    }

    const permission = {
      _id: groupId,
      members: req.user._id,
      $or: [
        { creator: req.user._id },
        { admins: req.user._id },
        { memberAddPolicy: "members" },
      ],
    };
    const group = await Group.findOne(permission).lean();

    if (!group) {
      return res.status(404).json({
        message: "Group not found or you are not allowed to add members.",
      });
    }

    // Remove duplicate IDs and existing members.
    const newMemberIds = [
      ...new Set(requestedMembers.map(String)),
    ].filter(
      (id) => !group.members.some(
        (memberId) => String(memberId) === id
      )
    );

    if (newMemberIds.length === 0) {
      return res.status(400).json({
        message: "All selected users are already members.",
      });
    }

    if (group.members.length + newMemberIds.length > 50) {
      return res.status(400).json({
        message: "A group can have a maximum of 50 members.",
      });
    }

    const users = await User.find({
      _id: { $in: newMemberIds },
    }).select("_id username");

    if (users.length !== newMemberIds.length) {
      return res.status(400).json({
        message: "One or more selected users do not exist.",
      });
    }

    const updated = await Group.findOneAndUpdate(
      {
        ...permission,
        $expr: {
          $lte: [
            { $size: { $setUnion: ["$members", users.map((user) => user._id)] } },
            50,
          ],
        },
      },
      { $addToSet: { members: { $each: users.map((user) => user._id) } } },
      { new: false }
    ).lean();

    if (!updated) {
      return res.status(409).json({ message: "Group membership or permissions changed. Try again." });
    }

    const added = users.filter((user) => !updated.members.some((id) => id.equals(user._id)));
    const io = req.app.get("io");
    const result = await publishGroupMembers(io, group._id);
    if (added.length) {
      const actor = req.user.username || "A group member";
      const names = added.map((user) => user.username).join(", ");
      await postGroupNotice(io, {
        _id: group._id,
        members: result.group.members.map((member) => member.id),
      }, req.user, `${actor} added ${names} to the group.`);
    }

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

router.patch("/:groupId/member-add-policy", requireAuth, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { memberAddPolicy } = req.body ?? {};
    if (!mongoose.isValidObjectId(groupId) || !["admins", "members"].includes(memberAddPolicy)) {
      return res.status(400).json({ message: "Choose a valid group and who can add members." });
    }

    const result = await Group.updateOne(
      { _id: groupId, creator: req.user._id, members: req.user._id },
      { $set: { memberAddPolicy } }
    );
    if (!result.matchedCount) {
      return res.status(403).json({ message: "Only the group creator can change who adds members." });
    }

    return res.json(await publishGroupMembers(req.app.get("io"), groupId));
  } catch (error) {
    next(error);
  }
});

router.patch("/:groupId/admins/:memberId", requireAuth, async (req, res, next) => {
  try {
    const { groupId, memberId } = req.params;
    const { admin } = req.body ?? {};
    if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(memberId) ||
        typeof admin !== "boolean" || req.user._id.equals(memberId)) {
      return res.status(400).json({ message: "Choose another group member and a valid role." });
    }

    const result = await Group.updateOne(
      { _id: groupId, creator: req.user._id, members: memberId },
      admin ? { $addToSet: { admins: memberId } } : { $pull: { admins: memberId } }
    );
    if (!result.matchedCount) {
      return res.status(403).json({ message: "Only the group creator can manage existing members’ admin roles." });
    }

    return res.json(await publishGroupMembers(req.app.get("io"), groupId));
  } catch (error) {
    next(error);
  }
});

// Change a group's shared background
router.patch("/:groupId/background", requireAuth, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { background } = req.body || {};

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

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID.",
      });
    }

    if (!allowedBackgrounds.includes(background)) {
      return res.status(400).json({
        message: "Invalid background.",
      });
    }

    const group = await Group.findOneAndUpdate(
      { _id: groupId, members: req.user._id },
      { $set: { background } },
      { new: false, runValidators: true },
    ).select("_id members background");

    if (!group) {
      return res.status(404).json({
        message: "Group not found or you are not a member.",
      });
    }

    const update = {
      groupId: group._id.toString(),
      background,
      changedBy: {
        id: String(req.user._id),
        username: req.user.username,
      },
    };

    const io = req.app.get("io");

    for (const member of group.members) {
      io?.to(`user:${member}`).emit(
        "group:background:updated",
        update
      );
    }

    if ((group.background || "default") !== background) {
      const actor = req.user.username || "A group member";
      await postGroupNotice(io, group, req.user, `${actor} changed the chat background to ${background}.`);
    }

    return res.json({
      message: "Group background updated.",
      ...update,
    });
  } catch (error) {
    next(error);
  }
});

// Get a group's saved background
router.get("/:groupId/background", requireAuth, async (req, res, next) => {
  try {
    const { groupId } = req.params;

    // Validate group ID
    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID.",
      });
    }

    // Find the group and verify membership
    const group = await Group.findOne({
      _id: groupId,
      members: req.user._id,
    }).select("_id background");

    if (!group) {
      return res.status(404).json({
        message: "Group not found or you are not a member.",
      });
    }

    // Return the saved background
    return res.json({
      groupId: group._id.toString(),
      background: group.background || "default",
    });
  } catch (error) {
    next(error);
  }
});

/* =========================================
   ADD / CHANGE / REMOVE GROUP REACTIONS
========================================= */

router.put(
  "/:groupId/messages/:messageId/reaction",
  requireAuth,
  async (req, res, next) => {
    try {
      const { groupId, messageId } = req.params;
      const userId = String(req.user._id);
      const emoji = req.body?.emoji;

      if (
        !mongoose.isValidObjectId(groupId) ||
        !mongoose.isValidObjectId(messageId)
      ) {
        return res.status(400).json({
          message: "Invalid group or message ID.",
        });
      }

      if (
        typeof emoji !== "string" ||
        !emoji.trim() ||
        emoji.length > 32
      ) {
        return res.status(400).json({
          message: "Invalid emoji reaction.",
        });
      }

      // Only group members can react.
      const group = await Group.findOne({
        _id: groupId,
        members: req.user._id,
      }).select("_id members");

      if (!group) {
        return res.status(403).json({
          message: "You are not a member of this group.",
        });
      }

      const message = await GroupMessage.findOne({
        _id: messageId,
        group: group._id,
        isDeleted: false,
      });

      if (!message) {
        return res.status(404).json({
          message: "Message not found.",
        });
      }

const existing = (message.reactions || []).find(
  (reaction) =>
    String(reaction.user) === userId
);
      if (existing) {
        if (existing.emoji === emoji) {
          // Tapping the same emoji removes it.
          message.reactions = message.reactions.filter(
            (reaction) =>
              String(reaction.user) !== userId
          );
        } else {
          // Replace previous reaction.
          existing.emoji = emoji;
        }
      } else {
        message.reactions.push({
          user: req.user._id,
          emoji,
        });
      }

      await message.save();

      const update = {
        groupId: String(group._id),
        messageId: String(message._id),
        reactions: message.reactions.map((reaction) => ({
          userId: String(reaction.user),
          emoji: reaction.emoji,
          createdAt: reaction.createdAt,
        })),
      };

      // Notify all group members through their
      // existing authenticated user rooms.
      const io = req.app.get("io");

      for (const memberId of group.members) {
        io?.to(`user:${String(memberId)}`).emit(
          "group:message:reaction-updated",
          update
        );
      }

      return res.json(update);
    } catch (error) {
      next(error);
    }
  }
);
router.patch("/:groupId/nickname", requireAuth, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const value = req.body?.nickname;
    const memberId = req.body?.memberId ?? req.user._id;

    if (!mongoose.isValidObjectId(groupId) || !mongoose.isObjectIdOrHexString(memberId) || typeof value !== "string") {
      return res.status(400).json({ message: "Invalid group or nickname." });
    }

    const nickname = value.trim();

    if (nickname.length > 60) {
      return res.status(400).json({
        message: "Nicknames can be at most 60 characters.",
      });
    }

    const userId = String(memberId).toLowerCase();
    const isSelf = userId === String(req.user._id);
    const target = isSelf ? req.user : await User.findById(userId).select("username");
    if (!target) {
      return res.status(404).json({ message: "Group member unavailable." });
    }
    const field = `nicknames.${userId}`;

    const groupBeforeUpdate = await Group.findOneAndUpdate(
      { _id: groupId, members: { $all: [req.user._id, userId] } },
      nickname
        ? { $set: { [field]: nickname } }
        : { $unset: { [field]: 1 } },
      { new: false, runValidators: true, timestamps: false }
    ).select("members nicknames");

    if (!groupBeforeUpdate) {
      return res.status(404).json({ message: "Group unavailable." });
    }

    const previousNickname = groupBeforeUpdate.nicknames?.get(userId) ?? "";
    const username = req.user.username || "A group member";
    const nicknameOwner = isSelf ? "their" : `${target.username || "the member"}’s`;
    let notice = null;

    if (previousNickname !== nickname) {
      notice = nickname
        ? `${username} changed ${nicknameOwner} nickname to ${nickname}.`
        : `${username} reset ${nicknameOwner} nickname.`;
    }

    const update = {
      groupId: String(groupBeforeUpdate._id),
      userId,
      nickname,
      notice,
    };

    const io = req.app.get("io");

    for (const memberId of groupBeforeUpdate.members) {
      io?.to(`user:${memberId}`).emit("group:nickname:updated", update);
    }

    if (notice) {
      await postGroupNotice(io, groupBeforeUpdate, req.user, notice);
    }

    return res.json(update);
  } catch (error) {
    next(error);
  }
});
export default router;
