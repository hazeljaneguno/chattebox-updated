import {
  findMemberGroup,
  findActiveCall,
  getInvitation,
  getCallDetails,
  expirePendingInvitations,
} from "./groupCallHelpers.js";

export function registerGroupCallInvitations(io, socket, userId) {

  // ACCEPT INVITATION
  socket.on("group-call:accept", async (payload = {}, callback) => {
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

      const invitation = getInvitation(call, userId);

      if (!invitation) {
        return callback?.({
          ok: false,
          message: "You were not invited to this call.",
        });
      }

      if (invitation.status === "accepted") {
        return callback?.({
          ok: true,
          call: getCallDetails(call, group),
        });
      }

      if (invitation.status !== "pending") {
        return callback?.({
          ok: false,
          message: "This invitation is no longer available.",
        });
      }

      if (
        !invitation.expiresAt ||
        new Date(invitation.expiresAt) <= new Date()
      ) {
        invitation.status = "missed";
        invitation.respondedAt = new Date();
        await call.save();

        return callback?.({
          ok: false,
          message: "This invitation has expired.",
        });
      }

      invitation.status = "accepted";
      invitation.respondedAt = new Date();

      await call.save();

      const acceptedData = {
        callId,
        groupId,
        userId,
        username: socket.user.username || "Chatterbox Member",
      };

      io.to(`user:${String(call.host)}`).emit(
        "group-call:invitation:accepted",
        acceptedData
      );

      io.to(`group-call:${callId}`).emit(
        "group-call:invitation:accepted",
        acceptedData
      );

      return callback?.({
        ok: true,
        call: getCallDetails(call, group),
      });

    } catch (error) {
      console.error("Group call accept error:", error);

      return callback?.({
        ok: false,
        message: "Unable to accept this invitation.",
      });
    }
  });

  // DECLINE INVITATION
  socket.on("group-call:decline", async (payload = {}, callback) => {
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

      await expirePendingInvitations(io, call, group);

      const invitation = getInvitation(call, userId);

      if (!invitation) {
        return callback?.({
          ok: false,
          message: "You were not invited to this call.",
        });
      }

      if (invitation.status !== "pending") {
        return callback?.({
          ok: false,
          message: "This invitation has already been answered or expired.",
        });
      }

      invitation.status = "declined";
      invitation.respondedAt = new Date();

      await call.save();

      const declinedData = {
        callId,
        groupId,
        userId,
        username: socket.user.username || "Chatterbox Member",
      };

      io.to(`user:${String(call.host)}`).emit(
        "group-call:invitation:declined",
        declinedData
      );

      io.to(`group-call:${callId}`).emit(
        "group-call:invitation:declined",
        declinedData
      );

      return callback?.({ ok: true });

    } catch (error) {
      console.error("Group call decline error:", error);

      return callback?.({
        ok: false,
        message: "Unable to decline this invitation.",
      });
    }
  });
}