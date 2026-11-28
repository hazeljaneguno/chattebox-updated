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
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  RoomContext,
  useParticipantAttribute,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track } from "livekit-client";

import "@livekit/components-styles";
import "./GroupCallModal.css";
import "./CallMessageNotifications.css";

const HAND_ATTRIBUTE = "chatterbox.handRaised";
const MEETING_CHAT_TOPIC = "chatterbox.meeting-chat.v1";

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
  unreadCount = 0,
  latestMessage = null,
}) {
  const participants = useParticipants();
  const overlayRef = useRef(null);
  const chatButtonRef = useRef(null);
  const leavingRef = useRef(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [meetingMessages, setMeetingMessages] = useState([]);
  const [meetingDraft, setMeetingDraft] = useState("");
  const [sendingMeetingMessage, setSendingMeetingMessage] = useState(false);
  const [meetingChatError, setMeetingChatError] = useState("");
  const [meetingUnread, setMeetingUnread] = useState(0);
  const seenMeetingMessageIds = useRef(new Set());
  const meetingMessagesEndRef = useRef(null);
  const chatOpenRef = useRef(false);
  chatOpenRef.current = chatOpen;

  useEffect(() => {
    const decoder = new TextDecoder();
    function handleMeetingData(payload, participant, _kind, topic) {
      if (topic !== MEETING_CHAT_TOPIC) return;
      let message;
      try {
        message = JSON.parse(decoder.decode(payload));
      } catch {
        return;
      }
      if (
        message?.type !== "meeting-message" ||
        String(message.callId) !== String(call.callId) ||
        !message.id ||
        typeof message.text !== "string" ||
        !message.text.trim() ||
        message.text.length > 2000 ||
        !participant
      ) return;
      if (seenMeetingMessageIds.current.has(message.id)) return;
      seenMeetingMessageIds.current.add(message.id);
      const incoming = {
        id: message.id,
        senderId: participant.identity,
        senderName: participant.name || participant.identity || "Member",
        text: message.text.trim(),
        createdAt: Date.now(),
      };
      setMeetingMessages((previous) => [...previous, incoming]);
      if (!chatOpenRef.current) {
        setMeetingUnread((count) => count + 1);
        setPopupMessage(incoming);
      }
    }
    room.on(RoomEvent.DataReceived, handleMeetingData);
    return () => room.off(RoomEvent.DataReceived, handleMeetingData);
  }, [room, call.callId]);

  useEffect(() => {
    if (chatOpen) {
      setMeetingUnread(0);
      setPopupMessage(null);
      meetingMessagesEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [chatOpen, meetingMessages.length]);

  async function sendMeetingMessage(event) {
    event.preventDefault();
    const text = meetingDraft.trim();
    if (!text || sendingMeetingMessage || room.state !== ConnectionState.Connected) return;
    setSendingMeetingMessage(true);
    setMeetingChatError("");
    const message = {
      type: "meeting-message",
      callId: String(call.callId),
      id: `${room.localParticipant.identity}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      text: text.slice(0, 2000),
    };
    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message)),
        { reliable: true, topic: MEETING_CHAT_TOPIC }
      );
      seenMeetingMessageIds.current.add(message.id);
      setMeetingMessages((previous) => [...previous, {
        ...message,
        senderId: room.localParticipant.identity,
        senderName: room.localParticipant.name || "You",
        createdAt: Date.now(),
      }]);
      setMeetingDraft("");
    } catch (error) {
      console.error("Failed to send meeting message:", error);
      setMeetingChatError("Message not sent. Check your connection and try again.");
    } finally {
      setSendingMeetingMessage(false);
    }
  }
  const [popupMessage, setPopupMessage] = useState(null);
  useEffect(() => {
    if (!popupMessage || chatOpen) return;
    const timeout = setTimeout(() => setPopupMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [popupMessage, chatOpen]);
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
    setPopupMessage(null);
    setMeetingUnread(0);
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
            {popupMessage && !chatOpen && (
              <button
                type="button"
                className="group-call-message-popup"
                onClick={toggleChat}
                aria-label="Open new group message"
              >
                <strong>{popupMessage.senderName || "New message"}</strong>
                <span>{popupMessage.text || "Sent a message"}</span>
              </button>
            )}

            {meetingUnread > 0 && !chatOpen && (
              <button
                type="button"
                className="group-call-unread-reminder"
                onClick={toggleChat}
                aria-label={`${meetingUnread} unread meeting messages. Open chat`}
              >
                <MessageSquare size={19} aria-hidden="true" />
                <span className="group-call-message-badge">
                  {meetingUnread > 99 ? "99+" : meetingUnread}
                </span>
              </button>
            )}

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
    <div className="meeting-chat-messages" role="log" aria-live="polite">
      {meetingMessages.length === 0 && (
        <p className="meeting-chat-empty">No meeting messages yet.</p>
      )}
      {meetingMessages.map((message) => (
        <div
          key={message.id}
          className={`meeting-chat-message${
            message.senderId === room.localParticipant.identity ? " mine" : ""
          }`}
        >
          <strong>{message.senderName}</strong>
          <p>{message.text}</p>
        </div>
      ))}
      <div ref={meetingMessagesEndRef} />
    </div>
    {meetingChatError && <p className="meeting-chat-error" role="alert">{meetingChatError}</p>}
    <form className="meeting-chat-composer" onSubmit={sendMeetingMessage}>
      <input
        aria-label="Meeting message"
        placeholder="Message everyone in the call..."
        value={meetingDraft}
        maxLength={2000}
        onChange={(event) => setMeetingDraft(event.target.value)}
      />
      <button type="submit" disabled={!meetingDraft.trim() || sendingMeetingMessage || !isConnected}>
        {sendingMeetingMessage ? "Sending..." : "Send"}
      </button>
    </form>
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
              aria-controls={chatPanelId}
              aria-label={`Chat${meetingUnread > 0 ? `, ${meetingUnread} unread messages` : ""}`}
              onClick={toggleChat}
            >
              <span className="group-call-message-icon">
                <MessageSquare size={17} aria-hidden="true" />
                {meetingUnread > 0 && <span className="group-call-message-badge">{meetingUnread > 99 ? "99+" : meetingUnread}</span>}
              </span>
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
  unreadCount = 0,
  latestMessage = null,
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
        unreadCount={unreadCount}
        latestMessage={latestMessage}
      />
    </RoomContext.Provider>
  );
}
