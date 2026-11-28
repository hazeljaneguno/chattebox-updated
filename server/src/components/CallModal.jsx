import { useEffect, useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  UserRound,
  MessageSquare,
} from "lucide-react";

import useCallSounds from "../hooks/useCallSounds";
import "./CallModal.css";
import "./CallMessageNotifications.css";

export default function CallModal({
  call,
  localStream,
  remoteStream,
  connectionState = "idle",
  mediaError = "",
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
  isMuted = false,
  isCameraOff = false,
  isIncoming = false,
  isOutgoing = false,
  unreadCount = 0,
  latestMessage = null,
  onOpenChat,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const isVideo = call?.callType === "video";
  const [popupMessage, setPopupMessage] = useState(null);
  const messageId = latestMessage?.id ?? latestMessage?._id ?? null;
  const messageKey = messageId == null ? null : String(messageId);
  const canShowChatNotifications = Boolean(
    call && !isIncoming && !isOutgoing && onOpenChat
  );
  const unreadTotal = Math.max(0, Number(unreadCount) || 0);

useEffect(() => {
  if (
    !canShowChatNotifications ||
    !messageKey ||
    unreadTotal === 0
  ) {
    setPopupMessage(null);
    return;
  }

  setPopupMessage(latestMessage);

  const timeout = setTimeout(() => {
    setPopupMessage(null);
  }, 4000);

  return () => clearTimeout(timeout);
}, [
  messageKey,
  canShowChatNotifications,
  unreadTotal > 0,
]);
  function openCallChat() {
    if (!onOpenChat) return;
    const opened = onOpenChat();
    if (opened !== false) setPopupMessage(null);
  }

  // ==========================================
  // CALL SOUNDS
  // ==========================================

  useCallSounds({
    call,
    isIncoming,
    isOutgoing,
    connectionState,
  });

  // ==========================================
  // LOCAL CAMERA
  // ==========================================
useEffect(() => {
  if (!isVideo) return;

  const video = localVideoRef.current;
  if (!video) return;

  video.srcObject = localStream || null;

  const videoTracks =
    localStream?.getVideoTracks() || [];

  console.log(
    "LOCAL CAMERA TRACKS:",
    videoTracks.map((track) => ({
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
    }))
  );

  if (videoTracks.length > 0) {
    video.play().catch((error) => {
      console.warn(
        "Local camera preview failed:",
        error
      );
    });
  }

  return () => {
    if (video.srcObject === localStream) {
      video.srcObject = null;
    }
  };
}, [localStream, isVideo]);
  // ==========================================
  // REMOTE CAMERA AND AUDIO (VIDEO CALLS)
  // ==========================================

  useEffect(() => {
    const video = remoteVideoRef.current;

    if (!video) return;

    video.srcObject = remoteStream || null;

    if (remoteStream) {
      video.play().catch((error) => {
        console.warn("Remote video playback:", error);
      });
    }

    return () => {
      video.srcObject = null;
    };
  }, [remoteStream, isVideo]);

  // ==========================================
  // REMOTE AUDIO (VOICE CALLS)
  // ==========================================

  useEffect(() => {
    const audio = remoteAudioRef.current;

    if (!audio) return;

    audio.srcObject = remoteStream || null;

    if (remoteStream) {
      audio.play().catch((error) => {
        console.warn("Remote audio playback:", error);
      });
    }

    return () => {
      audio.srcObject = null;
    };
  }, [remoteStream, isVideo]);

  // ==========================================
  // REMOTE CAMERA AVAILABILITY
  // ==========================================

  const hasRemoteVideo =
    isVideo &&
    Boolean(
      remoteStream?.getVideoTracks().some(
        (track) =>
          track.readyState === "live" &&
          track.enabled &&
          !track.muted
      )
    );

  // ==========================================
  // CALL STATUS
  // ==========================================

  const callStatusText =
    mediaError ||
    (isIncoming
      ? "Wants to connect with you"
      : isOutgoing
        ? "Waiting for an answer..."
        : connectionState === "connected"
          ? "Connected"
          : connectionState === "disconnected" ||
              connectionState === "failed"
            ? "Call disconnected"
            : "Connecting...");

  if (!call) return null;

  return (
    <div className="call-overlay">
      <section
        className="call-modal"
        role="dialog"
        aria-modal="true"
        aria-label={
          isVideo ? "Video call" : "Voice call"
        }
      >
        {/* ==================================
            HEADER
        ================================== */}

        <header className="call-modal-header">
          <span className="call-modal-label">
            {isIncoming
              ? "Incoming call"
              : isOutgoing
                ? "Calling..."
                : isVideo
                  ? "Video call"
                  : "Voice call"}
          </span>

          <button
            type="button"
            className="call-close-button"
            onClick={
              isIncoming ? onDecline : onEnd
            }
            aria-label={
              isIncoming
                ? "Decline call"
                : "End call"
            }
          >
            <PhoneOff size={18} />
          </button>
        </header>

        {/* ==================================
            CALL MEDIA
        ================================== */}

        <div
          className={`call-media-area ${
            isVideo ? "video-call" : ""
          }`}
        >
          {isVideo ? (
            <>
              {/* REMOTE VIDEO */}

              <video
                ref={remoteVideoRef}
                className="remote-video"
                autoPlay
                playsInline
              />

              {!hasRemoteVideo && (
                <div className="call-avatar remote-avatar">
                  <UserRound size={48} />
                  <span>
                    Waiting for their camera...
                  </span>
                </div>
              )}

              {/* LOCAL VIDEO */}

              <div className="local-video-wrapper">
                <video
                  ref={localVideoRef}
                  className="local-video"
                  autoPlay
                  muted
                  playsInline
                  style={{
                    visibility:
                      localStream && !isCameraOff
                        ? "visible"
                        : "hidden",
                  }}
                />

                {(!localStream ||
                  isCameraOff) && (
                  <div className="camera-off-overlay">
                    <UserRound size={24} />

                    <span>
                      {isCameraOff
                        ? "Camera off"
                        : "Camera unavailable"}
                    </span>
                  </div>
                )}

                <span className="local-video-label">
                  You
                </span>
              </div>
            </>
          ) : (
            <>
              {/* REMOTE VOICE AUDIO */}

              <audio
                ref={remoteAudioRef}
                autoPlay
              />

              <div className="call-avatar">
                <UserRound size={48} />
              </div>
            </>
          )}

          {canShowChatNotifications && popupMessage && (
            <button
              type="button"
              className="call-message-popup"
              onClick={openCallChat}
            >
              <strong>{popupMessage.senderName || "New message"}</strong>
              <span>{popupMessage.text || "Sent a message"}</span>
            </button>
          )}

          {canShowChatNotifications && unreadTotal > 0 && (
            <button
              type="button"
              className="call-unread-reminder"
              onClick={openCallChat}
              aria-label={`Open chat, ${unreadTotal} unread messages`}
            >
              <MessageSquare size={20} aria-hidden="true" />
              <span className="call-chat-badge">
                {unreadTotal > 99 ? "99+" : unreadTotal}
              </span>
            </button>
          )}

          {/* ==================================
              CALL INFORMATION
          ================================== */}

          <div className="call-person-info">
            <h2>
              {call.displayName ||
                "Chatterbox user"}
            </h2>

            <p role="status">
              {callStatusText}
            </p>
          </div>
        </div>

        {/* ==================================
            CALL CONTROLS
        ================================== */}

        <footer className="call-controls">
          {isIncoming ? (
            <>
              <button
                type="button"
                className="call-action decline"
                onClick={onDecline}
                aria-label="Decline call"
              >
                <PhoneOff />
                <span>Decline</span>
              </button>

              <button
                type="button"
                className="call-action accept"
                onClick={onAccept}
                aria-label="Accept call"
              >
                <Phone />
                <span>Accept</span>
              </button>
            </>
          ) : (
            <>
              {!isOutgoing && (
                <>
                  {/* MICROPHONE */}

                  <button
                    type="button"
                    className={`call-action secondary ${
                      isMuted ? "active" : ""
                    }`}
                    onClick={onToggleMute}
                    aria-label={
                      isMuted ? "Unmute" : "Mute"
                    }
                  >
                    {isMuted ? (
                      <MicOff />
                    ) : (
                      <Mic />
                    )}

                    <span>
                      {isMuted
                        ? "Unmute"
                        : "Mute"}
                    </span>
                  </button>

                  {/* CAMERA */}

                  {isVideo && (
                    <button
                      type="button"
                      className={`call-action secondary ${
                        isCameraOff ? "active" : ""
                      }`}
                      onClick={onToggleCamera}
                      aria-label={
                        isCameraOff
                          ? "Turn camera on"
                          : "Turn camera off"
                      }
                    >
                      {isCameraOff ? (
                        <VideoOff />
                      ) : (
                        <Video />
                      )}

                      <span>
                        {isCameraOff
                          ? "Camera on"
                          : "Camera off"}
                      </span>
                    </button>
                  )}
                </>
              )}
                
              {!isOutgoing && onOpenChat && (
                <button type="button" className="call-action secondary call-message-button" onClick={openCallChat} aria-label={`Chat, ${unreadTotal} unread messages`}>
                  <span className="call-message-icon"><MessageSquare />
                    {unreadTotal > 0 && <span className="call-message-badge">{unreadTotal > 99 ? "99+" : unreadTotal}</span>}
                  </span>
                  <span>Chat</span>
                </button>
              )}

              {/* END CALL */}

              <button
                type="button"
                className="call-action decline"
                onClick={onEnd}
                aria-label="End call"
              >
                <PhoneOff />
                <span>End call</span>
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
