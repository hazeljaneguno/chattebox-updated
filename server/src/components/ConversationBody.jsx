import { useMessageExtras } from "./messageExtras.js";

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

export default function ConversationBody(props) {
  if (!props.activeChat) return null;

  return <ActiveConversationBody {...props} />;
}

function ActiveConversationBody({
  activeChat,
  loadingMessages = false,
  messageJump,
  user,
  socketRef,
  receiptSocket,
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

  const [extras,updateExtra] = useMessageExtras(activeChat.id ?? activeChat._id);
  const messages = (
  Array.isArray(activeChat.messages) ? activeChat.messages : []
).map((message) => ({
  ...message,
  ...extras[String(message.id ?? message._id)],
  reactions: Array.isArray(message.reactions) ? message.reactions : [],
  myReaction: null,
}));
  const act = async (message,action)=>{
    const id=String(message.id??message._id);
    if(action==="pin")return updateExtra(id,{isPinned:!message.isPinned});
    if(action==="reminder") {const when=prompt("Reminder date and time (YYYY-MM-DDTHH:MM):");if(when&&Number.isFinite(new Date(when).getTime()))updateExtra(id,{reminderAt:when});return;}
    if(action==="save-image"&&message.attachment?.url){window.open(message.attachment.url,"_blank","noopener,noreferrer");return;}
    if(action==="forward")return alert("Forwarding needs a recipient selection and backend handler.");
    if(action==="ai-image"||action==="ai-edit")return alert("AI image service is not configured.");
    if(action==="bump"||action==="report")return alert(`${action} requires server support.`);
  };
function react(message, emoji) {
  const currentSocket = socketRef?.current;
  const messageId = normalizeId(message.id ?? message._id);
  const userId = normalizeId(user?.id ?? user?._id ?? user?.userId);

  if (!messageId || !userId) return;

  if (!currentSocket?.connected) {
    alert("Chat is disconnected. Try again when it reconnects.");
    return;
  }

  const currentEmoji = message.reactions.find(
    (reaction) => normalizeId(reaction.userId) === userId
  )?.emoji;

  currentSocket.timeout(5000).emit(
    "message:reaction:set",
    { messageId, isGroup, emoji: currentEmoji === emoji ? null : emoji },
    (error, response) => {
      if (error || !response?.ok) {
        alert(response?.message || "Could not confirm the reaction.");
      }
    }
  );
}
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
        receiptSocket={receiptSocket}
        messageJump={messageJump}
        messages={messages}
        onMessageAction={act}
        onReact={react}
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
