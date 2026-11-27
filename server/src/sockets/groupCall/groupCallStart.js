import mongoose from "mongoose";

import GroupCall from "../../models/GroupCall.js";
import {
  MAX_PARTICIPANTS,
  getRoomService,
  INVITATION_TTL_MS,
  findMemberGroup,
  getGroupRoomName,
  ensureGroupCallRoom,
  getCallDetails,
  emitToGroupMembers,
} from "./groupCallHelpers.js";

import { sendGroupCallNotification } from "../../services/groupCallNotifications.js";

export function registerGroupCallStart(io, socket, userId) {
  socket.on("group-call:start", async (payload = {}, callback) => {
    let createdCall = null;
    let roomCreated = false;

    try {
      const groupId = String(payload.groupId || "");
      const callType = payload.callType;

      if (!mongoose.isValidObjectId(groupId)) {
        return callback?.({
          ok: false,
          message: "Invalid group ID.",
        });
      }

      if (!["audio", "video"].includes(callType)) {
        return callback?.({
          ok: false,
          message: "Invalid call type.",
        });
      }

      const group = await findMemberGroup(groupId, userId);

      if (!group) {
        return callback?.({
          ok: false,
          message: "You are not a member of this group.",
        });
      }

      const existingCall = await GroupCall.findOne({
        group: group._id,
        status: "active",
      });

      if (existingCall) {
        return callback?.({
          ok: false,
          message: "A group call is already active.",
          call: getCallDetails(existingCall, group),
        });
      }

      const callId = new mongoose.Types.ObjectId();
      const startedAt = new Date();

      const expiresAt = new Date(
        startedAt.getTime() + INVITATION_TTL_MS
      );

      const invitees = group.members
        .map((memberId) => String(memberId))
        .filter((memberId) => memberId !== userId);

      const roomName = getGroupRoomName(groupId, callId);

      createdCall = await GroupCall.create({
        _id: callId,
        group: group._id,
        host: userId,
        roomName,
        callType,
        status: "active",
        maxParticipants: MAX_PARTICIPANTS,
        startedAt,
        invitations: invitees.map((inviteeId) => ({
          user: inviteeId,
          status: "pending",
          invitedAt: startedAt,
          expiresAt,
        })),
      });

await ensureGroupCallRoom(
  roomName,
  MAX_PARTICIPANTS
);

roomCreated = true;

console.log("GROUP CALL ROOM READY:", {
  roomName,
  maxParticipants: MAX_PARTICIPANTS,
  emptyTimeout: 3600,
});

      const callDetails = getCallDetails(createdCall, group);

      await emitToGroupMembers(
        io,
        group,
        "group-call:incoming",
        {
          ...callDetails,
          expiresAt,
          callerId: userId,
          callerName: socket.user.username || "Chatterbox Member",
        },
        userId
      );

      if (invitees.length > 0) {
        try {
          console.log("GROUP CALL PUSH DEBUG:", {
            invitees,
            callId: String(createdCall._id),
            groupId,
            groupName: group.name,
          });

          await sendGroupCallNotification(invitees, {
            callId: String(createdCall._id),
            groupId,
            groupName: group.name,
            callerId: userId,
            callerName: socket.user.username || "Chatterbox Member",
            callType,
            action: "incoming",
            expiresAt: expiresAt.toISOString(),
          });

          console.log("GROUP CALL PUSH REQUEST COMPLETED");
        } catch (notificationError) {
          console.error(
            "Group call push notification error:",
            notificationError
          );
        }
      }

      return callback?.({
        ok: true,
        call: callDetails,
        expiresAt,
      });

    } catch (error) {
      console.error("Group call start error:", error);

      if (createdCall) {
        await GroupCall.updateOne(
          {
            _id: createdCall._id,
            status: "active",
          },
          {
            $set: {
              status: "ended",
              endedAt: new Date(),
              endedBy: userId,
            },
          }
        ).catch((cleanupError) => {
          console.error("Database cleanup error:", cleanupError);
        });
      }

      if (roomCreated && createdCall) {
        try {
          await getRoomService().deleteRoom(createdCall.roomName);
        } catch (cleanupError) {
          console.error("LiveKit cleanup error:", cleanupError);
        }
      }

      if (error?.code === 11000) {
        return callback?.({
          ok: false,
          message: "A group call is already active.",
        });
      }

      return callback?.({
        ok: false,
        message: "Unable to start the group call.",
      });
    }
  });
}
