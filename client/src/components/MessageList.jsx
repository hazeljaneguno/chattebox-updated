import { useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Reply,
  Pencil,
  X,
  Check as SaveIcon,
  Image as ImageIcon,
  FileText,
  ZoomIn,
  MoreHorizontal,
  Trash2,
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  LoaderCircle,
} from "lucide-react";

import MentionText from "./MentionText";
import { API_URL } from "../api";
import "./MessageList/MessageStyles.css";

function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function getMessageId(message) {
  return message?.id ?? message?._id;
}

function formatTime(date) {
  if (!date) return "";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getAttachmentUrl(attachment) {
  if (!attachment?.url) return "";

  if (
    attachment.url.startsWith("http://") ||
    attachment.url.startsWith("https://")
  ) {
    return attachment.url;
  }

  return `${API_URL}${attachment.url.startsWith("/") ? "" : "/"}${attachment.url}`;
}

function getReplyPreview(message) {
  if (!message) return "Message unavailable";

  if (message.isDeleted) {
    return "This message was deleted";
  }

  if (message.text?.trim()) return message.text;

  if (message.attachment?.mimeType?.startsWith("image/")) {
    return "📷 Photo";
  }

  if (message.attachment) return "📎 Attachment";

  return "Message";
}

const ACTIVE_CALL_STATUSES = new Set(["active", "ongoing", "in_progress"]);

function normalizedId(value) {
  if (value == null) return null;
  if (typeof value === "object") return normalizedId(value._id ?? value.id);
  return String(value);
}

function isCallMessage(message) {
  return ["group_call", "group_call_started", "group_call_ended", "call_event"].includes(
    message?.type ?? message?.messageType
  );
}

function CallHistoryCard({ call, active, joining, onJoin, error }) {
  const audio = call.callType === "audio";
  const Icon = audio ? (active ? Phone : PhoneOff) : (active ? Video : VideoOff);
  const startedAt = call.startedAt ?? call.createdAt;
  const endedAt = call.endedAt;
  const durationMs = startedAt && endedAt
    ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
    : null;
  const duration = durationMs != null && Number.isFinite(durationMs) && durationMs >= 0
    ? `${Math.floor(durationMs / 60000)} min`
    : null;

  return (
    <div className={`message-group-call ${active ? "is-active" : "is-ended"}`}>
      <div className="message-group-call-heading">
        <span className="message-group-call-icon"><Icon size={22} /></span>
        <div className="message-group-call-text">
          <strong>Group {audio ? "voice" : "video"} call {active ? "started" : "ended"}</strong>
          {startedAt && <p>Started: {new Date(startedAt).toLocaleString()}</p>}
          {!active && endedAt && <p>Ended: {new Date(endedAt).toLocaleString()}</p>}
          {!active && duration && <p>Duration: {duration}</p>}
          {active && <p>Call in progress</p>}
        </div>
      </div>
      {active && onJoin && (
        <button className="message-group-call-join" type="button" onClick={onJoin} disabled={joining}>
          {joining ? <LoaderCircle size={18} className="message-call-spinner" /> : <Icon size={18} />}
          {joining ? "Joining..." : `Join ${audio ? "Voice" : "Video"} Call`}
        </button>
      )}
      {error && <p className="message-group-call-error" role="alert">{error}</p>}
    </div>
  );
}

export default function MessageList({
  messages = [],
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
  mentionSuccessToast,
  setMentionSuccessToast,
  activeGroupCall = null,
  onJoinGroupCall,
}) {
  const swipeStartRef = useRef(null);
  const messageRefs = useRef(new Map());

  const [selectedImage, setSelectedImage] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
const [deleteType, setDeleteType] = useState("deleteForYou");
  const [joiningCall, setJoiningCall] = useState(false);
  const [joinCallError, setJoinCallError] = useState("");
  const joiningCallRef = useRef(false);

  const chatId = normalizedId(activeChat?._id ?? activeChat?.id);
  const liveCallId = normalizedId(activeGroupCall?.callId ?? activeGroupCall?._id);
  const hasLiveCall = Boolean(
    isGroup && chatId && liveCallId &&
    normalizedId(activeGroupCall?.groupId) === chatId &&
    ACTIVE_CALL_STATUSES.has(String(activeGroupCall?.status ?? "").toLowerCase())
  );
  const callEvents = messages.filter(isCallMessage);
  const liveCallHasMessage = callEvents.some(
    (message) => normalizedId(message.callId) === liveCallId
  );

  async function joinCall() {
    if (!hasLiveCall || joiningCallRef.current || !onJoinGroupCall) return;
    joiningCallRef.current = true;
    setJoiningCall(true);
    setJoinCallError("");
    try {
      await onJoinGroupCall({ callId: liveCallId, groupId: chatId });
    } catch (error) {
      setJoinCallError(error?.message || "Could not join this call.");
    } finally {
      joiningCallRef.current = false;
      setJoiningCall(false);
    }
  }

  const loggedInUserId =
    currentUserId ?? user?.id ?? user?._id ?? user?.userId;

  const messageMap = new Map(
    messages.map((message,index) => [
      getMessageId(message) != null ? String(getMessageId(message)) : `message-${index}`,
      message,
    ])
  );

  function getSenderId(message) {
    if (message.senderId != null) return message.senderId;

    if (typeof message.sender === "object" && message.sender !== null) {
      return message.sender._id ?? message.sender.id;
    }

    return message.sender;
  }

  function isMine(message) {
    return sameId(getSenderId(message), loggedInUserId);
  }

  function getSenderDisplayName(message) {
    const sender = message?.sender;

    const senderName =
      message?.senderName ||
      (typeof sender === "object" && sender !== null
        ? sender.username || sender.name
        : null);

    if (senderName) return senderName;

    if (isMine(message)) {
      return user?.username || user?.name || "You";
    }

    return "User";
  }

  function jumpToMessage(messageId) {
    if (!messageId) return;

    const target = messageRefs.current.get(String(messageId));

    if (!target) {
      console.warn("Original message is not currently loaded.");
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    setHighlightedMessageId(String(messageId));

    window.setTimeout(() => {
      setHighlightedMessageId((current) =>
        current === String(messageId) ? null : current
      );
    }, 1800);
  }

  function getReplyTarget(message) {
    const replyId =
      typeof message.replyTo === "object"
        ? getMessageId(message.replyTo)
        : message.replyTo;

    if (replyId == null) return null;

    return (
      messageMap.get(String(replyId)) ??
      (typeof message.replyTo === "object" ? message.replyTo : null)
    );
  }

  function handleTouchStart(event, message) {
    const touch = event.touches?.[0];
    if (!touch) return;

    swipeStartRef.current = {
      messageId: getMessageId(message),
      x: touch.clientX,
      y: touch.clientY,
    };
  }

  function handleTouchEnd(event, message) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (!start || !sameId(start.messageId, getMessageId(message))) return;
    if (isMine(message) || message.isDeleted) return;

    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (deltaX < -65 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      onReply?.(message);
    }
  }

  function handleTouchCancel() {
    swipeStartRef.current = null;
  }

  function openImage(attachment, message) {
    setSelectedImage({
      src: getAttachmentUrl(attachment),
      alt: attachment.originalName || "Message image",
      senderName: message.senderName || "Image",
    });
  }

  function handleLightboxKeyDown(event) {
    if (event.key === "Escape") setSelectedImage(null);
  }

  function handleDelete(message, deleteType) {
    if (!deleteMessage) {
      console.error("deleteMessage function was not provided.");
      return;
    }

    deleteMessage(message, deleteType);

    setOpenMenuId(null);
    setConfirmDeleteId(null);
  }

  return (
    <>
      <div className="message-list">
        {hasLiveCall && !liveCallHasMessage && (
          <div className="message-call-event-row">
            <CallHistoryCard
              call={activeGroupCall}
              active
              joining={joiningCall}
              onJoin={joinCall}
              error={joinCallError}
            />
          </div>
        )}
        {messages.map((message, index) => {
          if (isCallMessage(message)) {
            const eventCallId = normalizedId(message.callId);
            const eventEnded = Boolean(message.endedAt) ||
              ["ended", "completed", "cancelled", "canceled", "failed"].includes(
                String(message.status ?? "").toLowerCase()
              ) || message.type === "group_call_ended";
            const active = !eventEnded && hasLiveCall && eventCallId === liveCallId;
            return (
              <div key={getMessageId(message) ?? `call-${eventCallId}-${index}`} className="message-call-event-row">
                <CallHistoryCard
                  call={{ ...message, ...(active ? activeGroupCall : {}), status: active ? "active" : "ended" }}
                  active={active}
                  joining={active && joiningCall}
                  onJoin={active ? joinCall : undefined}
                  error={active ? joinCallError : ""}
                />
              </div>
            );
          }
          const mine = isMine(message);
          const senderName = getSenderDisplayName(message);
          const senderInitial = senderName.trim().charAt(0).toUpperCase() || "?";
          const photoPath = message.senderProfilePicture || message.sender?.profilePicture || "";

          const senderPhotoUrl = photoPath.startsWith("/")
          ? `${API_URL.replace(/\/+$/, "")}${photoPath}`
          : /^https?:\/\//i.test(photoPath)
          ? photoPath : "" ;
          const deleted = message.isDeleted === true;
         const rawMessageId = getMessageId(message);
const messageId = rawMessageId != null
  ? String(rawMessageId)
  : "";

          const menuOpen = openMenuId === messageId;
          const confirmingDelete = confirmDeleteId === messageId;

          const editing = sameId(
            editingMessageId,
            getMessageId(message)
          );

          const attachment = message.attachment;
          const attachmentUrl = getAttachmentUrl(attachment);
          const isImage = attachment?.mimeType?.startsWith("image/");
          const replyTarget = getReplyTarget(message);

          const messageTime = formatTime(
            message.updatedAt || message.createdAt
          );

          return (
            <div
              key={messageId || `message-${index}`}
              ref={(element) => {
                if (element) {
                  messageRefs.current.set(messageId, element);
                } else {
                  messageRefs.current.delete(messageId);
                }
              }}
              className={`message-row ${
                mine ? "message-mine" : "message-theirs"
              } ${
                sameId(highlightedMessageId, getMessageId(message))
                  ? "message-highlighted"
                  : ""
              }`}
              onTouchStart={(event) => handleTouchStart(event, message)}
              onTouchEnd={(event) => handleTouchEnd(event, message)}
              onTouchCancel={handleTouchCancel}
            >
              <div className="message-content">
                {(!mine || isGroup) && (
                  <div className="message-heading">
                    <span className="sender-name">
                      {getSenderDisplayName(message)}
                    </span>

                    {!mine && (
                      <span className="message-time">{messageTime}</span>
                    )}
                  </div>
                )}

                <div className="message-bubble-wrap">
                  <div
                    className={`message-bubble ${
                      mine ? "bubble-mine" : "bubble-theirs"
                    } ${editing ? "bubble-editing" : ""} ${
                      deleted ? "bubble-deleted" : ""
                    }`}
                  >
                    {deleted ? (
  <div className="deleted-message">
    {sameId(message.deletedBy, loggedInUserId)
      ? "You deleted this message"
      : "This message was deleted"}
  </div>
) : (
  <>
    {replyTarget && (
      <button
        type="button"
        className="reply-quote"
        onClick={() =>
          jumpToMessage(getMessageId(replyTarget))
        }
        title="Go to original message"
      >
        <div className="reply-quote-heading">
          <Reply size={14} />
          <span>{getSenderDisplayName(replyTarget)}</span>
        </div>

        <p className="reply-quote-text">
          {getReplyPreview(replyTarget)}
        </p>
      </button>
    )}

    {editing ? (
      <>
        {/* Keep the existing image visible while editing */}
        {attachment && isImage && (
          <div className="message-attachment">
            <img
              src={attachmentUrl}
              alt={attachment.originalName || "Attachment"}
              className="message-image"
            />
          </div>
        )}

        {/* Edit only the message text */}
        <div className="message-edit-form">
          <textarea
            className="message-edit-input"
            value={editDraft}
            onChange={(event) =>
              setEditDraft(event.target.value.slice(0, 4000))
            }
            maxLength={4000}
            rows={Math.min(
              6,
              Math.max(2, (editDraft || "").split("\n").length)
            )}
            autoFocus
            aria-label="Edit message"
          />

          <div className="message-edit-footer">
            <span className="edit-character-count">
              {(editDraft || "").length}/4000
            </span>

            <div className="message-edit-actions">
              <button
                type="button"
                className="message-action-button cancel-edit-button"
                onClick={cancelEditing}
                disabled={savingEdit}
              >
                <X size={15} />
                Cancel
              </button>

             <button
  type="button"
  className="message-action-button save-edit-button"
  onClick={() => saveEditedMessage(message)}
  disabled={savingEdit || !editDraft.trim()}
>
  <SaveIcon size={15} />
  {savingEdit ? "Saving..." : "Save"}
</button>
            </div>
          </div>
        </div>
      </>
    ) : (
      <>
        {/* Normal attachment display */}
        {attachment && (
          <div className="message-attachment">
            {isImage ? (
              <button
                type="button"
                className="message-image-button"
                onClick={() => openImage(attachment, message)}
                aria-label="View image larger"
              >
                <img
                  src={attachmentUrl}
                  alt={attachment.originalName || "Attachment"}
                  className="message-image"
                  loading="lazy"
                />

                <span className="image-zoom-hint">
                  <ZoomIn size={16} />
                  View image
                </span>
              </button>
            ) : (
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="message-file-link"
              >
                <span className="message-file-icon">
                  <FileText size={20} />
                </span>

                <span className="message-file-details">
                  <strong>
                    {attachment.originalName || "Download file"}
                  </strong>
                  <small>Open attachment</small>
                </span>
              </a>
            )}

            {mine && isImage && removeImage && (
              <button
                type="button"
                className="remove-message-image"
                onClick={() => removeImage((message.id ?? message._id))}
                aria-label="Remove image attachment"
                title="Remove image"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        {/* Normal message text */}
        {message.text?.trim() && (
          <div className="message-text">
            <MentionText text={message.text} />
          </div>
        )}
      </>
    )}
  </>
)}
                  </div>

                  {!editing && !deleted && (
                    <div className="message-actions">
                      {!mine && (
                        <button
                          type="button"
                          className="message-action-icon reply-message-button"
                          onClick={() => onReply?.(message)}
                          title="Reply to message"
                          aria-label="Reply to message"
                        >
                          <Reply size={16} />
                        </button>
                      )}

                      {mine && (
                        <button
                          type="button"
                          className="message-action-icon edit-message-button"
                          onClick={() => startEditing(message)}
                          title="Edit message"
                          aria-label="Edit message"
                        >
                          <Pencil size={15} />
                        </button>
                      )}

                      <div className="message-options">
                        <button
                          type="button"
                          className="message-action-icon options-message-button"
                          onClick={() =>
                            setOpenMenuId(
                              menuOpen ? null : messageId
                            )
                          }
                          title="Message options"
                          aria-label="Message options"
                          aria-expanded={menuOpen}
                        >
                          <MoreHorizontal size={17} />
                        </button>

                        {menuOpen && (
                          <div className="message-options-menu">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteId(messageId);
                                setOpenMenuId(null);
                              }}
                            >
                              <Trash2 size={15} />
                              Delete for you
                            </button>

                           {mine && (
  <button
    type="button"
    className="delete-everyone-option"
    onClick={() => {
      setDeleteType("deleteForEveryone");
      setConfirmDeleteId(messageId);
      setOpenMenuId(null);
    }}
  >
    <Trash2 size={15} />
    Delete for everyone
  </button>
)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {confirmingDelete && !deleted && (
  <div className="delete-message-confirm">
  <p>
    {deleteType === "deleteForEveryone"
      ? "Delete this message for everyone?"
      : "Delete this message from your view?"}
  </p>

  <button
    type="button"
    onClick={() => handleDelete(message, deleteType)}
  >
    Confirm delete
  </button>

  <button
    type="button"
    className="cancel-delete-button"
    onClick={() => setConfirmDeleteId(null)}
  >
    Cancel
  </button>
</div>
                )}

                {mine && !deleted && (
                  <div className="message-meta">
                    {message.updatedAt &&
                      message.createdAt &&
                      new Date(message.updatedAt).getTime() >
                        new Date(message.createdAt).getTime() && (
                        <span className="edited-label">Edited</span>
                      )}

                    <span className="message-time">{messageTime}</span>

                    <span
                      className={`read-check ${
                        message.read ? "message-read" : ""
                      }`}
                      title={message.read ? "Read" : "Sent"}
                      aria-label={message.read ? "Read" : "Sent"}
                    >
                      {message.read ? (
                        <CheckCheck size={15} />
                      ) : (
                        <Check size={15} />
                      )}
                    </span>
                  </div>
                )}
              </div>
              {!mine && (
  <span className="message-sender-avatar" aria-hidden="true">
    {senderInitial}
    {senderPhotoUrl && (
      <img
        key={senderPhotoUrl}
        src={senderPhotoUrl}
        alt=""
        loading="lazy"
        onError={(event) => {
          event.currentTarget.hidden = true;
        }}
      />
    )}
  </span>
)}
            </div>
          );
        })}

        {messages.length === 0 && !hasLiveCall && (
          <div className="message-empty-state">
            <div className="message-empty-icon">
              <ImageIcon size={24} />
            </div>
            <strong>Start a conversation</strong>
            <p>Send a message to get things going.</p>
          </div>
        )}
      </div>

      {selectedImage && (
        <div
          className="message-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setSelectedImage(null)}
          onKeyDown={handleLightboxKeyDown}
          tabIndex={-1}
        >
          <button
            type="button"
            className="message-lightbox-close"
            onClick={() => setSelectedImage(null)}
            aria-label="Close image preview"
          >
            <X size={23} />
          </button>

          <div
            className="message-lightbox-content"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
            />
            <span>{selectedImage.senderName}</span>
          </div>
        </div>
      )}
    </>
  );
}
