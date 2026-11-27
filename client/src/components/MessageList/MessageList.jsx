
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  LoaderCircle,
  Clock3,
} from "lucide-react";

import {
  sameId,
  getMessageId,
  getAttachmentUrl,
  getAttachmentMediaType,
} from "../../utils/messageHelpers";

import "./MessageStyles.css";

import { initials, colorFor } from "../Avatar.jsx";
import MessageBubble from "./MessageBubble.jsx";
import MessageLightbox from "./MessageLightbox.jsx";

const ACTIVE_STATUSES = new Set([
  "active",
  "ongoing",
  "in_progress",
]);

const ENDED_STATUSES = new Set([
  "ended",
  "completed",
  "finished",
  "cancelled",
  "canceled",
  "failed",
  "missed",
]);

  
function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const MESSAGE_BATCH_GAP_MS = 30 * 60 * 1000;

function startsMessageBatch(current, previous) {
  if (!current || !Number.isFinite(current.getTime())) return false;
  return !previous ||
    previous.toDateString() !== current.toDateString() ||
    current - previous >= MESSAGE_BATCH_GAP_MS;
}

function formatDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return "";

  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start
  ) {
    return "";
  }

  const totalSeconds = Math.floor((end - start) / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function getCallId(call) {
  return normalizeId(
    call?.callId ?? call?._id ?? call?.id
  );
}
function normalizeId(value) {
  if (value == null) return null;

  const id = String(value).trim();
  return id || null;
}

function getCallStatus(call) {
  return String(call?.status ?? "").toLowerCase();
}

function getCallType(call) {
  return call?.callType === "audio" ||
    call?.type === "audio"
    ? "audio"
    : "video";
}

function getCallStartedAt(call) {
  return (
    call?.startedAt ??
    call?.createdAt ??
    call?.startTime ??
    null
  );
}

function getCallEndedAt(call) {
  return call?.endedAt ?? call?.endTime ?? null;
}

function isCallEvent(message) {
  const type = String(
    message?.type ?? message?.messageType ?? ""
  ).toLowerCase();

  return [
    "group_call",
    "group-call",
    "group_call_started",
    "group_call_ended",
    "call",
    "call_event",
  ].includes(type);
}

function getEventCall(message) {
  return message?.call &&
    typeof message.call === "object"
    ? { ...message.call, ...message }
    : message;
}

function getEventStatus(message) {
  const event = getEventCall(message);
  const type = String(
    message?.type ?? message?.messageType ?? ""
  ).toLowerCase();

  if (type === "group_call_ended") return "ended";

  if (type === "group_call_started") {
    return getCallStatus(event) || "active";
  }

  return getCallStatus(event);
}

function CallEvent({
  call,
  live = false,
  joining = false,
  onJoin,
  error = "",
}) {
  const audio = getCallType(call) === "audio";
  const status = getCallStatus(call);
  const active = live && ACTIVE_STATUSES.has(status);

  const startedAt = getCallStartedAt(call);
  const endedAt = getCallEndedAt(call);
  const duration = formatDuration(startedAt, endedAt);

  const Icon = audio
    ? active ? Phone : PhoneOff
    : active ? Video : VideoOff;

  const kind = audio ? "voice" : "video";

  return (
    <section
      className={`message-group-call ${
        active ? "is-active" : "is-ended"
      }`}
      aria-label={`Group ${kind} call ${
        active ? "in progress" : "ended"
      }`}
    >
      <div className="message-group-call-heading">
        <div className="message-group-call-icon">
          <Icon size={22} />
        </div>

        <div className="message-group-call-text">
          <strong>
            Group {kind} call{" "}
            {active ? "started" : "ended"}
          </strong>

          {startedAt && (
            <p>
              Started: {formatDateTime(startedAt)}
            </p>
          )}

          {!active && endedAt && (
            <p>
              Ended: {formatDateTime(endedAt)}
            </p>
          )}

          {!active && duration && (
            <p>
              <Clock3 size={13} style={{
                verticalAlign: "middle",
                marginRight: 4,
              }} />
              Duration: {duration}
            </p>
          )}

          {active && (
            <p>
              A group call is happening now.
              Join your friends in the conversation.
            </p>
          )}
        </div>
      </div>

      {active && (
        <button
          type="button"
          className="message-group-call-join"
          onClick={onJoin}
          disabled={joining || !onJoin}
        >
          {joining ? (
            <>
              <LoaderCircle
                size={18}
                className="message-call-spinner"
              />
              Joining call...
            </>
          ) : (
            <>
              {audio ? (
                <Phone size={18} />
              ) : (
                <Video size={18} />
              )}
              Join {audio ? "Voice" : "Video"} Call
            </>
          )}
        </button>
      )}

      {error && (
        <p
          className="message-group-call-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  );
}

export default function MessageList({
  
  messages = [],
  messageJump,
  user,
  currentUserId,
  activeChat,
  isGroup = false,
  editingMessageId,
  editDraft,
  savingEdit,
  setEditDraft,
  saveEditedMessage,
  cancelEditing,
  startEditing,
  onReply,
  removeImage,
  deleteMessage,
  activeGroupCall = null,
  onJoinGroupCall,
  onMessageAction,
  onReact,
  receiptSocket,
}) {
  const swipeStartRef = useRef(null);
  const messageRefs = useRef(new Map());
  const pendingSeenReceipts = useRef(new Set());
  const highlightTimerRef = useRef(null);
  const joiningRef = useRef(false);
  const holdTimerRef = useRef(null);
  const holdStartRef = useRef(null);
  const heldPhotoRef = useRef(null);

  const [openPhoto, setOpenPhoto] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] =
    useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteType, setDeleteType] = useState("deleteForYou");
  const [joiningCall, setJoiningCall] = useState(false);
  const [joinError, setJoinError] = useState("");

  const safeMessages = Array.isArray(messages)
    ? messages
    : [];

  const loggedInUserId =
    currentUserId ??
    user?.id ??
    user?._id ??
    user?.userId;

  useEffect(() => {
    if (!receiptSocket?.connected || !loggedInUserId || !window.IntersectionObserver) return;

    const unseenRows = new Map();
    for (const message of safeMessages) {
      if (!message?.senderId || sameId(message.senderId, loggedInUserId) || message.isDeleted) continue;
      if (message.type && !["text", "image", "audio", "video", "file"].includes(message.type)) continue;
      if (message.readBy?.some(({ userId }) => sameId(userId, loggedInUserId))) continue;
      const id = getMessageId(message);
      const row = id == null ? null : messageRefs.current.get(String(id));
      if (row) unseenRows.set(row, String(id));
    }
    if (!unseenRows.size) return;

    const event = isGroup ? "group:message:receipt" : "message:receipt";
    const observer = new IntersectionObserver((entries) => {
      if (document.visibilityState !== "visible" || !receiptSocket.connected) return;
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        const messageId = unseenRows.get(target);
        if (!messageId || pendingSeenReceipts.current.has(messageId)) continue;
        pendingSeenReceipts.current.add(messageId);
        receiptSocket.timeout(5000).emit(event, { messageId, status: "seen" }, () => {
          pendingSeenReceipts.current.delete(messageId);
        });
      }
    });

    function observeVisibleRows() {
      observer.disconnect();
      if (document.visibilityState === "visible") {
        for (const row of unseenRows.keys()) observer.observe(row);
      }
    }

    observeVisibleRows();
    document.addEventListener("visibilitychange", observeVisibleRows);
    return () => {
      document.removeEventListener("visibilitychange", observeVisibleRows);
      observer.disconnect();
    };
  }, [safeMessages, loggedInUserId, isGroup, receiptSocket]);

  const messageMap = useMemo(() => {
    return new Map(
      safeMessages
        .filter(
          (message) =>
            message && getMessageId(message) != null
        )
        .map((message) => [
          String(getMessageId(message)),
          message,
        ])
    );
  }, [messages]);

  const chatId = normalizeId(
    activeChat?._id ?? activeChat?.id
  );

  const callGroupId = normalizeId(
    activeGroupCall?.groupId
  );

  const callId = getCallId(activeGroupCall);
  const callStatus = getCallStatus(activeGroupCall);
  const callType = getCallType(activeGroupCall);

  const hasActiveGroupCall =
    isGroup &&
    chatId != null &&
    callGroupId != null &&
    chatId === callGroupId &&
    callId != null &&
    ACTIVE_STATUSES.has(callStatus);

  const callEventIds = useMemo(() => {
    const ids = new Set();

    for (const message of safeMessages) {
      if (!isCallEvent(message)) continue;

      const id = getCallId(getEventCall(message));

      if (id) ids.add(id);
    }

    return ids;
  }, [safeMessages]);

  // Avoid duplicating a call already represented
  // by a persisted message event.
  const showLiveBanner =
    hasActiveGroupCall &&
    !callEventIds.has(callId);

  useEffect(() => {
    setJoinError("");
    setJoiningCall(false);
    joiningRef.current = false;
  }, [chatId, callId]);

  useEffect(() => {
    return () => {
      clearTimeout(holdTimerRef.current);
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);
function getSenderDisplayName(message) {
  const sender = message?.sender;

  return (
    message?.senderName ||
    sender?.displayName ||
    sender?.username ||
    sender?.name ||
    "Unknown sender"
  );
}
  function getSenderId(message) {
    if (message.senderId != null) {
      return message.senderId;
    }

    if (
      typeof message.sender === "object" &&
      message.sender !== null
    ) {
      return (
        message.sender._id ??
        message.sender.id
      );
    }

    return message.sender;
  }

  function isMine(message) {
    return sameId(
      getSenderId(message),
      loggedInUserId
    );
  }

  function getReplyTarget(message) {
    const replyId =
      typeof message.replyTo === "object" &&
      message.replyTo !== null
        ? getMessageId(message.replyTo)
        : message.replyTo;

    if (replyId == null) return null;

    return (
      messageMap.get(String(replyId)) ??
      (typeof message.replyTo === "object"
        ? message.replyTo
        : null)
    );
  }

  function jumpToMessage(messageId) {
    if (messageId == null) return;

    const id = String(messageId);
    const target = messageRefs.current.get(id);

    if (!target) {
      console.warn(
        "Original message is not currently loaded."
      );
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    setHighlightedMessageId(id);

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId((current) =>
        current === id ? null : current
      );
    }, 1800);
  }

  useEffect(() => {
    if (messageJump) jumpToMessage(messageJump.id);
  }, [messageJump]);

  useEffect(() => {
    function stopPhotoHoldClick(event) {
      if (event.detail > 0 && heldPhotoRef.current &&
        event.target.closest?.(".message-image-button") === heldPhotoRef.current) {
        heldPhotoRef.current = null;
        event.stopPropagation();
      }
    }

    window.addEventListener("click", stopPhotoHoldClick, true);
    return () => window.removeEventListener("click", stopPhotoHoldClick, true);
  }, []);

  function handleTouchStart(event, message) {
    const photo = event.target.closest(".message-image-button");
    if (!photo && event.target.closest("button, input, textarea, a, video, audio, [role='dialog']")) return;
    heldPhotoRef.current = null;
    const touch = event.touches?.[0];
    if (!touch) return;

    holdStartRef.current = { x: touch.clientX, y: touch.clientY };
    clearTimeout(holdTimerRef.current);
    if (!message.isDeleted && !isCallEvent(message)) holdTimerRef.current = setTimeout(() => {
      heldPhotoRef.current = photo;
      setOpenMenuId(String(getMessageId(message)));
      holdTimerRef.current = null;
    }, 500);
    swipeStartRef.current = {
      messageId: getMessageId(message),
      x: touch.clientX,
      y: touch.clientY,
    };
  }

  function handleTouchEnd(event, message) {
    clearTimeout(holdTimerRef.current);
    holdStartRef.current = null;
    if (heldPhotoRef.current && event.target.closest(".message-image-button") === heldPhotoRef.current) {
      swipeStartRef.current = null;
      return;
    }
    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (
      !start ||
      !sameId(
        start.messageId,
        getMessageId(message)
      )
    ) {
      return;
    }

    if (
      isMine(message) ||
      message.isDeleted ||
      isCallEvent(message)
    ) {
      return;
    }

    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (
      deltaX < -65 &&
      Math.abs(deltaX) >
        Math.abs(deltaY) * 1.3
    ) {
      onReply?.(message);
    }
  }

  function handleTouchCancel() {
    swipeStartRef.current = null;
    holdStartRef.current = null;
    clearTimeout(holdTimerRef.current);
  }

  const gallery = openPhoto?.chatId === chatId && openPhoto
    ? safeMessages.flatMap((message) => {
        if (message?.isDeleted || getAttachmentMediaType(message?.attachment) !== "image") return [];
        const src = getAttachmentUrl(message.attachment);
        return src ? [{
          message,
          src,
          alt: message.attachment.originalName || "Message image",
          senderName: message.senderName || "Image",
        }] : [];
      })
    : [];
  const photoIndex = gallery.findIndex(({ message }) =>
    message === openPhoto.message || sameId(getMessageId(message), getMessageId(openPhoto.message))
  );

  function openImage(_attachment, message) {
    setOpenPhoto({ chatId, message });
  }

  function movePhoto(offset) {
    const nextPhoto = gallery[photoIndex + offset];
    if (photoIndex >= 0 && nextPhoto) openImage(nextPhoto.message.attachment, nextPhoto.message);
  }

  async function handleDelete(message, type) {
    if (typeof deleteMessage !== "function") {
      console.error(
        "deleteMessage function was not provided."
      );
      return;
    }

    try {
      await deleteMessage(message, type);
      setOpenMenuId(null);
      setConfirmDeleteId(null);
    } catch (error) {
      console.error(
        "Failed to delete message:",
        error
      );
    }
  }

  async function handleJoinCall(targetCall = activeGroupCall) {
    const targetId = getCallId(targetCall);
    const targetGroupId = normalizeId(
      targetCall?.groupId
    );

    if (
      !hasActiveGroupCall ||
      !targetId ||
      targetId !== callId ||
      targetGroupId !== chatId ||
      joiningRef.current ||
      typeof onJoinGroupCall !== "function"
    ) {
      return;
    }

    joiningRef.current = true;
    setJoiningCall(true);
    setJoinError("");

    try {
      await onJoinGroupCall({
        callId: targetId,
        groupId: targetGroupId,
        callType: getCallType(targetCall),
      });
    } catch (error) {
      console.error(
        "Failed to join group call:",
        error
      );

      setJoinError(
        error?.message ||
        "Unable to join the call. Please try again."
      );
    } finally {
      joiningRef.current = false;
      setJoiningCall(false);
    }
  }

  return (
    <>
      <div className="message-list">
        {showLiveBanner && (
          <CallEvent
            call={activeGroupCall}
            live
            joining={joiningCall}
            onJoin={() =>
              handleJoinCall(activeGroupCall)
            }
            error={joinError}
          />
        )}

        {safeMessages.filter(Boolean).map((message, index, orderedMessages) => {

          const rawMessageId =
            getMessageId(message);

          const messageId =
            rawMessageId != null
              ? String(rawMessageId)
              : `message-${index}`;

          const timestamp = message.createdAt ? new Date(message.createdAt) : null;
          const previousTimestamp = orderedMessages[index - 1]?.createdAt;
          const separator = startsMessageBatch(
            timestamp,
            previousTimestamp ? new Date(previousTimestamp) : null
          ) && (
            <time className="message-batch-time" dateTime={timestamp.toISOString()}>
              {formatDateTime(timestamp)}
            </time>
          );

          if (["group_notice", "conversation_notice"].includes(message.type) && !message.isDeleted) {
            return (
              <Fragment key={messageId}>
                {separator}
                <div className="message-call-event-row">
                  <p className="group-change-notice">{message.text}</p>
                </div>
              </Fragment>
            );
          }

          // Render saved call history.
          if (isCallEvent(message)) {
            const event = getEventCall(message);
            const eventCallId = getCallId(event);
            const eventStatus =
              getEventStatus(message);

            const sameActiveCall =
              hasActiveGroupCall &&
              eventCallId != null &&
              eventCallId === callId;

            const ended =
              ENDED_STATUSES.has(eventStatus) ||
              Boolean(getCallEndedAt(event));

            const live =
              sameActiveCall &&
              !ended &&
              ACTIVE_STATUSES.has(eventStatus);

            const displayedEvent = {
              ...event,
              status: live
                ? "active"
                : ended
                  ? "ended"
                  : "ended",
            };

            return (
              <Fragment key={messageId}>
                {separator}
                <div
                  className="message-call-event-row"
                >
                  <CallEvent
                    call={displayedEvent}
                    live={live}
                    joining={
                      live && joiningCall
                    }
                    onJoin={
                      live
                        ? () =>
                            handleJoinCall(
                              activeGroupCall
                            )
                        : undefined
                    }
                    error={
                      live ? joinError : ""
                    }
                  />
                </div>
              </Fragment>
            );
          }

          const mine = isMine(message);
          const showSenderAvatar = !isGroup && !mine && !message.isDeleted;
          const senderName = message.senderName || activeChat?.username || activeChat?.name || "User";
          const senderPhoto = message.senderProfilePicture || activeChat?.profilePicture;
          const readers = mine ? (message.readBy || []).map((receipt) => {
            const member = isGroup
              ? activeChat?.members?.find((person) =>
                sameId(person.id ?? person._id ?? person.userId, receipt.userId))
              : activeChat;
            return {
              id: receipt.userId,
              name: member?.nickname || member?.username || member?.name || receipt.username || "Someone",
              photo: receipt.profilePicture || member?.profilePicture || member?.avatar || member?.profileImage || member?.photo,
            };
          }) : [];

          const menuOpen =
            openMenuId === messageId;

          const confirmingDelete =
            confirmDeleteId === messageId;

          const editing =
            rawMessageId != null &&
            editingMessageId != null &&
            sameId(
              editingMessageId,
              rawMessageId
            );

          const replyTarget =
            getReplyTarget(message);

          return (
            <Fragment key={messageId}>
              {separator}
              <div
                ref={(element) => {
                  if (rawMessageId == null) return;

                  if (element) {
                    messageRefs.current.set(
                      messageId,
                      element
                    );
                  } else {
                    messageRefs.current.delete(
                      messageId
                    );
                  }
                }}
                className={`message-row ${
                  mine
                    ? "message-mine"
                    : "message-theirs"
                } ${
                  highlightedMessageId === messageId
                    ? "message-highlighted"
                    : ""
                }`}
                onTouchStart={(event) =>
                  handleTouchStart(
                    event,
                    message
                  )
                }
                onTouchMove={(event) => { const t=event.touches?.[0];const start=holdStartRef.current;if(t&&start&&Math.hypot(t.clientX-start.x,t.clientY-start.y)>12)clearTimeout(holdTimerRef.current); }}
                onContextMenu={(event) => {event.preventDefault();setOpenMenuId(messageId);}}
                onTouchEnd={(event) =>
                  handleTouchEnd(
                    event,
                    message
                  )
                }
                onTouchCancel={
                  handleTouchCancel
                }
              >
                {showSenderAvatar && (
                  <span
                    className={`private-message-avatar ${colorFor(senderName)}`}
                    role="img"
                    aria-label={senderName}
                  >
                    {initials(senderName)}
                    {senderPhoto && (
                      <img
                        src={getAttachmentUrl({ url: senderPhoto })}
                        alt=""
                        onError={(event) => { event.currentTarget.hidden = true; }}
                      />
                    )}
                  </span>
                )}
                <MessageBubble
                  message={message}
                  mine={mine}
                  readers={readers}
                  onReact={onReact}
                  onMessageAction={onMessageAction}
                  user={user}
                  loggedInUserId={
                    loggedInUserId
                  }
                  isGroup={isGroup}
                  replyTarget={replyTarget}
                  editing={editing}
                  editDraft={editDraft}
                  savingEdit={savingEdit}
                  setEditDraft={setEditDraft}
                  saveEditedMessage={
                    saveEditedMessage
                  }
                  cancelEditing={
                    cancelEditing
                  }
                  startEditing={
                    startEditing
                  }
                  onReply={() =>
                    onReply?.(message)
                  }
                  removeImage={removeImage}
                  onOpenImage={openImage}
                  jumpToMessage={
                    jumpToMessage
                  }
                  menuOpen={menuOpen}
                  onToggleMenu={() =>
                    setOpenMenuId(
                      menuOpen
                        ? null
                        : messageId
                    )
                  }
                  confirmDelete={
                    confirmingDelete
                  }
                  deleteType={deleteType}
                  onDeleteForYou={() => {
                    setDeleteType(
                      "deleteForYou"
                    );
                    setConfirmDeleteId(
                      messageId
                    );
                    setOpenMenuId(null);
                  }}
                  onDeleteForEveryone={() => {
                    setDeleteType(
                      "deleteForEveryone"
                    );
                    setConfirmDeleteId(
                      messageId
                    );
                    setOpenMenuId(null);
                  }}
                  onConfirmDelete={(
                    targetMessage
                  ) =>
                    handleDelete(
                      targetMessage,
                      deleteType
                    )
                  }
                  onCancelDelete={() =>
                    setConfirmDeleteId(null)
                  }
                />
              </div>
            </Fragment>
          );
        })}

        {safeMessages.length === 0 &&
          !hasActiveGroupCall && (
            <div className="message-empty-state">
              <div className="message-empty-icon">
                <ImageIcon size={24} />
              </div>

              <strong>
                Start a conversation
              </strong>

              <p>
                Send a message to get
                things going.
              </p>
            </div>
          )}
      </div>

<MessageLightbox
  selectedImage={gallery[photoIndex]}
  onPrevious={photoIndex > 0 ? () => movePhoto(-1) : undefined}
  onNext={photoIndex >= 0 && photoIndex < gallery.length - 1 ? () => movePhoto(1) : undefined}
  onClose={() => setOpenPhoto(null)}
/>
    </>
  );
}
