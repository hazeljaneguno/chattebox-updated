
import mongoose from "mongoose";
import GroupCall from "../../models/GroupCall.js";

import {
  findMemberGroup,
  findActiveCall,
  getInvitation,
  getCallDetails,
  isCallHost,
  canJoinCall,
  expirePendingInvitations,
  getRoomParticipants,
  ensureGroupCallRoom,
  getRoomService,
  MAX_PARTICIPANTS,
} from "./groupCallHelpers.js";

// ==========================================
// LOGGING HELPER
// ==========================================

function createStageLogger(handler, userId) {
  const startedAt = Date.now();

  return (stage) => {
    console.log(`${handler} STAGE:`, {
      stage,
      elapsedMs: Date.now() - startedAt,
      userId,
    });
  };
}

// ==========================================
// ACKNOWLEDGEMENT HELPER
// ==========================================

function acknowledge(callback, result) {
  if (typeof callback !== "function") {
    console.error(
      "GROUP CALL ERROR: Socket.IO acknowledgement callback is missing."
    );

    return;
  }

  callback(result);
}

// ==========================================
// GROUP CALL JOIN HANDLERS
// ==========================================

export function registerGroupCallJoin(io, socket, userId) {
  const authenticatedUserId = String(userId);

  // ==========================================
  // 1. JOIN AN ACTIVE GROUP CALL
  // ==========================================

  socket.on("group-call:join", async (payload = {}, callback) => {
    let currentStage = "Starting group call join";

    const logStage = createStageLogger(
      "GROUP CALL JOIN",
      authenticatedUserId
    );

    try {
      // ==========================================
      // STEP 1: VALIDATE IDS
      // ==========================================

      currentStage = "Validating IDs";

      const groupId = String(payload.groupId || "");
      const callId = String(payload.callId || "");

      if (
        !mongoose.isObjectIdOrHexString(groupId) ||
        !mongoose.isObjectIdOrHexString(callId)
      ) {
        return acknowledge(callback, {
          ok: false,
          message: "Invalid group ID or call ID.",
        });
      }

      logStage(currentStage);

      // ==========================================
      // STEP 2: CHECK GROUP MEMBERSHIP
      // ==========================================

      currentStage = "Checking group membership";

      const group = await findMemberGroup(
        groupId,
        authenticatedUserId
      );

      if (!group) {
        return acknowledge(callback, {
          ok: false,
          message: "You are not a member of this group.",
        });
      }

      logStage(currentStage);

      // ==========================================
      // STEP 3: FIND ACTIVE CALL
      // ==========================================

      currentStage = "Finding active call";

      const call = await findActiveCall(groupId, callId);

      if (!call) {
        return acknowledge(callback, {
          ok: false,
          message: "This group call is no longer active.",
        });
      }

      logStage(currentStage);

      // ==========================================
      // STEP 4: EXPIRE OLD INVITATIONS
      // ==========================================

      currentStage = "Checking invitation expiration";

      await expirePendingInvitations(io, call, group);

      logStage(currentStage);

      // ==========================================
      // STEP 5: CHECK INVITATION PERMISSIONS
      // ==========================================

      currentStage = "Checking invitation permissions";

      const host = isCallHost(
        call,
        authenticatedUserId
      );

      let invitation = getInvitation(
        call,
        authenticatedUserId
      );

      if (!host) {
        if (!invitation) {
          call.invitations.push({ user: authenticatedUserId, status: "pending", invitedAt: new Date(), expiresAt: new Date() });
          invitation = call.invitations[call.invitations.length - 1];
        }


        if (
          !["pending", "missed", "accepted", "declined"].includes(
            invitation.status
          )
        ) {
          return acknowledge(callback, {
            ok: false,
            message: "You cannot join this group call.",
          });
        }
      }

      logStage(currentStage);

      // ==========================================
      // STEP 6: CALCULATE PARTICIPANT LIMIT
      // ==========================================

      currentStage = "Checking participant limit";

      const maxParticipants = Math.max(
        1,
        Math.min(
          Number(call.maxParticipants) || MAX_PARTICIPANTS,
          MAX_PARTICIPANTS
        )
      );

      logStage(currentStage);

      // ==========================================
      // STEP 7: ENSURE LIVEKIT ROOM EXISTS
      // ==========================================

      currentStage = "Ensuring LiveKit room exists";

      console.log("GROUP CALL ROOM CHECK:", {
        callId: String(call._id),
        groupId: String(group._id),
        roomName: call.roomName,
        userId: authenticatedUserId,
        isHost: host,
        maxParticipants,
      });

      const rooms = await getRoomService().listRooms([call.roomName]);
      if (!rooms.length) throw new Error("This call room is no longer available.");

      logStage(currentStage);

      // ==========================================
      // STEP 8: GET LIVEKIT PARTICIPANTS
      // ==========================================

      currentStage = "Checking LiveKit participants";

      const participants = await getRoomParticipants(
        call.roomName
      );

      console.log("LIVEKIT PARTICIPANTS:", {
        roomName: call.roomName,
        count: participants.length,
        identities: participants.map((participant) =>
          String(participant.identity)
        ),
      });

      logStage(currentStage);

      // ==========================================
      // STEP 9: CHECK WHETHER USER ALREADY JOINED
      // ==========================================

      currentStage = "Checking existing participant";

      const alreadyJoined = participants.some(
        (participant) =>
          String(participant.identity) === authenticatedUserId
      );

      // ==========================================
      // STEP 10: ENFORCE PARTICIPANT LIMIT
      // ==========================================

      currentStage = "Enforcing participant limit";

      if (
        !alreadyJoined &&
        participants.length >= maxParticipants
      ) {
        return acknowledge(callback, {
          ok: false,
          message:
            `This group call is full. ` +
            `Maximum participants: ${maxParticipants}.`,
        });
      }

      logStage(currentStage);

      // ==========================================
      // STEP 11: ACCEPT INVITATION
      // ==========================================

      currentStage = "Accepting invitation";

      if (
        !host &&
        ["pending", "missed"].includes(invitation.status)
      ) {
        invitation.status = "accepted";
        invitation.respondedAt = new Date();

        await call.save();

        logStage("Invitation saved");

        io.to(`user:${String(call.host)}`).emit(
          "group-call:invitation:accepted",
          {
            callId: String(call._id),
            groupId: String(group._id),
            userId: authenticatedUserId,
            username:
              socket.user?.username || "Chatterbox Member",
          }
        );
      }

      // ==========================================
      // STEP 12: RETURN CALL DETAILS
      // ==========================================

      currentStage = "Returning call details";

      const callDetails = {
        ...getCallDetails(call, group),
        maxParticipants,
      };

      console.log("GROUP CALL JOIN SUCCESS:", {
        callId: String(call._id),
        userId: authenticatedUserId,
        roomName: call.roomName,
        isHost: host,
        elapsedMs: Date.now() -
          Number(logStage.startedAt || Date.now()),
      });

      logStage(currentStage);

      return acknowledge(callback, {
        ok: true,
        call: callDetails,
      });

    } catch (error) {
      console.error(
        "========== GROUP CALL JOIN ERROR =========="
      );

      console.error("Failed stage:", currentStage);
      console.error("User ID:", authenticatedUserId);
      console.error("Message:", error.message);
      console.error("Name:", error.name);
      console.error("Code:", error.code);
      console.error("Stack:", error.stack);

      console.error(
        "============================================"
      );

      return acknowledge(callback, {
        ok: false,
        message:
          error.message || "Unable to join the group call.",
      });
    }
  });

  // ==========================================
  // 2. JOIN SOCKET.IO NOTIFICATION ROOM
  // ==========================================

  socket.on(
    "group-call:socket-join",
    async (payload = {}, callback) => {
      let currentStage = "Starting Socket.IO group call join";

      const logStage = createStageLogger(
        "GROUP CALL SOCKET JOIN",
        authenticatedUserId
      );

      try {
        // ==========================================
        // STEP 1: VALIDATE IDS
        // ==========================================

        currentStage = "Validating IDs";

        const groupId = String(payload.groupId || "");
        const callId = String(payload.callId || "");

        if (
          !mongoose.isObjectIdOrHexString(groupId) ||
          !mongoose.isObjectIdOrHexString(callId)
        ) {
          return acknowledge(callback, {
            ok: false,
            message: "Invalid group ID or call ID.",
          });
        }

        logStage(currentStage);

        // ==========================================
        // STEP 2: VERIFY GROUP MEMBERSHIP
        // ==========================================

        currentStage = "Checking group membership";

        const group = await findMemberGroup(
          groupId,
          authenticatedUserId
        );

        if (!group) {
          return acknowledge(callback, {
            ok: false,
            message: "You are not a member of this group.",
          });
        }

        logStage(currentStage);

        // ==========================================
        // STEP 3: VERIFY ACTIVE CALL
        // ==========================================

        currentStage = "Finding active call";

        const call = await findActiveCall(groupId, callId);

        if (!call) {
          return acknowledge(callback, {
            ok: false,
            message: "This group call is no longer active.",
          });
        }

        logStage(currentStage);

        // ==========================================
        // STEP 4: CHECK CALL PERMISSIONS
        // ==========================================

        currentStage = "Checking call permissions";

        if (!canJoinCall(call, authenticatedUserId)) {
          return acknowledge(callback, {
            ok: false,
            message: "Accept the invitation before joining.",
          });
        }

        logStage(currentStage);

        // ==========================================
        // STEP 5: JOIN SOCKET.IO ROOM
        // ==========================================

        currentStage = "Joining Socket.IO room";

        const socketRoom = `group-call:${callId}`;

        await socket.join(socketRoom);

        logStage(currentStage);

        console.log("GROUP CALL SOCKET JOIN SUCCESS:", {
          userId: authenticatedUserId,
          callId,
          socketRoom,
        });

        return acknowledge(callback, {
          ok: true,
          call: getCallDetails(call, group),
        });

      } catch (error) {
        console.error("GROUP CALL SOCKET JOIN ERROR:", {
          stage: currentStage,
          userId: authenticatedUserId,
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack,
        });

        return acknowledge(callback, {
          ok: false,
          message:
            error.message ||
            "Unable to join group call notifications.",
        });
      }
    }
  );

  // ==========================================
  // 3. RECOVER AN ACTIVE GROUP CALL
  // ==========================================

  socket.on(
    "group-call:get-active",
    async (payload = {}, callback) => {
      let currentStage = "Starting group call recovery";

      const logStage = createStageLogger(
        "GROUP CALL RECOVERY",
        authenticatedUserId
      );

      try {
        // ==========================================
        // STEP 1: VALIDATE GROUP ID
        // ==========================================

        currentStage = "Validating group ID";

        const groupId = String(payload.groupId || "");

        if (!mongoose.isObjectIdOrHexString(groupId)) {
          return acknowledge(callback, {
            ok: false,
            message: "Invalid group ID.",
          });
        }

        logStage(currentStage);

        // ==========================================
        // STEP 2: VERIFY GROUP MEMBERSHIP
        // ==========================================

        currentStage = "Checking group membership";

        const group = await findMemberGroup(
          groupId,
          authenticatedUserId
        );

        if (!group) {
          return acknowledge(callback, {
            ok: false,
            message: "You are not a member of this group.",
          });
        }

        logStage(currentStage);

        // ==========================================
        // STEP 3: FIND ACTIVE CALL
        // ==========================================

        currentStage = "Finding active group call";

        const call = await GroupCall.findOne({
          group: group._id,
          status: "active",
        });

        if (!call) {
          logStage("No active call found");

          return acknowledge(callback, {
            ok: true,
            call: null,
            invitationStatus: null,
          });
        }

        logStage(currentStage);

        // ==========================================
        // STEP 4: EXPIRE OLD INVITATIONS
        // ==========================================

        currentStage = "Checking invitation expiration";

        await expirePendingInvitations(io, call, group);

        logStage(currentStage);

        // ==========================================
        // STEP 5: CHECK INVITATION STATUS
        // ==========================================

        currentStage = "Checking invitation status";

        const invitation = getInvitation(
          call,
          authenticatedUserId
        );

        const invitationStatus = isCallHost(
          call,
          authenticatedUserId
        )
          ? "host"
          : invitation?.status || "pending";

        logStage(currentStage);

        // ==========================================
        // STEP 6: RETURN ACTIVE CALL
        // ==========================================

        currentStage = "Returning active call";

        console.log("GROUP CALL RECOVERY:", {
          callId: String(call._id),
          groupId: String(group._id),
          userId: authenticatedUserId,
          invitationStatus,
        });

        const callDetails = getCallDetails(call, group);

        logStage(currentStage);

        return acknowledge(callback, {
          ok: true,
          call: callDetails,
          invitationStatus,
        });

      } catch (error) {
        console.error("GROUP CALL RECOVERY ERROR:", {
          stage: currentStage,
          userId: authenticatedUserId,
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack,
        });

        return acknowledge(callback, {
          ok: false,
          message:
            error.message ||
            "Unable to recover the active group call.",
        });
      }
    }
  );
}