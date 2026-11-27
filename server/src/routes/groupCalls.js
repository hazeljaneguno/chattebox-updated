import { randomUUID } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

import Group from "../models/Group.js";
import GroupCall from "../models/GroupCall.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { config } from "../config.js";

const router = Router();

const MAX_PARTICIPANTS = Math.max(
  2,
  Math.min(Number(config.maxGroupCallParticipants) || 10, 10)
);

function getLiveKitClients() {
  const { livekitUrl, livekitApiKey, livekitApiSecret } = config;

  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    throw new Error("LiveKit credentials are not configured.");
  }

  const host = livekitUrl.replace(/^wss:/i, "https:");

  return {
    roomService: new RoomServiceClient(host, livekitApiKey, livekitApiSecret),
  };
}

// A token is issued only to group members who host or have accepted an active call.
router.post("/:groupId/token", requireAuth, async (req, res) => {
 try {
    const { groupId } = req.params;
    const { callId } = req.body || {};
    const userId = String(req.user._id);

    if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(callId)) {
      return res.status(400).json({
        message: "Invalid group ID or call ID.",
      });
    }

    const group = await Group.findOne({
      _id: groupId,
      members: req.user._id,
    }).select("_id name members");

    if (!group) {
      return res.status(403).json({
        message: "You are not a member of this group.",
      });
    }

    const call = await GroupCall.findOne({
      _id: callId,
      group: group._id,
      status: "active",
    });

    if (!call) {
      return res.status(404).json({
        message: "This group call is no longer active.",
      });
    }

    const isHost = String(call.host) === userId;
    const invitation = call.invitations.find(
      (item) => String(item.user) === userId
    );

    if (!isHost && invitation?.status !== "accepted") {
      return res.status(403).json({
        message: "Accept the group call invitation before joining.",
      });
    }

    const { roomService } = getLiveKitClients();

    // The start handler creates the room before clients request tokens.
    const rooms = await roomService.listRooms([call.roomName]);

    if (!rooms.length) {
      return res.status(404).json({
        message: "The LiveKit meeting room is unavailable.",
      });
    }

    const participants = await roomService.listParticipants(call.roomName);
    const alreadyJoined = participants.some(
      (participant) => participant.identity === userId
    );

    const maxParticipants = Math.max(
      1,
      Math.min(
        Number(call.maxParticipants) || MAX_PARTICIPANTS,
        MAX_PARTICIPANTS
      )
    );

    if (!alreadyJoined && participants.length >= maxParticipants) {
      return res.status(409).json({
        message: `This group call is full. Maximum ${maxParticipants} participants.`,
      });
    }

    const accessToken = new AccessToken(
      config.livekitApiKey,
      config.livekitApiSecret,
      {
        identity: userId,
        name: req.user.username || "Chatterbox Member",
        ttl: "10m",
      }
    );

accessToken.addGrant({
  roomJoin: true,
  room: call.roomName,
  canPublish: true,
  canSubscribe: true,
  canPublishData: true,
  canUpdateOwnMetadata: true,
});
    const participantToken = await accessToken.toJwt();

    return res.json({
      serverUrl: config.livekitUrl,
      token: participantToken,
      roomName: call.roomName,
      callId: call._id.toString(),
      callType: call.callType,
      group: {
        id: group._id.toString(),
        name: group.name,
      },
      hostId: String(call.host),
      maxParticipants,
    });
  } catch (error) {
    console.error("Group call token error:", error);

    if (error.message === "LiveKit credentials are not configured.") {
      return res.status(503).json({
        message: "Group calling is not configured yet.",
      });
    }

    return res.status(500).json({
      message: "Unable to join the group call.",
    });
  }
});

// Meeting chat belongs to the active call, separate from the regular group chat.
router.route("/:callId/chat")
  .get(requireAuth, handleMeetingChat)
  .post(requireAuth, handleMeetingChat);

async function handleMeetingChat(req, res, next) {
  try {
    const { callId } = req.params;
    if (!mongoose.isValidObjectId(callId)) {
      return res.status(400).json({ message: "Invalid call ID." });
    }

    const userId = String(req.user._id);
    const access = {
      _id: callId,
      status: "active",
      $or: [
        { host: userId },
        { invitations: { $elemMatch: { user: userId, status: "accepted" } } },
      ],
    };
    const query = GroupCall.findOne(access).select("group");
    if (req.method === "GET") query.select("+meetingMessages");
    const call = await query.lean();
    if (!call || !await Group.exists({ _id: call.group, members: userId })) {
      return res.status(404).json({ message: "Meeting chat is unavailable." });
    }

    if (req.method === "GET") {
      res.set("Cache-Control", "no-store");
      return res.json({ messages: call.meetingMessages ?? [] });
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > 2000) {
      return res.status(400).json({ message: "Enter a message of up to 2,000 characters." });
    }
    const message = {
      id: randomUUID(),
      senderId: userId,
      senderName: req.user.username || "Member",
      text,
      createdAt: new Date(),
    };
    const result = await GroupCall.updateOne(
      access,
      { $push: { meetingMessages: { $each: [message], $slice: -200 } } },
      { timestamps: false, runValidators: true }
    );
    if (!result.matchedCount) {
      return res.status(404).json({ message: "Meeting chat is unavailable." });
    }
    return res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
}

export default router;