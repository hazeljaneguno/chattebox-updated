import { sendGroupCallNotification } from "../../services/groupCallNotifications.js";
import {
  findMemberGroup,
  findActiveCall,
  getInvitation,
  isCallHost,
  getRoomService,
  emitToGroupMembers,
} from "./groupCallHelpers.js";

export function registerGroupCallLifecycle(io, socket, userId) {

  // LEAVE GROUP CALL
  socket.on("group-call:leave", async (payload = {}, callback) => {
    try {
      const groupId = String(payload.groupId || "");
      const callId = String(payload.callId || "");

      const group = await findMemberGroup(groupId, userId);

      if (!group) {
        return callback?.({
          ok: false,
          message: "You are not a member of this group.",
        });
      }

      const call = await findActiveCall(groupId, callId);

      if (!call) {
        socket.leave(`group-call:${callId}`);

        return callback?.({ ok: true });
      }

      const invitation = getInvitation(call, userId);

// Update the participant's leave time.
if (invitation?.status === "accepted") {
  invitation.leftAt = new Date();
  await call.save();
}

// Explicitly remove the participant from LiveKit.
try {
  await getRoomService().removeParticipant(
    call.roomName,
    String(userId)
  );

  console.log("GROUP CALL LIVEKIT PARTICIPANT REMOVED:", {
    callId,
    userId: String(userId),
    roomName: call.roomName,
  });
} catch (roomError) {
  console.error(
    "LiveKit participant removal warning:",
    roomError.message
  );
}

// Leave the Socket.IO notification room.
socket.leave(`group-call:${callId}`);

// Notify the remaining participants.
io.to(`group-call:${callId}`).emit(
  "group-call:participant-left",
  {
    callId,
    groupId,
    userId: String(userId),
  }
);

      return callback?.({ ok: true });

    } catch (error) {
      console.error("Group call leave error:", error);

      return callback?.({
        ok: false,
        message: "Unable to leave the group call.",
      });
    }
  });

  // END GROUP CALL
  socket.on("group-call:end", async (payload = {}, callback) => {
    try {
      const groupId = String(payload.groupId || "");
      const callId = String(payload.callId || "");

      const group = await findMemberGroup(groupId, userId);

      if (!group) {
        return callback?.({
          ok: false,
          message: "You are not a member of this group.",
        });
      }

      const call = await findActiveCall(groupId, callId);

      if (!call) {
        return callback?.({
          ok: false,
          message: "This group call is no longer active.",
        });
      }

      if (!isCallHost(call, userId)) {
        return callback?.({
          ok: false,
          message: "Only the call host can end this call.",
        });
      }

      call.status = "ended";
      call.endedAt = new Date();
      call.endedBy = userId;

      for (const invitation of call.invitations) {
        if (invitation.status === "pending") {
          invitation.status = "missed";
          invitation.respondedAt = new Date();
        }
      }

      await call.save();
      const endedData = {
        callId,
        groupId,
        endedBy: userId,
        callType: call.callType,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
      };

      await emitToGroupMembers(
        io,
        group,
        "group-call:ended",
        endedData
      );

      callback?.({ ok: true });

      await sendGroupCallNotification(group.members, { callId, groupId, groupName: group.name, callerId: userId, callType: call.callType, action: "ended" }).catch((error) => {
        console.error("Group call end notification error:", error);
      });

      try {
        await getRoomService().deleteRoom(call.roomName);
      } catch (roomError) {
        console.error("LiveKit room deletion error:", roomError);
      }
      return;


    } catch (error) {
      console.error("Group call end error:", error);

      return callback?.({
        ok: false,
        message: "Unable to end the group call.",
      });
    }
  });
}
