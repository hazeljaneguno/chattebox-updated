import { useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  Reply,
  X,
  Check as SaveIcon,
  FileText,
  Pin,
} from "lucide-react";

import { initials } from "../Avatar.jsx";
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
  readers = [],
  reactionMembers = [],
  user,
  isGroup = false,
  loggedInUserId,
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
  photoStack,
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
  const photoVisible = !deleted && !editing && isImage && attachmentUrl && failedMediaUrl !== attachmentUrl;
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
      photoVisible ? "bubble-photo" : emojiOnly ? "bubble-emoji-only" : mine ? "bubble-mine" : "bubble-theirs"
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
                className={`message-image-button ${photoStack ? "message-photo-stack" : ""}`}
                onClick={() =>
                  onOpenImage(message, photoStack)
                }
                aria-label={photoStack ? `Open photo stack of ${photoStack.length} photos` : "View image larger"}
              >
                {photoStack?.slice(-3, -1).map((photo, index) => (
                  <img
                    key={index}
                    className="message-photo-stack-layer"
                    src={getAttachmentUrl(photo.attachment)}
                    alt=""
                    loading="lazy"
                  />
                ))}
                <img
                  draggable={false}
                  src={attachmentUrl}
                  alt={
                    attachment.originalName ||
                    "Attachment"
                  }
                  className="message-image"
                  loading="lazy"
                  onError={() => setFailedMediaUrl(attachmentUrl)}
                />
                {photoStack && <span className="message-photo-stack-count">{photoStack.length}</span>}
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
          setSelectedReaction(null);
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
          >
            <section className="reaction-sheet-panel">
              <header className="reaction-sheet-header">
                <h3>Reactions</h3>
                <button type="button" aria-label="Close reactions"
                  onClick={() => reactionDialogRef.current?.close()}>
                  <X size={18} aria-hidden="true" />
                </button>
              </header>

              <ul className="reaction-sheet-people">
                {visibleReactions.map(({ userId, username, emoji, profilePicture }) => {
                  const member = [user, ...reactionMembers].find((person) =>
                    sameId(person?.userId ?? person?.id ?? person?._id, userId)
                  );
                  const name = username || member?.username || member?.name || "User";
                  const photo = profilePicture || member?.profilePicture;
                  return (
                    <li key={`${userId}-${emoji}`}>
                      <span className="reaction-sheet-avatar" aria-hidden="true">
                        {initials(name)}
                        {photo && <img src={getAttachmentUrl({ url: photo })} alt=""
                          onError={(event) => { event.currentTarget.hidden = true; }} />}
                      </span>
                      <span className="reaction-sheet-name">{name}</span>
                      <span className="reaction-sheet-emoji">{emoji}</span>
                    </li>
                  );
                })}
                {visibleReactions.length === 0 && <li>No names available for this reaction.</li>}
              </ul>

              <div className="reaction-sheet-filters" role="group" aria-label="Filter reactions">
                {reactionFilters.map(({ emoji, label, count }) => (
                  <button key={emoji ?? "all"} type="button"
                    aria-pressed={selectedReaction === emoji}
                    onClick={() => setSelectedReaction(emoji)}>
                    {emoji ? `${label} ${count}` : "All"}
                  </button>
                ))}
              </div>
            </section>
          </dialog>
        )}

        {!editing && !deleted && (
  <MessageActions
    mine={mine}
    isImage={isImage}
    canRemoveImage={Boolean(mine && isImage && removeImage)}
    text={message.text || ""}
    pinned={Boolean(message.isPinned)}
    onAction={(action) => {
      if (action === "remove-image") return removeImage?.(getMessageId(message));
      return onMessageAction?.(message, action);
    }}
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

          <span className="read-check" aria-hidden="true">
            {message.read || message.readBy?.length || message.deliveredTo?.length
              ? <CheckCheck size={15} />
              : <Check size={15} />}
          </span>
          <span className="message-receipt-label message-receipt-readers">
            {message.read || message.readBy?.length
              ? (readers.length ? `Seen by ${readers.map(({ name }) => name).join(", ")}` : "Seen")
              : message.deliveredTo?.length
                ? "Delivered"
                : "Sent"}
          </span>
          {readers.length > 0 && (
            <span className="message-seen-avatars" aria-hidden="true">
              {readers.slice(0, 4).map(({ id, name, photo }) => (
                <span className="message-seen-initial" key={id} title={name}>
                  {initials(name)}
                  {photo && (
                    <img
                      src={getAttachmentUrl({ url: photo })}
                      alt=""
                      onError={(event) => { event.currentTarget.hidden = true; }}
                    />
                  )}
                </span>
              ))}
              {readers.length > 4 && <small>+{readers.length - 4}</small>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
