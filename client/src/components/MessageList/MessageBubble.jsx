import { useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Reply,
  X,
  Check as SaveIcon,
  FileText,
  Pin,
  ZoomIn,
} from "lucide-react";

import MentionText from "../MentionText";

import MessageActions from "./MessageActions";
import "./MessageBubble.css";
import MessageDeleteConfirm from "./MessageDeleteConfirm";

import {
  sameId,
  getMessageId,
  getAttachmentUrl,
  getAttachmentMediaType,
  getReplyPreview,
} from "../../utils/messageHelpers";


const emojiToken = /\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?(?:[\u{E0020}-\u{E007E}]+\u{E007F})?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3/gu;

function isEmojiOnly(text) {
  const trimmed = text?.trim();
  return Boolean(trimmed) && !trimmed.replace(emojiToken, "").trim();
}

// Supports common reaction shapes; adapt this if messageExtras uses a different schema.
function getReactionBadges(reactions) {
  if (!reactions) return [];
  const counts = new Map();
  const add = (emoji, count = 1) => {
    if (typeof emoji !== "string" || !emoji.trim()) return;
    const amount = Number(count);
    if (!Number.isFinite(amount) || amount <= 0) return;
    counts.set(emoji, (counts.get(emoji) || 0) + amount);
  };
  if (Array.isArray(reactions)) {
    reactions.forEach((reaction) => {
      if (typeof reaction === "string") add(reaction);
      else if (reaction && typeof reaction === "object") {
        add(reaction.emoji ?? reaction.reaction ?? reaction.type,
          reaction.count ?? reaction.total ?? 1);
      }
    });
  } else if (typeof reactions === "object") {
    Object.entries(reactions).forEach(([emoji, value]) => {
      if (typeof value === "number") add(emoji, value);
      else if (Array.isArray(value)) add(emoji, value.length);
      else if (value && typeof value === "object") {
        if (value.emoji) add(value.emoji, value.count ?? 1);
        else if (typeof value.count === "number") add(emoji, value.count);
      } else if (value === true) add(emoji);
    });
  }
  return [...counts].map(([emoji, count]) => ({ emoji, count }));
}

function getMessageAuthorName(message, user, mine) {
  if (mine) return "You";
  return message?.senderName ||
    (typeof message?.sender === "object"
      ? message.sender?.username || message.sender?.name
      : null) || "User";
}

