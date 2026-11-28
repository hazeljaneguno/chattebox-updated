import {
  Bell,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  Settings,
  SquarePen,
  Users,
} from "lucide-react";

import "./ChatSidebar.css";
import { typingChatKey } from "../hooks/useTypingIndicator.js";
import Avatar from "./Avatar.jsx";
import { formatChatDate, latestChatMessage, sameId } from "../utils/chatHelpers.js";
import { getReplyPreview } from "../utils/messageHelpers.js";

export default function ChatSidebar({
  user,
  chats,
  activeId,
  search,
  setSearch,
  filteredChats,
  typingByChat,
  chatFilter,
  setChatFilter,
  onlineIds,
  showActiveStatus,
  onEnableActiveStatus,
  savingActiveStatus,
  socketStatus,
  menuOpen,
  setMenuOpen,
  messageRequestCount,
  setShowMessageRequests,
  handleLogout,
  selectChat,
  setShowNewChat,
  setShowCreateGroup,
  setError,
  setSelectedMemberIds,
  setGroupName,
  setNewSearch,
  setShowSettings,
}) {
  const activeTab = chatFilter === "active";
  const onlineChats = chats.filter(
    (chat) => !chat.isGroup && onlineIds.has(String(chat.id))
  );
  const unreadCount = chats.reduce((total, chat) => total + (chat.unread || 0), 0);

  function openSettings() {
    setMenuOpen(false);
    setShowSettings(true);
  }

  function openCreateGroup() {
    setMenuOpen(false);
    setError("");
    setSelectedMemberIds([]);
    setGroupName("");
    setNewSearch("");
    setShowCreateGroup(true);
  }

  return (
    <aside className="sidebar chatterbox-sidebar" aria-label={activeTab ? "People" : "Chats"}>
      <header className="brand-row">
        <h1 className="brand-name">{activeTab ? "People" : <>Chatter<span>box</span></>}</h1>
        <button
          type="button"
          className="icon-button"
          aria-label="New chat"
          onClick={() => setShowNewChat(true)}
        >
          <SquarePen size={22} />
        </button>
      </header>

      {!activeTab && (
        <label className="search-box">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
          />
        </label>
      )}

      {activeTab ? (
        <section className="conversation-list people-panel" aria-label="Active contacts">
          <div className="people-status">
            <span aria-hidden="true" className={showActiveStatus ? "is-enabled" : ""} />
            {showActiveStatus ? `${onlineChats.length} active` : "Active Status is off"}
          </div>
          {!showActiveStatus ? (
            <div className="people-empty">
              <h2>See who’s online</h2>
              <p>Turn on Active Status to see who’s online and let them see when you’re active.</p>
              <button type="button" disabled={savingActiveStatus} onClick={onEnableActiveStatus}>
                {savingActiveStatus ? "Turning on…" : "Turn on Active Status"}
              </button>
            </div>
          ) : onlineChats.length ? (
            onlineChats.map((chat) => (
              <button type="button" key={chat.id} className="conversation people-contact" onClick={() => selectChat(chat)}>
                <Avatar name={chat.username || chat.name} photo={chat.profilePicture} online />
                <span className="conversation-copy">
                  <strong>{chat.username || chat.name}</strong>
                  <span className="last-message">Active now</span>
                </span>
              </button>
            ))
          ) : (
            <div className="people-empty">
              <h2>{socketStatus === "connected" ? "No contacts online" : "Connecting…"}</h2>
            </div>
          )}
        </section>
      ) : (
        <div className="conversation-list">
          <div className="sidebar-people" aria-label="Profile and online contacts">
            <button type="button" onClick={openSettings}>
              <Avatar
                name={user.username}
                photo={user.profilePicture}
                online={showActiveStatus && socketStatus === "connected"}
              />
              <span>My profile</span>
            </button>
            {onlineChats.map((chat) => (
              <button
                type="button"
                key={chat.id}
                onClick={() => selectChat(chat)}
              >
                <Avatar name={chat.username || chat.name} photo={chat.profilePicture} online />
                <span>{chat.username || chat.name}</span>
              </button>
            ))}
          </div>

          <div className="chat-filters" aria-label="Conversation filters">
            <button
              type="button"
              aria-pressed={chatFilter === "all"}
              className={chatFilter === "all" ? "filter-active" : ""}
              onClick={() => setChatFilter("all")}
            >
              All chats
            </button>
            <button
              type="button"
              aria-pressed={chatFilter === "unread"}
              className={chatFilter === "unread" ? "filter-active" : ""}
              onClick={() => setChatFilter("unread")}
            >
              Unread
              {unreadCount > 0 && <span className="filter-count">{unreadCount}</span>}
            </button>
            <button
              type="button"
              aria-pressed={chatFilter === "groups"}
              className={chatFilter === "groups" ? "filter-active" : ""}
              onClick={() => setChatFilter("groups")}
            >
              Groups
            </button>
          </div>

          {filteredChats.map((chat) => {
            const last = latestChatMessage(chat);
            const typingUsers = typingByChat?.get(typingChatKey(chat.id, chat.isGroup));
            const isTyping = Boolean(typingUsers?.length);

            return (
              <button
                key={chat.id}
                className={`conversation ${
                  sameId(activeId, chat.id) ? "conversation-active" : ""
                } ${chat.unread > 0 ? "conversation-unread" : ""}`}
                onClick={() => selectChat(chat)}
              >
                <Avatar
                  name={chat.username || chat.name}
                  photo={chat.profilePicture}
                  online={!chat.isGroup && onlineIds.has(String(chat.id))}
                />

                <span className="conversation-copy">
                  <span className="conversation-top">
                    <strong>{chat.username || chat.name}</strong>
                    <time dateTime={last?.createdAt}>{formatChatDate(last?.createdAt)}</time>
                  </span>

                  <span className="conversation-bottom">
                    <span className={isTyping ? "last-message is-typing" : "last-message"}>
                      {isTyping ? "Typing…" : last
                        ? `${sameId(last.senderId, user.id) ? "You: " : ""}${getReplyPreview(last)}`
                        : chat.isGroup
                          ? "Start a group conversation"
                          : chat.email || "Start a conversation"}
                    </span>

                    {chat.unread > 0 && (
                      <span className="unread-count">{chat.unread}</span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}

          {filteredChats.length === 0 && (
            <div className="empty-search">
              <Users size={23} />
              <strong>No matching chats</strong>
            </div>
          )}
        </div>
      )}

      <div className="sidebar-nav-wrap">
        {menuOpen && (
          <div className="floating-menu" id="sidebar-options">
            <button type="button" onClick={openSettings}><Settings size={17} /> Settings</button>
            <button type="button" onClick={openCreateGroup}><Users size={17} /> Create group</button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
            >
              <LogOut size={17} /> Log out
            </button>
          </div>
        )}

        <nav className="sidebar-nav" aria-label="Chat navigation">
          <button
            type="button"
            aria-pressed={!activeTab}
            onClick={() => {
              setMenuOpen(false);
              setChatFilter("all");
            }}
          >
            <span className="sidebar-nav-icon">
              <MessageCircle size={21} />
              {unreadCount > 0 && <span className="sidebar-nav-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </span>
            <span>Messages</span>
          </button>
          <button
            type="button"
            aria-pressed={activeTab}
            onClick={() => {
              setMenuOpen(false);
              setChatFilter("active");
            }}
          >
            <span className="sidebar-nav-icon"><Users size={21} /></span>
            <span>People</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setShowMessageRequests(true);
            }}
          >
            <span className="sidebar-nav-icon">
              <Bell size={21} />
              {messageRequestCount > 0 && (
                <span className="sidebar-nav-count">{messageRequestCount > 99 ? "99+" : messageRequestCount}</span>
              )}
            </span>
            <span>Notifications</span>
          </button>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? "sidebar-options" : undefined}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span className="sidebar-nav-icon"><Menu size={21} /></span>
            <span>Menu</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
