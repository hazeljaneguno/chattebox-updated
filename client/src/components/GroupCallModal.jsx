import { useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  CircleDot,
  Hand,
  LoaderCircle,
  MessageSquare,
  PhoneOff,
  Users,
} from "lucide-react";
import {
  Chat,
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  RoomContext,
  useParticipantAttribute,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";

import "@livekit/components-styles";
import "./GroupCallModal.css";

const HAND_ATTRIBUTE = "chatterbox.handRaised";

function GroupVideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const screenTracks = tracks.filter(
    (track) => track.source === Track.Source.ScreenShare
  );
  const cameraTracks = tracks.filter(
    (track) => track.source === Track.Source.Camera
  );
  const isPresenting = screenTracks.length > 0;

  return (
    <div className="group-video-stage">
      <div
        className={
          isPresenting ? "group-screen-stage" : "group-camera-stage"
        }
        aria-label={isPresenting ? "Shared screens" : "Participant cameras"}
      >
        <GridLayout
          key={isPresenting ? "screens" : "cameras"}
          tracks={isPresenting ? screenTracks : cameraTracks}
          className="group-video-grid"
        >
          <ParticipantTile />
        </GridLayout>
      </div>
    </div>
  );
}

function RaisedHand({ participant }) {
  const raised = useParticipantAttribute(HAND_ATTRIBUTE, { participant });

  if (raised !== "true") return null;

  return (
    <span className="group-call-raised-hand">
      <Hand size={15} aria-hidden="true" />
      {participant.name || participant.identity} raised a hand
    </span>
  );
}

function RaiseHandButton({ participant, connected, onError }) {
  const raised =
    useParticipantAttribute(HAND_ATTRIBUTE, { participant }) === "true";
  const [saving, setSaving] = useState(false);

async function toggleHand() {
  if (!connected || saving) return;

  const nextValue = raised ? "" : "true";
  const attributes = { [HAND_ATTRIBUTE]: nextValue };
  const hasExpectedValue = () =>
    (participant.attributes[HAND_ATTRIBUTE] ?? "") === nextValue;

  setSaving(true);
  onError("");

  try {
    try {
      await participant.setAttributes(attributes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!message.includes("update local metadata timed out")) {
        throw error;
      }

      if (!hasExpectedValue()) {
        await participant.setAttributes(attributes);
      }
    }
  } catch (error) {
    console.error("Could not update raised hand:", error);

    if (!hasExpectedValue()) {
      const message = error instanceof Error ? error.message : String(error);
      onError(`Could not update raised hand: ${message}`);
    }
  } finally {
    setSaving(false);
  }
}

  return (
    <button
      type="button"
      className="lk-button group-call-extra-button"
      aria-pressed={raised}
      disabled={!connected || saving}
      onClick={toggleHand}
    >
      <Hand size={17} aria-hidden="true" />
      {raised ? "Lower hand" : "Raise hand"}
    </button>
  );
}

function GroupCallContent({
  call,
  room,
  connectionState,
  error,
  onClose,
  chatPanelRef,
  onOpenChat,
}) {
  const participants = useParticipants();
  const overlayRef = useRef(null);
  const chatButtonRef = useRef(null);
  const leavingRef = useRef(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const chatPanelId = useId();

  useEffect(() => {
    const overlay = overlayRef.current;
    const viewport = window.visualViewport;

    if (!overlay || !viewport) return;

    function syncViewport() {
      overlay.style.setProperty(
        "--call-viewport-height",
        `${viewport.height}px`
      );
      overlay.style.setProperty(
        "--call-viewport-top",
        `${viewport.offsetTop}px`
      );
    }

    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);

    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
    };
  }, []);

  const isConnecting =
    connectionState === "connecting" ||
    connectionState === "reconnecting" ||
    room.state === ConnectionState.Connecting ||
    room.state === ConnectionState.Reconnecting;

  const isConnected =
    !isConnecting && room.state === ConnectionState.Connected;

  const isAudioCall = call.callType === "audio";
  const displayedError = actionError || error;

  function closeChat() {
    setChatOpen(false);
    chatButtonRef.current?.focus();
  }

