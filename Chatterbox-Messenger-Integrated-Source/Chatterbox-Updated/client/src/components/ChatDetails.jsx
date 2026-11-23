import { useMessageExtras } from "./messageExtras.js";

import { useEffect, useRef, useState } from "react";

import {
  ArrowLeft,
  UserRound,
  Search,
  Bell,
  BellOff,
  Palette,
  Pencil,
  Images,
  FileText,
  Link2,
  Pin,
  UserPlus,
  Volume2,
  VolumeX,
  MessageCircle,
  Download,
  Share2,
  Timer,
  CheckCheck,
  Keyboard,
  ShieldCheck,
  Ban,
  Flag,
  UserRoundX,
  ChevronRight,
  Save,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

import "./ChatDetails.css";

const sections = [
  {
    title: "Customization",
    items: [
      ["nicknames", Pencil, "Nicknames"],
      ["theme", Palette, "Chat theme"],
    ],
  },
  {
    title: "Chat info",
    items: [
      ["media", Images, "Photos and videos"],
      ["files", FileText, "Shared files"],
      ["links", Link2, "Shared links"],
      ["pinned", Pin, "Pinned messages"],
    ],
  },
  {
    title: "Actions",
    items: [
      ["createGroup", UserPlus, "Create group with contact"],
      ["shareContact", Share2, "Share contact"],
      ["chatHead", MessageCircle, "Open chat head"],
    ],
  },
  {
    title: "Privacy & support",
    items: [
      ["disappearing", Timer, "Disappearing messages"],
      ["readReceipts", CheckCheck, "Read receipts"],
      ["typingIndicator", Keyboard, "Typing indicator"],
      ["messagePermissions", ShieldCheck, "Message permissions"],
      ["encryption", ShieldCheck, "Encryption information"],
      ["restrict", UserRoundX, "Restrict"],
      ["block", Ban, "Block"],
      ["report", Flag, "Report"],
    ],
  },
];

const titleMap = {
  media: "Photos and videos",
  files: "Shared files",
  links: "Shared links",
  pinned: "Pinned messages",
  nicknames: "Nicknames",
  search: "Search conversation",
  notifications: "Notifications & sounds",
  customize: "Customize chat",
};

const internalPages = new Set([
  "media",
  "files",
  "links",
  "pinned",
  "nicknames",
  "search",
  "notifications",
  "customize",
]);

export default function ChatDetails({
  chat,
  online = false,
  showActiveStatus = true,
  muted = false,
  soundsEnabled = true,
  autoSavePhotos = false,
  onClose,
  onAction,
  onOpenBackgroundPicker,
  messages = [],
}) {
  const [page, setPage] = useState("home");
  const [nickname, setNickname] = useState("");
  const [query, setQuery] = useState("");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const moreMenuRef = useRef(null);

  const isGroup = Boolean(chat?.isGroup);
  const [extras,updateExtra] = useMessageExtras(chat?.id??chat?._id);
  const allMessages = (Array.isArray(messages) ? messages : []).map((m) => ({
    ...m,
    ...(extras[String(m.id ?? m._id)] || {}),
  }));

  const safeUrl = (value) => {
    if (typeof value !== "string") return null;
    try {
      const parsed = new URL(value, window.location.origin);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
    } catch {
      return null;
    }
  };

  const attachmentsFor = (message) => {
    const attachment = message.attachment;
    if (Array.isArray(attachment)) return attachment;
    if (attachment && typeof attachment === "object") return [attachment];
    return Array.isArray(message.attachments) ? message.attachments : [];
  };

  const shared = allMessages.flatMap((message) => {
    if (message.isDeleted || message.deleted || message.deletedForEveryone) return [];
    if (page === "pinned") return message.isPinned ? [{ message }] : [];
    if (page === "links") {
      return [...String(message.text || message.content || "").matchAll(/https?:\/\/[^\s<>"']+/gi)]
        .map(([url]) => ({ message, url: safeUrl(url.replace(/[.,!?;:]+$/, "")) }))
        .filter((item) => item.url);
    }
    return attachmentsFor(message).flatMap((attachment) => {
      const url = safeUrl(attachment.url || attachment.secure_url || attachment.path);
      if (!url) return [];
      const mime = String(attachment.mimeType || attachment.mimetype || attachment.type || "").toLowerCase();
      const filename = attachment.originalName || attachment.filename || attachment.name || "Shared file";
      const isImage = mime.startsWith("image/") || (!mime && /\.(png|jpe?g|gif|webp|avif)(?:[?#]|$)/i.test(url));
      const isVideo = mime.startsWith("video/") || (!mime && /\.(mp4|webm|mov)(?:[?#]|$)/i.test(url));
      const isMedia = isImage || isVideo;
      if ((page === "media" && isMedia) || (page === "files" && !isMedia)) {
        return [{ message, attachment, url, filename, isImage, isVideo }];
      }
      return [];
    });
  });

  const name =
    chat?.nickname ||
    chat?.username ||
    chat?.name ||
    "Contact";

  // Reset when switching conversations.
  useEffect(() => {
    setPage("home");
    setNickname("");
    setQuery("");
    setMoreMenuOpen(false);
  }, [chat?.id]);

  // Close popup when tapping outside or pressing Escape.
  useEffect(() => {
    if (!moreMenuOpen) return;

    const handleOutside = (event) => {
      if (!moreMenuRef.current?.contains(event.target)) {
        setMoreMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMoreMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [moreMenuOpen]);

  // Escape also returns from subpages.
  useEffect(() => {
    if (moreMenuOpen) return;

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;

      if (page !== "home") {
        setPage("home");
      } else {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [page, moreMenuOpen, onClose]);

  if (!chat) return null;

  const send = (action, payload = {}) => {
    onAction?.(action, {
      chat,
      ...payload,
    });
  };

  const open = (action) => {
    setMoreMenuOpen(false);

    if (internalPages.has(action)) {
      setPage(action);
      return;
    }

    if (action === "theme" && onOpenBackgroundPicker) {
      onOpenBackgroundPicker(chat);
      return;
    }

    // Preserve existing action names for App.jsx.
    send(action);
  };

  const back = () => {
    if (moreMenuOpen) {
      setMoreMenuOpen(false);
      return;
    }

    if (page !== "home") {
      setPage("home");
      return;
    }

    onClose?.();
  };

  const handleMoreAction = (action) => {
    setMoreMenuOpen(false);
    send(action);
  };

  const handleNicknameSubmit = (event) => {
    event.preventDefault();

    const value = nickname.trim();

    if (!value) return;

    send("saveNickname", {
      nickname: value,
    });
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();

    const value = query.trim();

    if (!value) return;

    send("search", {
      query: value,
    });
  };

  return (
    <div
      className="chat-details-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section
        className="chat-details-panel"
        role="dialog"
        aria-modal="true"
        aria-label={
          page === "home"
            ? "Conversation information"
            : titleMap[page] || "Conversation settings"
        }
      >
        {/* =====================================
            TOP BAR - NO CENTER TITLE
        ===================================== */}

        <div className="chat-details-topbar">
          {/* BACK BUTTON */}
          <button
            type="button"
            className="chat-details-top-button"
            aria-label="Back"
            title="Back"
            onClick={back}
          >
            <ArrowLeft size={22} />
          </button>

          {/* THREE DOTS - HOME ONLY */}
          {page === "home" ? (
            <div
              className="messenger-more-wrapper"
              ref={moreMenuRef}
            >
              <button
                type="button"
                className="chat-details-top-button messenger-more-trigger"
                aria-label="More chat options"
                aria-haspopup="menu"
                aria-expanded={moreMenuOpen}
                onClick={() =>
                  setMoreMenuOpen((previous) => !previous)
                }
              >
                <MoreHorizontal size={23} />
              </button>

              {moreMenuOpen && (
                <div
                  className="messenger-more-popup"
                  role="menu"
                >
                  {!isGroup && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        handleMoreAction("open-chat-head")
                      }
                    >
                      <MessageCircle size={19} />
                      <span>Open chat head</span>
                    </button>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      handleMoreAction("delete-conversation")
                    }
                  >
                    <Trash2 size={19} />
                    <span>Delete conversation</span>
                  </button>

                  {!isGroup && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        handleMoreAction("block-contact")
                      }
                    >
                      <Ban size={19} />
                      <span>Block</span>
                    </button>
                  )}

                  <div className="messenger-more-divider" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      handleMoreAction(
                        "report-technical-problem"
                      )
                    }
                  >
                    <Flag size={19} />
                    <span>Report technical problem</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <span
              className="chat-details-header-spacer"
              aria-hidden="true"
            />
          )}
        </div>

        {/* =====================================
            SCROLLABLE CONTENT
        ===================================== */}

        <div className="chat-details-body" key={page}>
          {page === "home" ? (
            <>
              {/* CENTERED PROFILE */}
              <div className="chat-details-profile">
                <div className="chat-details-avatar">
                  <UserRound size={40} />
                </div>

                <h2>{name}</h2>

                <p>
                  {isGroup
                    ? `${chat.members?.length || 0} members`
                    : !showActiveStatus
                      ? "Active status hidden"
                      : online
                        ? "● Active now"
                        : "Offline"}
                </p>
              </div>

              {/* FOUR QUICK ACTIONS */}
              <div className="chat-details-quick">
                {[
                  ["profile", UserRound, "Profile"],
                  ["search", Search, "Search"],
                  [
                    "notifications",
                    muted ? BellOff : Bell,
                    "Mute",
                  ],
                  ["customize", Palette, "Customize"],
                ].map(([action, Icon, label]) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => open(action)}
                  >
                    <span>
                      <Icon size={21} />
                    </span>

                    <small>{label}</small>
                  </button>
                ))}
              </div>

              {/* SETTINGS SECTIONS */}
              {sections.map((section) => (
                <div
                  className="chat-details-section"
                  key={section.title}
                >
                  <h3>{section.title}</h3>

                  {section.items
                    .filter(([action]) => {
                      if (!isGroup) return true;

                      return ![
                        "createGroup",
                        "shareContact",
                        "restrict",
                        "block",
                        "chatHead",
                      ].includes(action);
                    })
                    .map(([action, Icon, label]) => (
                      <button
                        className="chat-details-item"
                        type="button"
                        key={action}
                        onClick={() => open(action)}
                      >
                        <Icon size={19} />

                        <span>{label}</span>

                        <ChevronRight size={17} />
                      </button>
                    ))}
                </div>
              ))}
            </>
          ) : page === "notifications" ? (
            /* NOTIFICATIONS */
            <div className="chat-details-section">
              <h3>Conversation preferences</h3>

              <button
                type="button"
                className="chat-details-item"
                onClick={() =>
                  send("setMuted", {
                    value: !muted,
                  })
                }
              >
                {muted ? (
                  <BellOff size={19} />
                ) : (
                  <Bell size={19} />
                )}

                <span>
                  {muted
                    ? "Unmute notifications"
                    : "Mute notifications"}
                </span>

                <ChevronRight size={17} />
              </button>

              <button
                type="button"
                className="chat-details-item"
                onClick={() =>
                  send("setSoundsEnabled", {
                    value: !soundsEnabled,
                  })
                }
              >
                {soundsEnabled ? (
                  <Volume2 size={19} />
                ) : (
                  <VolumeX size={19} />
                )}

                <span>
                  {soundsEnabled
                    ? "Turn notification sounds off"
                    : "Turn notification sounds on"}
                </span>

                <ChevronRight size={17} />
              </button>

              <button
                type="button"
                className="chat-details-item"
                onClick={() =>
                  send("setAutoSavePhotos", {
                    value: !autoSavePhotos,
                  })
                }
              >
                <Download size={19} />

                <span>
                  Auto-save photos:{" "}
                  {autoSavePhotos ? "On" : "Off"}
                </span>

                <ChevronRight size={17} />
              </button>
            </div>
          ) : page === "nicknames" ? (
            /* NICKNAMES */
            <form
              className="chat-details-form"
              onSubmit={handleNicknameSubmit}
            >
              <h3>Nicknames</h3>

              <label htmlFor="chat-nickname">
                Nickname for {name}
              </label>

              <input
                id="chat-nickname"
                value={nickname}
                onChange={(event) =>
                  setNickname(event.target.value)
                }
                maxLength={60}
                placeholder="Enter a nickname"
              />

              <button
                type="submit"
                disabled={!nickname.trim()}
              >
                <Save size={17} />
                Save nickname
              </button>
            </form>
          ) : page === "search" ? (
            /* SEARCH */
            <form
              className="chat-details-form"
              onSubmit={handleSearchSubmit}
            >
              <h3>Search conversation</h3>

              <label htmlFor="chat-search">
                Search messages
              </label>

              <input
                id="chat-search"
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Search messages"
              />

              <button
                type="submit"
                disabled={!query.trim()}
              >
                <Search size={17} />
                Search
              </button>
            </form>
          ) : page === "customize" ? (
            /* CUSTOMIZATION */
            <div className="chat-details-section">
              <h3>Customize chat</h3>

              <button
                type="button"
                className="chat-details-item"
                onClick={() => setPage("nicknames")}
              >
                <Pencil size={19} />
                <span>Nicknames</span>
                <ChevronRight size={17} />
              </button>

              <button
                type="button"
                className="chat-details-item"
                onClick={() => open("theme")}
              >
                <Palette size={19} />
                <span>Change chat theme</span>
                <ChevronRight size={17} />
              </button>
            </div>
          ) : (
            /* SHARED CONTENT */
            <div className="chat-details-shared">
              <h3>{titleMap[page] || "Shared content"}</h3>
              {shared.length === 0 ? (
                <div className="chat-details-empty">
                  <p>No {String(titleMap[page] || "shared content").toLowerCase()} yet.</p>
                </div>
              ) : page === "media" ? (
                <div className="chat-details-media-grid">
                  {shared.map((item, index) => (
                    <a
                      key={`${item.message.id ?? item.message._id ?? index}-${index}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${item.filename}`}
                    >
                      {item.isVideo ? (
                        <video src={item.url} preload="metadata" muted playsInline />
                      ) : (
                        <img src={item.url} alt={item.filename} loading="lazy" />
                      )}
                      {item.isVideo && <span className="chat-details-video-label">Video</span>}
                    </a>
                  ))}
                </div>
              ) : page === "files" ? (
                <div className="chat-details-shared-list">
                  {shared.map((item, index) => (
                    <a key={index} href={item.url} target="_blank" rel="noopener noreferrer">
                      <FileText size={20} /> <span>{item.filename}</span>
                      <Download size={18} />
                    </a>
                  ))}
                </div>
              ) : page === "links" ? (
                <div className="chat-details-shared-list">
                  {shared.map((item, index) => (
                    <a key={index} href={item.url} target="_blank" rel="noopener noreferrer">
                      <Link2 size={20} /> <span>{item.url}</span>
                      <ChevronRight size={18} />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="chat-details-shared-list">
                  {shared.map(({ message }, index) => (
                    <div className="chat-details-pinned-message" key={message.id ?? message._id ?? index}>
                      <Pin size={18} />
                      <span>{message.text || message.content || "Pinned attachment"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