export default function MessageBubble({
  message,
  mine,
  user,
  isGroup = false,
  loggedInUserId,
  messageTime,
  replyTarget,
  editing,
  editDraft,
  savingEdit,
  setEditDraft,
  saveEditedMessage,
  cancelEditing,
  startEditing,
  onReply,
  removeImage,
  onOpenImage,
  jumpToMessage,
  menuOpen,
  onToggleMenu,
  confirmDelete,
  deleteType,
  onDeleteForYou,
  onDeleteForEveryone,
  onConfirmDelete,
  onCancelDelete,
  onMessageAction,
  onReact,
}) {
  const deleted = message.isDeleted === true;
  const attachment = message.attachment;
  const emojiOnly = !deleted && !editing && !attachment && isEmojiOnly(message.text);
  const attachmentUrl = getAttachmentUrl(attachment);
  const media = getAttachmentMediaType(attachment);
  const isImage = media === "image";
  const [failedMediaUrl, setFailedMediaUrl] = useState("");
  const reactionDialogRef = useRef(null);
  const [selectedReaction, setSelectedReaction] = useState(null);

  const savedReactions = Array.isArray(message.reactions)
    ? message.reactions.filter((reaction) => reaction?.userId && reaction.emoji)
    : [];
  const viewerId = String(loggedInUserId ?? user?.id ?? user?._id ?? "local-user");
  const localReaction = message.myReaction &&
    !savedReactions.some(({ userId }) => String(userId) === viewerId)
    ? { userId: viewerId, username: "You", emoji: message.myReaction }
    : null;
  const reactionsForPopup = localReaction
    ? [...savedReactions, localReaction]
    : savedReactions;
  const reactionBadges = getReactionBadges(message.reactions);

  if (localReaction) {
    const badge = reactionBadges.find(({ emoji }) => emoji === localReaction.emoji);
    if (badge) {
      badge.count += 1;
    } else {
      reactionBadges.push({ emoji: localReaction.emoji, count: 1 });
    }
  }

  const visibleReactions = reactionsForPopup.filter(
    ({ emoji }) => selectedReaction === null || emoji === selectedReaction
  );
  const reactionFilters = [
    {
      emoji: null,
      label: "All",
      count: reactionBadges.reduce((total, badge) => total + badge.count, 0),
    },
    ...reactionBadges.map((badge) => ({ ...badge, label: badge.emoji })),
  ];

  // Compare the author of this message with the author of the quoted message.
  const senderIdOf = (item) => {
    const sender = item?.sender;
    return item?.senderId ?? item?.userId ??
      (typeof sender === "object" && sender !== null
        ? sender._id ?? sender.id
        : sender) ?? null;
  };

  const originalSenderId = senderIdOf(replyTarget);
  const currentSenderId = senderIdOf(message);
  const selfReply = originalSenderId != null && currentSenderId != null &&
    sameId(originalSenderId, currentSenderId);
  const originalIsMe = originalSenderId != null && loggedInUserId != null &&
    sameId(originalSenderId, loggedInUserId);
  const originalName = replyTarget?.senderName ||
    (typeof replyTarget?.sender === "object"
      ? replyTarget.sender?.username || replyTarget.sender?.name
      : null) || "User";
  const currentName = getMessageAuthorName(message, user, mine);
  const replyHeading = selfReply
    ? (mine ? "You replied to yourself" : `${currentName} replied to themselves`)
    : mine
      ? `You replied to ${originalIsMe ? "yourself" : originalName}`
      : `${currentName} replied to ${originalIsMe ? "you" : originalName}`;

  function getSenderDisplayName() {
    const sender = message?.sender;

    const senderName =
      message?.senderName ||
      (typeof sender === "object" && sender !== null
        ? sender.username || sender.name
        : null);

    if (senderName) return senderName;

    if (mine) {
      return user?.username || user?.name || "You";
    }

    return "User";
  }

  return (
    <div className="message-content">
      {isGroup && !mine && (
  <div className="message-heading">
    <span className="sender-name">
      {getSenderDisplayName()}
    </span>

    <span className="message-time">
      {messageTime}
    </span>
  </div>
)}

 
<div className={`message-bubble-wrap ${mine ? "message-wrap-mine" : "message-wrap-theirs"}`}>
  {/* =====================================
      REPLY PREVIEW - OUTSIDE THE BUBBLE
  ===================================== */}

  {!deleted && replyTarget && (
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
  <span>{replyHeading}</span>
</div>


      <p className="reply-quote-text">
        {getReplyPreview(replyTarget)}
      </p>
    </button>
  )}

  <div className="message-bubble-surface">
  {/* =====================================
      ACTUAL MESSAGE BUBBLE
  ===================================== */}

  <div
    className={`message-bubble ${
      emojiOnly ? "bubble-emoji-only" : mine ? "bubble-mine" : "bubble-theirs"
    } ${editing ? "bubble-editing" : ""} ${
      deleted ? "bubble-deleted" : ""
    } ${!deleted && message.isPinned ? "bubble-pinned" : ""}`}
  >
    {!deleted && message.isPinned && (
      <span className="message-pin-indicator" role="img" aria-label="Pinned message" title="Pinned message">
        <Pin size={13} fill="currentColor" />
      </span>
    )}
    {deleted ? (
      <div className="deleted-message">
        {sameId(message.deletedBy, loggedInUserId)
          ? "You deleted this message"
          : "This message was deleted"}
      </div>
    ) : editing ? (
      <>
        {/* Existing image attachment while editing */}
        {attachment && isImage && (
          <div className="message-attachment">
            <img
              src={attachmentUrl}
              alt={
                attachment.originalName || "Attachment"
              }
              className="message-image"
            />
          </div>
        )}

        {/* Message editing form */}
        <div className="message-edit-form">
          <textarea
            className="message-edit-input"
            value={editDraft}
            onChange={(event) =>
              setEditDraft(
                event.target.value.slice(0, 4000)
              )
            }
            maxLength={4000}
            rows={Math.min(
              6,
              Math.max(
                2,
                (editDraft || "").split("\n").length
              )
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
                onClick={() =>
                  saveEditedMessage(message)
                }
                disabled={
                  savingEdit ||
                  (!editDraft.trim() && !attachment)
                }
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
        {/* =====================================
            MESSAGE ATTACHMENTS
        ===================================== */}

        {attachment && (
          <div className="message-attachment">
            {!attachmentUrl || (media && failedMediaUrl === attachmentUrl) ? (
              <p className="message-media-unavailable">
                {media === "image" ? "Photo unavailable" : media === "video" ? "Video unavailable" : media === "audio" ? "Voice message unavailable" : "Attachment unavailable"}
              </p>
            ) : isImage ? (
              <button
                type="button"
                className="message-image-button"
                onClick={() =>
                  onOpenImage(attachment, message)
                }
                aria-label="View image larger"
              >
                <img
                  src={attachmentUrl}
                  alt={
                    attachment.originalName ||
                    "Attachment"
                  }
                  className="message-image"
                  loading="lazy"
                  onError={() => setFailedMediaUrl(attachmentUrl)}
                />

                <span className="image-zoom-hint">
                  <ZoomIn size={16} />
                  View image
                </span>
              </button>
            ) : media === "video" ? (
              <video
                className="message-video"
                src={attachmentUrl}
                controls
                playsInline
                preload="metadata"
                aria-label={attachment.originalName || "Video attachment"}
                onError={() => setFailedMediaUrl(attachmentUrl)}
              />
            ) : media === "audio" ? (
              <audio className="message-audio" src={attachmentUrl} controls preload="metadata"
                aria-label="Voice message" onError={() => setFailedMediaUrl(attachmentUrl)} />
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
                    {attachment.originalName ||
                      "Download file"}
                  </strong>

                  <small>Open attachment</small>
                </span>
              </a>
            )}

            {/* Remove image */}
            {mine && isImage && removeImage && (
              <button
                type="button"
                className="remove-message-image"
                onClick={() =>
                  removeImage(getMessageId(message))
                }
                aria-label="Remove image attachment"
                title="Remove image"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        {/* =====================================
            MESSAGE TEXT
        ===================================== */}

        {message.text?.trim() && (
          <div className="message-text">
            <MentionText text={message.text} />
          </div>
        )}
      </>
    )}
  </div>

{!deleted && reactionBadges.length > 0 && (
  <div className="message-reaction-badges">
    {reactionBadges.map(({ emoji, count }) => (
      <button
        key={emoji}
        type="button"
        className="message-reaction-badge"
        style={{ pointerEvents: "auto" }}
        onClick={(event) => {
          event.stopPropagation();
          setSelectedReaction(emoji);
          reactionDialogRef.current?.showModal();
        }}
        aria-haspopup="dialog"
        aria-label={`View ${emoji} reactions (${count})`}
      >
        {emoji} {count}
      </button>
    ))}
  </div>
)}

        {!deleted && reactionBadges.length > 0 && (
          <dialog
            ref={reactionDialogRef}
            className="reaction-sheet"
            aria-label="Message reactions"
            onClick={(event) => {
              event.stopPropagation();
              if (event.target === event.currentTarget) {
                event.currentTarget.close();
              }
            }}
            style={{
              position: "fixed",
              inset: 0,
              width: "100%",
              height: "100%",
              maxWidth: "none",
              maxHeight: "none",
              margin: 0,
              padding: 0,
              border: 0,
              background: "rgb(16 20 32 / 40%)",
              pointerEvents: "auto",
              boxSizing: "border-box",
            }}
          >
            <section style={{
              position: "absolute",
              inset: "auto 0 0",
              width: "min(100%, 440px)",
              marginInline: "auto",
              boxSizing: "border-box",
              padding: "16px 18px calc(16px + env(safe-area-inset-bottom))",
              borderRadius: "24px 24px 0 0",
              background: "#fff",
              color: "#20232b",
            }}>
              <header style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <h3 style={{ margin: 0 }}>Reactions</h3>
                <button
                  type="button"
                  aria-label="Close reactions"
                  onClick={() => reactionDialogRef.current?.close()}
                  style={{
                    minWidth: 44, minHeight: 44, border: 0, borderRadius: 12,
                    background: "#f2f3f7", color: "inherit", fontSize: 22,
                  }}
                >
                  ×
                </button>
              </header>

              <div role="group" aria-label="Filter reactions" style={{
                display: "flex", gap: 8, overflowX: "auto", marginBlock: 12,
              }}>
                {reactionFilters.map(({ emoji, label, count }) => (
                  <button
                    key={emoji ?? "all"}
                    type="button"
                    aria-pressed={selectedReaction === emoji}
                    onClick={() => setSelectedReaction(emoji)}
                    style={{
                      flexShrink: 0,
                      minHeight: 44,
                      paddingInline: 12,
                      border: 0,
                      borderRadius: 12,
                      background: selectedReaction === emoji ? "#e9e2ff" : "#f2f3f7",
                      color: selectedReaction === emoji ? "#513494" : "inherit",
                    }}
                  >
                    {label} {count}
                  </button>
                ))}
              </div>

              <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: "40vh", overflowY: "auto" }}>
                {visibleReactions.map(({ userId, username, emoji }) => (
                  <li key={`${userId}-${emoji}`} style={{
                    display: "flex", alignItems: "center", gap: 12, minHeight: 48,
                  }}>
                    <span aria-hidden="true" style={{
                      display: "grid", placeItems: "center", width: 36, height: 36,
                      flexShrink: 0, borderRadius: "50%", background: "#f0ecfa",
                    }}>
                      {(username || "User").charAt(0).toUpperCase()}
                    </span>
                    <span>{username || "User"}</span>
                    <span style={{ marginInlineStart: "auto" }}>{emoji}</span>
                  </li>
                ))}
                {visibleReactions.length === 0 && <li>No names available for this reaction.</li>}
              </ul>
            </section>
          </dialog>
        )}

        {!editing && !deleted && (
  <MessageActions
    mine={mine}
    isImage={isImage}
    text={message.text || ""}
    pinned={Boolean(message.isPinned)}
    onAction={(action) =>
      onMessageAction?.(message, action)
    }
    onReact={(emoji) =>
      onReact?.(message, emoji)
    }
    menuOpen={menuOpen}
    showQuickReply={!emojiOnly}
    onReply={onReply}
    onEdit={() => startEditing?.(message)}
    onToggleMenu={onToggleMenu}
    onDeleteForYou={onDeleteForYou}
    onDeleteForEveryone={onDeleteForEveryone}
  />
)}
      </div>
      </div>

      {confirmDelete && !deleted && (
        <MessageDeleteConfirm
          mine={mine}
          deleteType={deleteType}
          onConfirm={() => onConfirmDelete(message)}
          onCancel={onCancelDelete}
        />
      )}

      {mine && !deleted && (
        <div className="message-meta">
          {message.updatedAt &&
            message.createdAt &&
            new Date(message.updatedAt).getTime() >
              new Date(message.createdAt).getTime() && (
              <span className="edited-label">Edited</span>
            )}

          <span className="message-time">
            {messageTime}
          </span>

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
  );
}
