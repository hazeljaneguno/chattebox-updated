
import "./ChatHeader.css";

import {
  ArrowLeft,
  Info,
  Phone,
  Video,
  Mail,
} from "lucide-react";

import Avatar from "./Avatar.jsx";

export default function ChatHeader({
  activeChat,
  onlineIds,
  setMobileChatOpen,
  showNotice,
  onStartCall,
  onStartGroupCall,
  onJoinGroupCall,
  ongoingGroupCall,
  callStatus,
  groupCallStatus,
  messageRequestCount = 0,
  setShowMessageRequests,
  onOpenChatDetails,
}) {
  if (!activeChat) return null;

  const isGroup = Boolean(activeChat.isGroup);

  const isOnline =
    onlineIds?.has(String(activeChat.id)) ?? false;

  const hasOngoingGroupCall = Boolean(
    isGroup &&
    ongoingGroupCall &&
    String(ongoingGroupCall.groupId) ===
      String(activeChat.id)
  );

  // START OR JOIN VOICE / VIDEO CALL
  const handleCallClick = (callType) => {
    if (isGroup) {
      // JOIN EXISTING GROUP CALL
      if (hasOngoingGroupCall) {
        if (!onJoinGroupCall) {
          showNotice?.(
            "Joining the group call is not connected yet."
          );
          return;
        }

        onJoinGroupCall(ongoingGroupCall);
        return;
      }

      // START NEW GROUP CALL
      if (!onStartGroupCall) {
        showNotice?.(
          "Group calling is not connected yet."
        );
        return;
      }

      onStartGroupCall(activeChat, callType);
      return;
    }

    // PRIVATE CALL — EXISTING WEBRTC
    if (!onStartCall) {
      showNotice?.("Calling is not connected yet.");
      return;
    }

    onStartCall(activeChat, callType);
  };

  // OPEN MESSAGE REQUESTS
  const handleMessageRequestsClick = () => {
    setShowMessageRequests?.(true);
  };

  // OPEN CHAT INFORMATION
  const handleInformationClick = () => {
    if (!onOpenChatDetails) {
      showNotice?.(
        "Chat information is not connected yet."
      );
      return;
    }

    onOpenChatDetails(activeChat);
  };

  return (
    <header className="chat-header">
      {/* BACK TO CONVERSATIONS */}
      <button
        type="button"
        className="icon-button mobile-back"
        aria-label="Back to people"
        onClick={() => setMobileChatOpen(false)}
      >
        <ArrowLeft size={20} />
      </button>

      {/* CONTACT AVATAR */}
      <Avatar
        name={activeChat.username || activeChat.name}
        online={!isGroup && isOnline}
        small
      />

      {/* CONTACT NAME AND STATUS */}
      <div className="chat-header-copy">
        <h2>
          {isGroup
            ? activeChat.name
            : activeChat.username || activeChat.name}
        </h2>

        <p>
          {isGroup
            ? `${activeChat.members?.length || 0} members`
            : isOnline
              ? (
                <>
                  <i /> Online now
                </>
              )
              : "Messages are private to this conversation"}
        </p>
      </div>

      <div className="header-actions">
        {/* MESSAGE REQUESTS */}
        <button
          type="button"
          className="icon-button message-requests-button"
          aria-label={`Message requests${
            messageRequestCount > 0
              ? `, ${messageRequestCount} pending`
              : ""
          }`}
          title="Message requests"
          onClick={handleMessageRequestsClick}
        >
          <Mail size={19} />

          {messageRequestCount > 0 && (
            <span className="request-count">
              {messageRequestCount > 99
                ? "99+"
                : messageRequestCount}
            </span>
          )}
        </button>

        {/* VOICE CALL */}
        <button
          type="button"
          className="icon-button"
          aria-label={
            isGroup
              ? hasOngoingGroupCall
                ? "Join group voice call"
                : "Start group voice call"
              : "Voice call"
          }
          title={
            isGroup
              ? hasOngoingGroupCall
                ? "Join ongoing group call"
                : "Start group voice call"
              : "Voice call"
          }
          disabled={
            isGroup
              ? [
                  "Checking group call...",
                  "Starting group call...",
                  "Connecting...",
                  "Accepting invitation...",
                  "Connected",
                ].includes(groupCallStatus)
              : !isOnline || Boolean(callStatus)
          }
          onClick={() => handleCallClick("audio")}
        >
          <Phone size={19} />
        </button>

        {/* VIDEO CALL */}
        <button
          type="button"
          className="icon-button"
          aria-label={
            isGroup
              ? hasOngoingGroupCall
                ? "Join group video call"
                : "Start group video call"
              : "Video call"
          }
          title={
            isGroup
              ? hasOngoingGroupCall
                ? "Join ongoing group call"
                : "Start group video call"
              : "Video call"
          }
          disabled={
            isGroup
              ? Boolean(groupCallStatus)
              : !isOnline || Boolean(callStatus)
          }
          onClick={() => handleCallClick("video")}
        >
          <Video size={20} />
        </button>

        <span className="action-divider" />

        {/* INFORMATION BUTTON */}
        <button
          type="button"
          className="icon-button chat-info-button"
          aria-label={
            isGroup
              ? "Open group information"
              : "Open chat information"
          }
          title={
            isGroup
              ? "Group information"
              : "Chat information"
          }
          onClick={handleInformationClick}
        >
          <Info size={21} />
        </button>
      </div>
    </header>
  );
}
