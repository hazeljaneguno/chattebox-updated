import {
  Bell,
  House,
  ChevronRight,
  MessagesSquare,
  PhoneMissed,
  UsersRound,
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
import SocialDiscover from "./SocialDiscover.jsx";
import SocialPage from "./SocialPage.jsx";
import Avatar from "./Avatar.jsx";
import { isInboxChat, formatChatDate, latestChatMessage, sameId } from "../utils/chatHelpers.js";
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
  missedCalls,
  onCallBack,
  messageRequestCount,
  messageRequestsPage,
  socket,
  onSocialMessage,
  handleLogout,
  selectChat,
  openNewMessage,
  setShowCreateGroup,
  setError,
  setSelectedMemberIds,
  setGroupName,
  setNewSearch,
  setShowSettings,
}) {
  const activeTab = chatFilter === "active";
  const notificationsTab = chatFilter === "notifications";
  const socialTab = chatFilter === "social";
  const requestsTab = chatFilter === "requests";
  const menuTab = chatFilter === "menu" || requestsTab;
  const openRequests = () => setChatFilter("requests");
  const messagesTab = !activeTab && !notificationsTab && !menuTab && !socialTab;
  const title = socialTab ? "Chatterbox Social" : requestsTab ? "Message requests" : notificationsTab ? "Notifications" : menuTab ? "Menu" : activeTab ? "People" : "Chats";
  const notificationCount = messageRequestCount + missedCalls.filter((call) => !call.read).length;
  const profileName = user.displayName || user.name || user.username || "Your account";
  const onlineChats = chats.filter(
    (chat) => !chat.isGroup && onlineIds.has(String(chat.id))
  );
  const unreadCount = chats.filter(isInboxChat).reduce((total, chat) => total + (chat.unread || 0), 0);

  function openSettings() {
    setShowSettings(true);
  }

  function openCreateGroup() {
    setError("");
    setSelectedMemberIds([]);
    setGroupName("");
    setNewSearch("");
    setShowCreateGroup(true);
  }

  return (
    <aside className="sidebar chatterbox-sidebar" aria-label={title}>
      <header className="brand-row">
        <h1 className="brand-name">{messagesTab ? <>Chatter<span>box</span></> : title}</h1>
        <div className="sidebar-header-actions">
          {socialTab ? (
            <button type="button" className="sidebar-messages-shortcut" onClick={() => setChatFilter("all")}>
              <MessageCircle size={18} aria-hidden="true" /> Messages
            </button>
          ) : (
            <button type="button" className="icon-button" aria-label="Open Social Home"
              title="Social Home" onClick={() => setChatFilter("social")}>
              <House size={21} aria-hidden="true" />
            </button>
          )}
          {(messagesTab || activeTab) && (
            <button type="button" className="icon-button" aria-label="New message" onClick={openNewMessage}>
              <SquarePen size={22} />
            </button>
          )}
        </div>
      </header>

      {messagesTab && (
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

      {socialTab ? (
        <SocialPage socket={socket} onMessage={onSocialMessage} />
      ) : requestsTab ? (
        messageRequestsPage
      ) : notificationsTab ? (
        <SidebarNotifications
          missedCalls={missedCalls}
          chats={chats}
          messageRequestCount={messageRequestCount}
          onOpenRequests={openRequests}
          socket={socket}
          onSocialMessage={onSocialMessage}
          onOpenSocial={() => setChatFilter("social")}
          onCallBack={onCallBack}
        />
      ) : menuTab ? (
        <section className="conversation-list sidebar-page" aria-label="Account and chat actions">
          <div className="sidebar-page-group">
            <button type="button" className="sidebar-page-row sidebar-profile-row" onClick={openSettings}>
              <Avatar name={profileName} photo={user.profilePicture} />
              <span className="sidebar-page-copy">
                <strong>{profileName}</strong>
                {user.username && <small>@{user.username}</small>}
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <button type="button" className="sidebar-page-row" onClick={openSettings}>
              <Settings size={22} aria-hidden="true" /> Settings
            </button>
          </div>
          <div className="sidebar-page-group">
            <button type="button" className="sidebar-page-row" onClick={() => setChatFilter("social")}>
              <UsersRound size={22} aria-hidden="true" /> Friends and suggestions
            </button>
            <button type="button" className="sidebar-page-row" onClick={() => setChatFilter("groups")}>
              <Users size={22} aria-hidden="true" /> Group chats
            </button>
            <button type="button" className="sidebar-page-row" onClick={openRequests}>
              <MessagesSquare size={22} aria-hidden="true" /> Message requests
              {messageRequestCount > 0 && <span className="sidebar-page-badge">{messageRequestCount}</span>}
            </button>
            <button type="button" className="sidebar-page-row" onClick={openCreateGroup}>
              <UsersRound size={22} aria-hidden="true" /> Create group
            </button>
          </div>
          <div className="sidebar-page-group">
            <button type="button" className="sidebar-page-row" onClick={handleLogout}>
              <LogOut size={22} aria-hidden="true" /> Log out
            </button>
          </div>
        </section>
      ) : activeTab ? (
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
        <nav className="sidebar-nav" aria-label="Chat navigation">
          <button
            type="button"
            aria-pressed={messagesTab}
            onClick={() => setChatFilter("all")}
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
            onClick={() => setChatFilter("active")}
          >
            <span className="sidebar-nav-icon"><Users size={21} /></span>
            <span>People</span>
          </button>
          <button
            type="button"
            aria-pressed={notificationsTab}
            onClick={() => setChatFilter("notifications")}
          >
            <span className="sidebar-nav-icon">
              <Bell size={21} />
              {notificationCount > 0 && (
                <span className="sidebar-nav-count">{notificationCount > 99 ? "99+" : notificationCount}</span>
              )}
            </span>
            <span>Notifications</span>
          </button>
          <button
            type="button"
            aria-pressed={menuTab}
            onClick={() => setChatFilter("menu")}
          >
            <span className="sidebar-nav-icon"><Menu size={21} /></span>
            <span>Menu</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}

function SidebarNotifications({ missedCalls, chats, messageRequestCount, onOpenRequests, onOpenSocial, onCallBack, onSocialMessage, socket }) {
  const today = new Date().toDateString();
  const todayCalls = [];
  const earlierCalls = [];
  for (const call of missedCalls) {
    const bucket = new Date(call.createdAt).toDateString() === today ? todayCalls : earlierCalls;
    bucket.push(call);
  }

  return (
    <section className="conversation-list sidebar-page sidebar-notifications" aria-label="Recent activity">
      {[[ "Today", todayCalls ], [ "Earlier", earlierCalls ]].map(([label, calls]) => (
        calls.length > 0 && (
          <section className="sidebar-notification-group" key={label}>
            <h2>{label}</h2>
            {calls.map((call) => {
              const chat = chats.find((item) => !item.isGroup && sameId(item.id, call.callerId));
              const name = chat?.username || chat?.name || "Missed caller";
              const description = call.callType === "video" ? "Missed video call" :
                call.callType === "audio" ? "Missed audio call" : "Missed call";
              return (
                <div className="sidebar-notification-row" key={call.id}>
                  <Avatar name={name} photo={chat?.profilePicture} />
                  <span className="sidebar-page-copy">
                    <strong>{name}</strong>
                    <small>{description} · <time dateTime={call.createdAt}>{formatChatDate(call.createdAt)}</time></small>
                  </span>
                  {chat && <button type="button" onClick={() => onCallBack(call, chat)}>Call back</button>}
                  {!call.read && <span className="sidebar-notification-dot" aria-label="Unread" />}
                </div>
              );
            })}
          </section>
        )
      ))}
      {messageRequestCount > 0 && (
        <section className="sidebar-notification-group">
          <h2>Message requests</h2>
          <div className="sidebar-notification-row">
            <span className="sidebar-notification-icon"><MessagesSquare size={22} aria-hidden="true" /></span>
            <span className="sidebar-page-copy">
              <strong>{messageRequestCount} pending {messageRequestCount === 1 ? "request" : "requests"}</strong>
            </span>
            <button type="button" onClick={onOpenRequests}>Review</button>
          </div>
        </section>
      )}
      {!missedCalls.length && !messageRequestCount && (
        <div className="sidebar-notification-empty">
          <PhoneMissed size={24} aria-hidden="true" />
          <h2>You’re all caught up</h2>
          <p>Missed calls and message requests will appear here.</p>
        </div>
      )}
      <SocialDiscover notifications socket={socket} onMessage={onSocialMessage} />
      <SocialPage compact socket={socket} onOpenSocial={onOpenSocial} />
    </section>
  );
}