function toggleChat() {
  if (chatOpen) {
    closeChat();
  } else {
    setChatOpen(true);
  }
}

  async function handleLeave() {
    if (leavingRef.current || !onClose) return;

    leavingRef.current = true;
    setIsLeaving(true);
    setActionError("");

    try {
      await onClose();
    } catch (error) {
      console.error("Failed to leave group call:", error);
      setActionError("Could not leave the call. Please try again.");
    } finally {
      leavingRef.current = false;
      setIsLeaving(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      className="group-call-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Group call"
      data-lk-theme="default"
    >
      <div className="group-call-modal">
        <header className="group-call-header">
          <div className="group-call-heading">
            <div className="group-call-heading-icon">
              <Users size={21} aria-hidden="true" />
            </div>

            <div>
              <h2>{call.groupName || "Chatterbox Meeting"}</h2>
              <p>
                {isAudioCall ? "Audio meeting" : "Video meeting"}
                {" · "}
                Up to {call.maxParticipants || 10} participants
              </p>
            </div>
          </div>

          <div className="group-call-header-actions">
            <div
              className={`group-call-live${isConnected ? " is-connected" : ""}`}
            >
              {isConnecting ? (
                <LoaderCircle size={14} className="group-call-spinner" />
              ) : (
                <CircleDot size={13} />
              )}

              {isConnecting
                ? "CONNECTING"
                : isConnected
                  ? "LIVE"
                  : "DISCONNECTED"}
            </div>

            <button
              type="button"
              className="group-call-close"
              aria-label={isLeaving ? "Leaving call" : "Leave call"}
              onClick={handleLeave}
              disabled={isLeaving || !onClose}
            >
              <PhoneOff size={18} aria-hidden="true" />
              <span>{isLeaving ? "Leaving..." : "Leave"}</span>
            </button>
          </div>
        </header>

        <div className="group-call-participant-count">
          <Users size={15} aria-hidden="true" />
          <span>
            {participants.length}{" "}
            {participants.length === 1 ? "participant" : "participants"}
          </span>
        </div>

        <div className="group-call-raised-hands" aria-live="polite">
          {participants.map((participant) => (
            <RaisedHand key={participant.identity} participant={participant} />
          ))}
        </div>

        {displayedError && (
          <div className="group-call-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{displayedError}</span>
          </div>
        )}

        <main className="group-call-room">
          <RoomAudioRenderer />

          <div className="group-call-content">
            <GroupVideoGrid />

<aside
  id={chatPanelId}
  className="group-call-chat"
  aria-label="Meeting chat"
  hidden={!chatOpen}
>
  <div className="group-call-chat-header">
    <strong>Meeting chat</strong>
    <button type="button" className="lk-button" onClick={closeChat}>
      Close
    </button>
  </div>

  <div className="group-call-chat-body">
    <Chat />
  </div>
</aside>
          </div>

          <div className="group-call-bottom-controls">
            <ControlBar
              controls={{
                microphone: true,
                camera: !isAudioCall,
                screenShare: !isAudioCall,
                chat: false,
                leave: false,
              }}
            />

            <button
              ref={chatButtonRef}
              type="button"
              className="lk-button group-call-extra-button"
              aria-expanded={chatOpen}
              aria-controls={chatOpen ? chatPanelId : undefined}
              
              onClick={toggleChat}
            >
              <MessageSquare size={17} aria-hidden="true" />
              {chatOpen ? "Hide chat" : "Chat"}
            </button>

            <RaiseHandButton
              participant={room.localParticipant}
              connected={isConnected}
              onError={setActionError}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function GroupCallModal({
  call,
  room,
  connectionState,
  error = "",
  onClose,
  chatPanelRef,
  onOpenChat,
}) {
  if (!call || !room) return null;

  return (
    <RoomContext.Provider value={room}>
      <GroupCallContent
        key={call.callId}
        call={call}
        room={room}
        connectionState={connectionState}
        error={error}
        onClose={onClose}
        chatPanelRef={chatPanelRef}
        onOpenChat={onOpenChat}
      />
    </RoomContext.Provider>
  );
}