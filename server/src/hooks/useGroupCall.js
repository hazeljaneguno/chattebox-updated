
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Room,
  RoomEvent,
} from "livekit-client";

import { api } from "../api.js";

// ==========================================
// LIVEKIT ROOM CLEANUP
// ==========================================


async function disconnectRoom(room) {
  if (!room) return;

  try {
    room.removeAllListeners();

    // Wait until LiveKit completely disconnects.
    await room.disconnect();

    console.log("LiveKit room disconnected successfully.");
  } catch (error) {
    console.error("LiveKit disconnect error:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
  }
}

// ==========================================
// GROUP CALL HOOK
// ==========================================

export default function useGroupCall() {
  const roomRef = useRef(null);
  const joiningRef = useRef(false);
  const mountedRef = useRef(false);

  // Identifies the latest join attempt.
  // Prevents an old asynchronous join from continuing.
  const joinAttemptRef = useRef(0);

  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [connectionState, setConnectionState] =
    useState("disconnected");

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [error, setError] = useState("");
  
  const cleanupPromiseRef = useRef(Promise.resolve());
  // ==========================================
  // UPDATE REMOTE PARTICIPANTS
  // ==========================================

  const updateParticipants = useCallback((currentRoom) => {
    if (!currentRoom || !mountedRef.current) return;

    setParticipants(
      Array.from(
        currentRoom.remoteParticipants.values()
      )
    );
  }, []);

  // ==========================================
  // JOIN A GROUP CALL
  // ==========================================

  const joinGroupCall = useCallback(
    async (group, callId) => {
      if (!group?.id) {
        throw new Error("Group information is missing.");
      }

      if (!callId) {
        throw new Error("Group call ID is missing.");
      }

      if (joiningRef.current || roomRef.current) {
        throw new Error(
          "You are already joining or in a group call."
        );
      }

      joiningRef.current = true;

      try{
        await cleanupPromiseRef.current;
      } catch {
        console.error("Previous room cleanup failed:, error");
      }

      const attemptId = ++joinAttemptRef.current;

      let newRoom = null;
      let currentStage = "initializing";

      const isCurrentAttempt = () =>
        mountedRef.current &&
        joinAttemptRef.current === attemptId;

      try {
        setError("");
        setConnectionState("connecting");

        // ==========================================
        // STEP 1: REQUEST LIVEKIT TOKEN
        // ==========================================

        currentStage = "requesting-livekit-token";

        const response = await api.getGroupCallToken(
          group.id,
          callId
        );

        // Stop if this join attempt was cancelled.
        if (!isCurrentAttempt()) {
          return null;
        }

        if (!response?.serverUrl || !response?.token) {
          throw new Error(
            "Invalid LiveKit connection details."
          );
        }

        if (
          String(response.callId) !== String(callId)
        ) {
          throw new Error(
            "The returned call ID does not match."
          );
        }

        const callType = response.callType;

        if (!["audio", "video"].includes(callType)) {
          throw new Error("Invalid group call type.");
        }

        // ==========================================
        // STEP 2: CREATE LIVEKIT ROOM
        // ==========================================

        newRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        roomRef.current = newRoom;

        // ==========================================
        // STEP 3: PARTICIPANT EVENTS
        // ==========================================

        newRoom.on(
          RoomEvent.ParticipantConnected,
          () => {
            updateParticipants(newRoom);
          }
        );

        newRoom.on(
          RoomEvent.ParticipantDisconnected,
          () => {
            updateParticipants(newRoom);
          }
        );

        newRoom.on(
          RoomEvent.TrackSubscribed,
          () => {
            updateParticipants(newRoom);
          }
        );

        newRoom.on(
          RoomEvent.TrackUnsubscribed,
          () => {
            updateParticipants(newRoom);
          }
        );

        // ==========================================
        // STEP 4: CONNECTION STATE
        // ==========================================

        newRoom.on(
          RoomEvent.ConnectionStateChanged,
          (state) => {
            if (!isCurrentAttempt()) return;

            setConnectionState(state);
          }
        );

        // ==========================================
        // STEP 5: HANDLE DISCONNECTION
        // ==========================================

        newRoom.on(
          RoomEvent.Disconnected,
          () => {
            if (!isCurrentAttempt()) return;

            setConnectionState("disconnected");
            setParticipants([]);
            setRoom(null);
            setIsMuted(false);
            setIsCameraOff(false);

            if (roomRef.current === newRoom) {
              roomRef.current = null;
            }
          }
        );

        // ==========================================
        // STEP 6: CONNECT TO LIVEKIT
        // ==========================================

        currentStage = "connecting-to-livekit";

        await newRoom.connect(
          response.serverUrl,
          response.token
        );

        if (!isCurrentAttempt()) {
          disconnectRoom(newRoom);
          return null;
        }

        setRoom(newRoom);

        updateParticipants(newRoom);

        // ==========================================
        // STEP 7: ENABLE MICROPHONE
        // ==========================================

        currentStage = "enabling-microphone";

        await newRoom.localParticipant.setMicrophoneEnabled(
          true
        );

        if (!isCurrentAttempt()) {
          disconnectRoom(newRoom);
          return null;
        }

        setIsMuted(false);

        // ==========================================
        // STEP 8: ENABLE CAMERA
        // ==========================================

        const enableCamera = callType === "video";

        currentStage = "enabling-camera";

        await newRoom.localParticipant.setCameraEnabled(
          enableCamera
        );

        if (!isCurrentAttempt()) {
          disconnectRoom(newRoom);
          return null;
        }

        setIsCameraOff(!enableCamera);

        setConnectionState("connected");

        console.log("GROUP CALL CONNECTED:", {
          groupId: group.id,
          callId,
          callType,
          roomName: response.roomName,
        });

        return response;

      } catch (err) {
        console.error(
          "GROUP CALL CONNECTION FAILED:",
          JSON.stringify(
            {
              stage: currentStage,
              groupId: group?.id,
              callId,
              name: err?.name,
              message: err?.message,
              stack: err?.stack,
              cause: err?.cause?.message,
            },
            null,
            2
          )
        );

        if (newRoom) {
          disconnectRoom(newRoom);
        }

        if (roomRef.current === newRoom) {
          roomRef.current = null;
        }

        if (isCurrentAttempt()) {
          setRoom(null);
          setParticipants([]);
          setConnectionState("disconnected");
          setIsMuted(false);
          setIsCameraOff(false);

          setError(
            err.message ||
              "Could not join the group call."
          );
        }

        throw err;

      } finally {
        // An older attempt must not reset
        // the state of a newer join attempt.
        if (joinAttemptRef.current === attemptId) {
          joiningRef.current = false;
        }
      }
    },
    [updateParticipants]
  );

  // ==========================================
  // LEAVE A GROUP CALL
  // ==========================================

const leaveGroupCall = useCallback(async () => {
  // Cancel pending joins.
  joinAttemptRef.current += 1;
  joiningRef.current = false;

  const currentRoom = roomRef.current;
  roomRef.current = null;

  const previousCleanup = cleanupPromiseRef.current;

  const cleanup = previousCleanup
    .catch(() => {})
    .then(() => disconnectRoom(currentRoom));

  cleanupPromiseRef.current = cleanup;

  if (mountedRef.current) {
    setRoom(null);
    setParticipants([]);
    setConnectionState("disconnected");
    setIsMuted(false);
    setIsCameraOff(false);
    setError("");
  }

  await cleanup;
}, []);

  // ==========================================
  // TOGGLE MICROPHONE
  // ==========================================

  const toggleMicrophone = useCallback(async () => {
    const currentRoom = roomRef.current;

    if (!currentRoom) return;

    try {
      const nextMuted = !isMuted;

      await currentRoom.localParticipant.setMicrophoneEnabled(
        !nextMuted
      );

      if (roomRef.current !== currentRoom) return;

      setIsMuted(nextMuted);

    } catch (err) {
      console.error("Microphone error:", err);

      if (mountedRef.current) {
        setError(
          "Could not change microphone settings."
        );
      }
    }
  }, [isMuted]);

  // ==========================================
  // TOGGLE CAMERA
  // ==========================================

  const toggleCamera = useCallback(async () => {
    const currentRoom = roomRef.current;

    if (!currentRoom) return;

    try {
      const nextCameraOff = !isCameraOff;

      await currentRoom.localParticipant.setCameraEnabled(
        !nextCameraOff
      );

      if (roomRef.current !== currentRoom) return;

      setIsCameraOff(nextCameraOff);

    } catch (err) {
      console.error("Camera error:", err);

      if (mountedRef.current) {
        setError(
          "Could not change camera settings."
        );
      }
    }
  }, [isCameraOff]);

  // ==========================================
  // CLEANUP ON UNMOUNT
  // ==========================================

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      // Invalidate pending asynchronous operations.
      joinAttemptRef.current += 1;

      joiningRef.current = false;

      const currentRoom = roomRef.current;

      roomRef.current = null;

      if (currentRoom) {
        disconnectRoom(currentRoom);
      }
    };
  }, []);

  // ==========================================
  // RETURN
  // ==========================================

  return {
    room,
    participants,
    connectionState,

    isMuted,
    isCameraOff,

    error,

    joinGroupCall,
    leaveGroupCall,

    toggleMicrophone,
    toggleCamera,
  };
}
