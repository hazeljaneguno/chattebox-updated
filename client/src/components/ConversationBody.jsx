
import { useEffect } from "react";
import {
  MessageCircle,
  LoaderCircle,
} from "lucide-react";

import MessageList from "./MessageList/MessageList.jsx";
import "./ConversationBody.css";

const ACTIVE_STATUSES = new Set([
  "active",
  "ongoing",
  "in_progress",
]);

function normalizeId(value) {
  if (value == null) return null;

  if (typeof value === "object") {
    return normalizeId(value._id ?? value.id);
  }

  return String(value);
}

function normalizeCall(call) {
  if (!call) return null;

  return {
    ...call,
    callId: normalizeId(
      call.callId ?? call._id ?? call.id
    ),
    groupId: normalizeId(
      call.groupId ?? call.group?.id ?? call.group?._id
    ),
    status: String(
      call.status ?? "active"
    ).toLowerCase(),
  };
}

export default function ConversationBody({
  activeChat,
  loadingMessages = false,
  user,
  onReply,
  deleteMessage,
  editingMessageId,
  editDraft,
  savingEdit,
  setEditDraft,
  saveEditedMessage,
  cancelEditing,
  startEditing,
  removeImage,
  bottomRef,
  mentionSuccessToast,
  setMentionSuccessToast,

  // Group call states
  activeGroupCall = null,
  ongoingGroupCall = null,
  onJoinGroupCall,
}) {
  useEffect(() => {
    if (!activeChat || loadingMessages) return;

    bottomRef?.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [
    activeChat?.id,
    activeChat?._id,
    activeChat?.messages?.length,
    loadingMessages,
    bottomRef,
  ]);

  if (!activeChat) return null;

  const messages = Array.isArray(activeChat.messages)
    ? activeChat.messages
    : [];

  const isGroup =
    activeChat.isGroup === true ||
    activeChat.type === "group";

  const chatId = normalizeId(
    activeChat._id ?? activeChat.id
  );

  const connectedCall = normalizeCall(activeGroupCall);
  const availableCall = normalizeCall(ongoingGroupCall);

  // Prefer the call that is already connected.
  // Otherwise show the ongoing call that members can join.
  const callCandidates = [
    connectedCall,
    availableCall,
  ];

  const visibleGroupCall = isGroup
    ? callCandidates.find(
        (call) =>
          call?.callId &&
          call?.groupId === chatId &&
          ACTIVE_STATUSES.has(call.status)
      ) ?? null
    : null;

  const hasActiveGroupCall = Boolean(visibleGroupCall);

  return (
    <div
      className={`conversation-body chat-background-${
        activeChat.background || "default"
      }`}
    >
      <div className="day-divider">
        <span />
        <p>MESSAGES</p>
        <span />
      </div>

      {loadingMessages && (
        <div
          className="loading-messages"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle
            className="spin"
            size={18}
          />

          <span>
            Loading conversation...
          </span>
        </div>
      )}

      {!loadingMessages &&
        messages.length === 0 &&
        !hasActiveGroupCall && (
          <div className="welcome-state">
            <div className="welcome-icon">
              <MessageCircle size={27} />
            </div>

            <h3>
              Say hello to{" "}
              {activeChat.username ||
                activeChat.name ||
                "your friends"}
            </h3>

            <p>
              Your conversation starts here.
              Send the first message!
            </p>
          </div>
        )}

      <MessageList
        messages={messages}
        user={user}
        currentUserId={
          user?.id ??
          user?._id ??
          user?.userId
        }
        activeChat={activeChat}
        isGroup={isGroup}
        onReply={onReply}
        deleteMessage={deleteMessage}
        editingMessageId={editingMessageId}
        editDraft={editDraft}
        savingEdit={savingEdit}
        setEditDraft={setEditDraft}
        saveEditedMessage={saveEditedMessage}
        cancelEditing={cancelEditing}
        startEditing={startEditing}
        removeImage={removeImage}
        mentionSuccessToast={mentionSuccessToast}
        setMentionSuccessToast={setMentionSuccessToast}
        activeGroupCall={visibleGroupCall}
        onJoinGroupCall={onJoinGroupCall}
      />

      <div
        ref={bottomRef}
        className="conversation-bottom-anchor"
        aria-hidden="true"
      />
    </div>
  );
}
