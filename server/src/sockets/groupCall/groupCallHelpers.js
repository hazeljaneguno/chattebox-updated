import mongoose from "mongoose";
import { RoomServiceClient } from "livekit-server-sdk";

import Group from "../../models/Group.js";
import GroupCall from "../../models/GroupCall.js";
import { config } from "../../config.js";

export const MAX_PARTICIPANTS = Math.max(
  1,
  Math.min(Number(config.maxGroupCallParticipants) || 10, 10)
);

export const INVITATION_TTL_MS = 30_000;

export function isValidId(value) {
  return mongoose.isValidObjectId(value);
}

export async function ensureGroupCallRoom(
  roomName,
  maxParticipants = MAX_PARTICIPANTS
) {
  if (!roomName) {
    throw new Error("LiveKit room name is missing.");
  }

  const roomService = getRoomService();

  const existingRooms = await roomService.listRooms([
    roomName,
  ]);

  const existingRoom = existingRooms.find(
    (room) => room.name === roomName
  );

  if (existingRoom) {
    console.log("LIVEKIT ROOM ALREADY EXISTS:", roomName);
    return existingRoom;
  }

  console.log("LIVEKIT ROOM MISSING. RECREATING:", roomName);

  try {
    return await roomService.createRoom({
      name: roomName,
      maxParticipants,
      emptyTimeout: 3600,
    });
  } catch (error) {
    // Check whether another request created the room.
    const roomsAfterError = await roomService.listRooms([
      roomName,
    ]);

    const recoveredRoom = roomsAfterError.find(
      (room) => room.name === roomName
    );

    if (recoveredRoom) {
      console.log(
        "LIVEKIT ROOM CREATED BY ANOTHER REQUEST:",
        roomName
      );

      return recoveredRoom;
    }

    throw error;
  }
}

export function getRoomService() {
  const {
    livekitUrl,
    livekitApiKey,
    livekitApiSecret,
  } = config;

  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    throw new Error("LiveKit configuration is missing.");
  }

  const host = livekitUrl
    .replace(/^wss:/i, "https:")
    .replace(/^ws:/i, "http:")
    .replace(/\/+$/, "");

  return new RoomServiceClient(
    host,
    livekitApiKey,
    livekitApiSecret
  );
}

export function getGroupRoomName(groupId, callId) {
  return `chatterbox-group-${groupId}-${callId}`;
}

export function getCallDetails(call, group) {
  return {
    callId: String(call._id),
    groupId: String(group._id),
    groupName: group.name,
    roomName: call.roomName,
    hostId: String(call.host),
    callType: call.callType,
    startedAt: call.startedAt,
    maxParticipants: call.maxParticipants || MAX_PARTICIPANTS,
  };
}

export async function findMemberGroup(groupId, userId) {
  if (!isValidId(groupId)) {
    return null;
  }

  return Group.findOne({
    _id: groupId,
    members: userId,
  }).select("_id name creator members");
}

export async function findActiveCall(groupId, callId) {
  if (!isValidId(groupId) || !isValidId(callId)) {
    return null;
  }

  return GroupCall.findOne({
    _id: callId,
    group: groupId,
    status: "active",
  });
}

export function isCallHost(call, userId) {
  return String(call.host) === String(userId);
}

export function getInvitation(call, userId) {
  return call.invitations.find(
    (invitation) => String(invitation.user) === String(userId)
  );
}

export function canJoinCall(call, userId) {
  if (isCallHost(call, userId)) {
    return true;
  }

  return getInvitation(call, userId)?.status === "accepted";
}

export async function emitToGroupMembers(
  io,
  group,
  event,
  data,
  excludeUserId = null
) {
  for (const memberId of group.members) {
    const memberIdString = String(memberId);

    if (
      excludeUserId &&
      memberIdString === String(excludeUserId)
    ) {
      continue;
    }

    io.to(`user:${memberIdString}`).emit(event, data);
  }
}

export async function getRoomParticipants(roomName) {
  if (!roomName) {
    throw new Error("LiveKit room name is missing.");
  }

  const participants = await getRoomService().listParticipants(
    roomName
  );

  if (!Array.isArray(participants)) {
    throw new Error("LiveKit returned an invalid participant list.");
  }

  return participants;
}

export async function expirePendingInvitations(io, call, group) {
  const now = new Date();
  let changed = false;

  for (const invitation of call.invitations) {
    if (
      invitation.status === "pending" &&
      invitation.expiresAt &&
      new Date(invitation.expiresAt) <= now
    ) {
      invitation.status = "missed";
      invitation.respondedAt = now;
      changed = true;

      const missedData = {
        callId: String(call._id),
        groupId: String(group._id),
        userId: String(invitation.user),
      };

      io.to(`user:${String(invitation.user)}`).emit(
        "group-call:invitation:missed",
        missedData
      );

      io.to(`user:${String(call.host)}`).emit(
        "group-call:invitation:missed",
        missedData
      );
    }
  }

  if (changed) {
    await call.save();
  }

  return changed;
}
