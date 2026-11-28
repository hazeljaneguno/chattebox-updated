import Avatar from "./Avatar.jsx";
import preparePhoto from "../utils/preparePhoto.js";
import { useMessageExtras } from "./messageExtras.js";

import { useEffect, useRef, useState } from "react";

import { api, API_URL } from "../api.js";
import { getAttachmentMediaType, getReplyPreview } from "../utils/messageHelpers.js";
import { canAddGroupMembers, formatChatDate } from "../utils/chatHelpers.js";
import { sharedMessageLinks } from "../utils/messageLinks.js";
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
      ["notifications", Bell, "Notifications & sounds"],
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
  members: "Members",
  addMembers: "Add members",
  profile: "Profile",
  search: "Search conversation",
  notifications: "Notifications & sounds",
  typingIndicator: "Typing indicator",
  customize: "Customize chat",
};

const internalPages = new Set([
  "media",
  "files",
  "links",
  "pinned",
  "nicknames",
  "members",
  "search",
  "notifications",
  "typingIndicator",
  "customize",
  "profile",
]);

export default function ChatDetails({
  chat,
  initialPage = "home",
  onSaveGroupPicture,
  onSetGroupAdmin,
  onSetGroupMemberAddPolicy,
  online = false,
  showActiveStatus = true,
  onEnableActiveStatus,
  savingActiveStatus = false,
  showTypingIndicator = true,
  onTypingIndicatorChange,
  onJumpToMessage,
  onClose,
  onAction,
  currentUserId,
  currentUser,
  onSavePrivateNickname,
  onSaveGroupNickname,
  onFindGroupMembers,
  onAddGroupMember,
  onOpenBackgroundPicker,
  messages = [],
}) {
  const [page, setPage] = useState(initialPage);
  const [nickname, setNickname] = useState("");
  const [nicknameMember, setNicknameMember] = useState(null);
  const nicknameDialogRef = useRef(null);
  const activeStatusDialogRef = useRef(null);
  useEffect(() => {
    if (showActiveStatus && activeStatusDialogRef.current?.open) {
      activeStatusDialogRef.current.close();
    }
  }, [showActiveStatus]);
  useEffect(() => {
    if (nicknameMember && !nicknameDialogRef.current?.open) nicknameDialogRef.current?.showModal();
  }, [nicknameMember]);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const muted = notificationSettings?.muted ?? false;
  const soundsEnabled = notificationSettings?.soundsEnabled ?? true;
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const moreMenuRef = useRef(null);

  const isGroup = Boolean(chat?.isGroup);
  const members = Array.isArray(chat?.members) ? chat.members : [];
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameError, setNicknameError] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberCandidates, setMemberCandidates] = useState([]);
  const [memberBusy, setMemberBusy] = useState(false);
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [pictureBusy, setPictureBusy] = useState(false);
  const [pictureError, setPictureError] = useState("");
  const pictureInput = useRef(null);
  const isCreator = currentUserId != null && String(chat?.creatorId) === String(currentUserId);
  const isAdmin = (id) => (chat?.adminIds || []).some((adminId) => String(adminId) === String(id));
  const canAddMembers = canAddGroupMembers(chat, currentUserId);
  const membersCanAdd = chat?.memberAddPolicy === "members";

  useEffect(() => {
    if (page !== "addMembers" || !canAddMembers || !onFindGroupMembers) return;
    let active = true;
    setMemberBusy(true);
    setMemberError("");
    setMemberCandidates([]);
    const timer = setTimeout(() => {
      onFindGroupMembers(memberSearch.trim())
        .then((people) => { if (active) setMemberCandidates(people); })
        .catch((error) => { if (active) setMemberError(error.message || "Could not load people."); })
        .finally(() => { if (active) setMemberBusy(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [page, canAddMembers, onFindGroupMembers, memberSearch]);

  const availableMembers = memberCandidates.filter((candidate) => !members.some((member) =>
    String(member.id ?? member._id) === String(candidate.id ?? candidate._id)
  ));
  const [extras] = useMessageExtras(chat?.id??chat?._id);
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

  const visibleMessages = allMessages.filter(
    (message) => !message.isDeleted && !message.deleted && !message.deletedForEveryone
  );
  const searchResults = submittedQuery ? visibleMessages.filter((message) =>
    [message.text, message.content, ...attachmentsFor(message).map((file) => file.originalName || file.name)]
      .some((value) => typeof value === "string" && value.toLowerCase().includes(submittedQuery))
  ).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) : [];
  const shared = ["media", "files", "links", "pinned"].includes(page) ? visibleMessages.flatMap((message) => {
    if (page === "pinned") return message.isPinned ? [{ message }] : [];
    if (page === "links") {
      return sharedMessageLinks(String(message.text || message.content || ""))
        .map((link) => ({ message, url: link.href }));
    }
    return attachmentsFor(message).flatMap((attachment) => {
      const source = attachment.url || attachment.secure_url || attachment.path;
      const url = safeUrl(
        typeof source === "string" && source.startsWith("/uploads/")
          ? `${API_URL.replace(/\/+$/, "")}${source}`
          : source
      );
      if (!url) return [];
      const filename = attachment.originalName || attachment.filename || attachment.name || "Shared file";
      const media = getAttachmentMediaType({
        mimeType: attachment.mimeType || attachment.mimetype || attachment.type,
        originalName: filename,
        url,
      });
      const isImage = media === "image";
      const isVideo = media === "video";
      const isMedia = isImage || isVideo;
      if ((page === "media" && isMedia) || (page === "files" && !isMedia)) {
        return [{ message, attachment, url, filename, isImage, isVideo }];
      }
      return [];
    });
  }) : [];

  const name =
    chat?.nickname ||
    chat?.username ||
    chat?.name ||
    "Contact";

  // Reset when switching conversations.
  useEffect(() => {
    setPage(initialPage);
    setNickname("");
    setNicknameError("");
    setQuery("");
    setSubmittedQuery("");
    setMoreMenuOpen(false);
  }, [chat?.id, initialPage]);

  useEffect(() => {
    if (page !== "notifications" || !chat?.id) return;
    let active = true;
    setNotificationError("");
    api.chatNotifications({ id: chat.id, isGroup })
      .then((settings) => { if (active) setNotificationSettings(settings); })
      .catch((error) => { if (active) setNotificationError(error.message); });
    return () => { active = false; };
  }, [page, chat?.id, isGroup]);

  async function updateNotifications(changes) {
    setSavingNotifications(true);
    setNotificationError("");
    try {
      setNotificationSettings(await api.updateChatNotifications(chat, changes));
    } catch (error) {
      setNotificationError(error.message);
    } finally {
      setSavingNotifications(false);
    }
  }

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
    if (moreMenuOpen || nicknameMember) return;

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
  }, [page, moreMenuOpen, onClose, nicknameMember]);

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

  const nicknameRows = isGroup ? members : [chat, currentUser].filter(Boolean).map((person) => ({
    ...person,
    nickname: chat.nicknames?.[String(person.id ?? person._id ?? person.userId)],
  }));
  const saveNickname = isGroup ? onSaveGroupNickname : onSavePrivateNickname;

  async function handleNicknameSubmit(event) {
    event.preventDefault();
    if (!nicknameMember || !saveNickname || nicknameSaving) return;
    setNicknameError("");
    setNicknameSaving(true);
    try {
      await saveNickname(chat, nickname.trim(), nicknameMember.id);
      setNicknameMember(null);
    } catch (error) {
      setNicknameError(error.message || "Could not save nickname.");
    } finally {
      setNicknameSaving(false);
    }
  }

  async function saveGroupPicture(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || pictureBusy) return;
    setPictureBusy(true);
    setPictureError("");
    try {
      await onSaveGroupPicture(chat, await preparePhoto(file));
    } catch (error) {
      setPictureError(error.message || "Could not save the group photo.");
    } finally {
      setPictureBusy(false);
    }
  }

  async function changeMemberAddPolicy(policy) {
    setMemberError("");
    setMemberSaving(true);
    try {
      await onSetGroupMemberAddPolicy(chat, policy);
    } catch (error) {
      setMemberError(error.message || "Could not change who can add members.");
    } finally {
      setMemberSaving(false);
    }
  }

  async function changeAdmin(memberId, admin) {
    setMemberSaving(true);
    setMemberError("");
    try {
      await onSetGroupAdmin(chat, memberId, admin);
    } catch (error) {
      setMemberError(error.message || "Could not update the admin role.");
    } finally {
      setMemberSaving(false);
    }
  }

  async function addMember(memberId) {
    setMemberSaving(true);
    setMemberError("");
    try {
      await onAddGroupMember(chat, memberId);
    } catch (error) {
      setMemberError(error.message || "Could not add member.");
    } finally {
      setMemberSaving(false);
    }
  }

  function memberProfile(member) {
    const label = member.nickname || member.username || "Member";
    return (
      <>
        <Avatar name={label} photo={member.profilePicture} />
        <span style={{ overflowWrap: "anywhere" }}>{label}</span>
      </>
    );
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault();

    const value = query.trim();

    if (!value) return;

    setSubmittedQuery(value.toLowerCase());
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
                  <Avatar name={name} photo={chat.profilePicture} online={!isGroup && showActiveStatus && online} />
                </div>
                {isGroup && onSaveGroupPicture && (
                  <>
                    <input ref={pictureInput} type="file" hidden
                      accept="image/jpeg,image/png,image/webp" onChange={saveGroupPicture} />
                    <button className="chat-details-photo-button" type="button" disabled={pictureBusy}
                      onClick={() => pictureInput.current?.click()}>
                      <Images size={16} /> {pictureBusy ? "Uploading…" : "Change group photo"}
                    </button>
                    {pictureError && <p role="alert">{pictureError}</p>}
                  </>
                )}

                <h2>{name}</h2>

                {isGroup ? (
                  <p>{chat.members?.length || 0} members</p>
                ) : showActiveStatus ? (
                  <p>{online ? "● Active now" : "Offline"}</p>
                ) : (
                  <button type="button" className="chat-active-status-trigger" aria-haspopup="dialog"
                    onClick={() => activeStatusDialogRef.current?.showModal()}>
                    Turn on Active Status
                  </button>
                )}
                {!isGroup && (
                  <dialog ref={activeStatusDialogRef} className="chat-active-status-dialog"
                    aria-labelledby="chat-active-status-heading"
                    onClick={(event) => {
                      if (event.target === event.currentTarget) event.currentTarget.close();
                    }}>
                    <div className="chat-active-status-sheet">
                      <span className="chat-active-status-symbol" aria-hidden="true"><UserRound size={30} /></span>
                      <h3 id="chat-active-status-heading">Share your Active Status</h3>
                      <p>See who’s online and let others see when you’re active.</p>
                      <div className="chat-active-status-actions">
                        <button type="button" disabled={savingActiveStatus} onClick={onEnableActiveStatus}>
                          {savingActiveStatus ? "Turning on…" : "Turn on Active Status"}
                        </button>
                        <button type="button" onClick={() => activeStatusDialogRef.current?.close()}>Not now</button>
                      </div>
                    </div>
                  </dialog>
                )}
              </div>

              {/* FOUR QUICK ACTIONS */}
              <div className="chat-details-quick">
                {(isGroup ? [
                  ["addMembers", UserPlus, "Add"],
                  ["nicknames", Pencil, "Nicknames"],
                  ["search", Search, "Search"],
                  ["customize", Palette, "Customize"],
                ] : [
                  ["profile", UserRound, "Profile"],
                  ["search", Search, "Search"],
                  [
                    "notifications",
                    muted ? BellOff : Bell,
                    "Mute",
                  ],
                  ["customize", Palette, "Customize"],
                ]).map(([action, Icon, label]) => (
                  <button
                    key={action}
                    type="button"
                    disabled={action === "addMembers" && (!canAddMembers || !onFindGroupMembers || !onAddGroupMember)}
                    title={action === "addMembers" && !canAddMembers ? "Only admins can add members" : undefined}
                    onClick={() => action === "addMembers" ? setPage("addMembers") : open(action)}
                  >
                    <span>
                      <Icon size={21} />
                    </span>

                    <small>{label}</small>
                  </button>
                ))}
              </div>

              {isGroup && (
                <section className="chat-details-section" aria-label="Group members">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3>Members</h3>
                    <button className="chat-details-item" style={{ width: "auto" }} type="button" onClick={() => { setMemberError(""); open("members"); }}>
                      See all
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, textAlign: "center" }}>
                    {members.slice(0, 4).map((member) => (
                      <div key={member.id ?? member._id} style={{ display: "grid", alignContent: "start", gap: 6 }}>
                        {memberProfile(member)}
                      </div>
                    ))}
                  </div>
                </section>
              )}

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

                        <span>
                          {label}
                          {action === "typingIndicator" && (
                            <small className="chat-details-typing-state">
                              {showTypingIndicator ? "On" : "Off"}
                            </small>
                          )}
                        </span>

                        <ChevronRight size={17} />
                      </button>
                    ))}
                </div>
              ))}
            </>
          ) : page === "typingIndicator" ? (
            <div className="chat-details-section">
              <h3>Typing indicator</h3>
              <label className="chat-details-item chat-details-typing-option">
                <span>
                  Show typing indicator
                  <small id="chat-details-typing-description" className="chat-details-typing-state">
                    {showTypingIndicator
                      ? "Others in this chat can see when you’re composing a message."
                      : "Your typing is hidden from others in this chat."}
                  </small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Show typing indicator"
                  aria-describedby="chat-details-typing-description"
                  checked={showTypingIndicator}
                  onChange={(event) => onTypingIndicatorChange(event.target.checked)}
                />
              </label>
            </div>
          ) : page === "notifications" ? (
            /* NOTIFICATIONS */
            <div className="chat-details-section">
              <h3>Conversation preferences</h3>

              <button
                type="button"
                className="chat-details-item"
                disabled={!notificationSettings || savingNotifications}
                aria-pressed={muted}
                onClick={() => updateNotifications({ muted: !muted })}
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
                disabled={!notificationSettings || savingNotifications}
                aria-pressed={soundsEnabled}
                onClick={() => updateNotifications({ soundsEnabled: !soundsEnabled })}
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

              {notificationError && <p role="alert">{notificationError}</p>}
              {!notificationSettings && !notificationError && <p role="status">Loading settings…</p>}
            </div>
          ) : page === "members" ? (
            <div className="chat-details-section">
              <h3>Members</h3>
              {isCreator && onSetGroupMemberAddPolicy ? (
                <label className="chat-details-form">
                  Who can add members?
                  <select
                    value={membersCanAdd ? "members" : "admins"}
                    disabled={memberSaving}
                    onChange={(event) => changeMemberAddPolicy(event.target.value)}
                  >
                    <option value="admins">Admins only</option>
                    <option value="members">Anyone in the group</option>
                  </select>
                </label>
              ) : (
                <p>{membersCanAdd ? "Anyone in the group can add members." : "Only admins can add members."}</p>
              )}
              {memberError && <p role="alert">{memberError}</p>}
              {members.map((member) => {
                const id = member.id ?? member._id;
                const creator = String(id) === String(chat.creatorId);
                const admin = isAdmin(id);
                return (
                  <div className="chat-details-member-row" key={id}>
                    {memberProfile(member)}
                    <small>{creator ? "Creator · Admin" : admin ? "Admin" : "Member"}</small>
                    {isCreator && !creator && onSetGroupAdmin && (
                      <button type="button" className="chat-details-photo-button" disabled={memberSaving}
                        onClick={() => changeAdmin(id, !admin)}>
                        {admin ? "Remove admin" : "Make admin"}
                      </button>
                    )}
                  </div>
                );
              })}
              {members.length === 0 && <p>No members to display.</p>}
            </div>
          ) : page === "addMembers" ? (
            <div className="chat-details-section">
              <h3>Add members</h3>
              {canAddMembers && (
                <label className="chat-details-form">
                  Search people
                  <input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} />
                </label>
              )}
              {memberBusy && <p role="status">Working…</p>}
              {memberError && <p role="alert">{memberError}</p>}
              {!canAddMembers && <p>Only admins can add members.</p>}
              {canAddMembers && !memberBusy && !memberError && availableMembers.length === 0 && (
                <p>No additional people found.</p>
              )}
              {canAddMembers && availableMembers.map((candidate) => (
                <button className="chat-details-item" key={candidate.id ?? candidate._id} type="button"
                  disabled={memberBusy || memberSaving} onClick={() => addMember(candidate.id ?? candidate._id)}>
                  <Avatar name={candidate.username} photo={candidate.profilePicture} />
                  <span>Add {candidate.username}</span>
                </button>
              ))}
            </div>
          ) : page === "profile" ? (
            <div className="chat-details-profile">
              <div className="chat-details-avatar"><Avatar name={name} photo={chat.profilePicture} /></div>
              <h2>{name}</h2>
            </div>
          ) : page === "nicknames" ? (
            <div className="chat-details-nickname-list">
              {nicknameRows.map((member) => {
                const id = member.id ?? member._id ?? member.userId;
                const username = member.username || member.name || "Member";
                return (
                  <button type="button" className="chat-details-nickname-row" key={id}
                    disabled={!saveNickname || id == null}
                    onClick={() => {
                      setNickname(member.nickname || "");
                      setNicknameError("");
                      setNicknameMember({ id, username });
                    }}>
                    <span className="nickname-initial" aria-hidden="true">{username[0].toUpperCase()}</span>
                    <span className="nickname-row-label">
                      <strong>{member.nickname || "Set nickname"}</strong>
                      <small>{username}</small>
                    </span>
                    <Pencil size={17} aria-hidden="true" />
                  </button>
                );
              })}

              {nicknameMember && (
                <dialog ref={nicknameDialogRef} className="chat-nickname-dialog"
                  aria-labelledby="edit-nickname-heading" onCancel={(event) => {
                    event.preventDefault();
                    if (!nicknameSaving) setNicknameMember(null);
                  }}>
                  <form onSubmit={handleNicknameSubmit}>
                    <h3 id="edit-nickname-heading">Edit nickname</h3>
                    <p>Members of this chat will see this nickname here.</p>
                    <label htmlFor="chat-nickname">Nickname for {nicknameMember.username}</label>
                    <input id="chat-nickname" value={nickname} maxLength={60}
                      placeholder={nicknameMember.username} readOnly={nicknameSaving}
                      autoFocus onChange={(event) => setNickname(event.target.value)} />
                    <small>Clear the field to reset the nickname.</small>
                    {nicknameError && <p role="alert">{nicknameError}</p>}
                    <div className="nickname-dialog-actions">
                      <button type="button" disabled={nicknameSaving}
                        onClick={() => setNicknameMember(null)}>Cancel</button>
                      <button type="submit" disabled={nicknameSaving}>{nicknameSaving ? "Saving…" : "Set"}</button>
                    </div>
                  </form>
                </dialog>
              )}
            </div>
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
              {submittedQuery && (
                <div className="chat-details-shared-list">
                  {searchResults.length === 0 && <p>No matching messages.</p>}
                  {searchResults.map((message) => (
                    <button key={message.id ?? message._id} type="button" className="chat-details-item"
                      onClick={() => onJumpToMessage?.(message.id ?? message._id)}>
                      <span>{getReplyPreview(message)}</span>
                      <time dateTime={message.createdAt}>{formatChatDate(message.createdAt)}</time>
                    </button>
                  ))}
                </div>
              )}
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
                    <button type="button" className="chat-details-item" key={message.id ?? message._id ?? index}
                      onClick={() => onJumpToMessage?.(message.id ?? message._id)}>
                      <Pin size={18} />
                      <span>{getReplyPreview(message)}</span>
                    </button>
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
