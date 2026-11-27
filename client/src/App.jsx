import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  MessageCircle,
  LoaderCircle,
  Plus,
} from "lucide-react";

import { createPortal } from "react-dom";

import AuthScreen from "./components/AuthScreen.jsx";
import ChatSidebar from "./components/ChatSidebar.jsx";
import ChatHeader from "./components/ChatHeader.jsx";
import MessageComposer from "./components/MessageComposer.jsx";
import FindPeopleModal from "./components/FindPeopleModal.jsx";
import CreateGroupModal from "./components/CreateGroupModal.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import ChatBackgroundPicker from "./components/ChatBackgroundPicker.jsx";
import ChatError from "./components/ChatError.jsx";
import ConversationBody from "./components/ConversationBody.jsx";
import ReplyPreview from "./components/ReplyPreview.jsx";
import NotificationToasts from "./components/NotificationToasts.jsx";
import CallModal from "./components/CallModal.updated.jsx";
import MessageRequestsModal from "./components/MessageRequestsModal.jsx";
import GroupCallModal from "./components/GroupCallModal.jsx";
import useGroupCall from "./hooks/useGroupCall.js";
import IncomingGroupCall from "./components/IncomingGroupCall.jsx";
import ChatDetails from "./components/ChatDetails.jsx";
import {
  registerPushNotifications,
  unregisterPushNotifications,
  setNotificationTapHandler,
  clearPendingIncomingCallAction,
} from "./services/pushNotifications.js";

import { api, connectSocket } from "./api.js";
import { latestChatMessage, messageTimestamp, sameId } from "./utils/chatHelpers.js";
import useTypingIndicator from "./hooks/useTypingIndicator.js";
import useMessageActions from "./hooks/useMessageActions.js";
import useChatMessages from "./hooks/useChatMessages.js";
import useChatSocket from "./hooks/useChatSocket.js";
import useWebRTC from "./hooks/useWebRTC.js";
import useConversationSettings from "./hooks/useConversationSettings.js";
import useMessageSocketEvents from "./hooks/useMessageSocketEvents.js";
import { listenForBubbleNavigation } from "./utils/bubbleNavigation.js";
function groupBackgroundNotice(update) {
  const username = update?.changedBy?.username;
  const background = update?.background;

  if (!username || !background) return null;
  if (background === "default") return `${username} reset the chat background.`;

  const backgroundName = background.charAt(0).toUpperCase() + background.slice(1);
  return `${username} changed the chat background to ${backgroundName}.`;
}

function groupCallStartNotice(call, members = []) {
  const host = call.hostId;
  const hostId = host?._id ?? host?.id ?? host;
  const member = members.find((item) => hostId && sameId(item.id ?? item._id, hostId));
  const name = member?.nickname || call.hostName || host?.username
    || call.callerName || member?.username || "A group member";
  const kind = call.callType === "audio" ? "voice" : "video";
  return `${name} started a group ${kind} call.`;
}

function updateGroupCallHistory(chats, call, ended = false) {
  const groupId = String(call?.groupId?._id ?? call?.groupId?.id ?? call?.groupId ?? "");
  const callId = String(call?.callId ?? "");

  if (!groupId || !callId) return chats;

  return chats.map((chat) => {
    if (!chat.isGroup || String(chat.id ?? chat._id) !== groupId) {
      return chat;
    }

    const messages = Array.isArray(chat.messages)
      ? chat.messages
      : [];

    const existing = messages.find(
      (message) =>
        String(message.callId ?? "") === callId &&
        [
          "group_call",
          "group_call_started",
          "group_call_ended",
        ].includes(message.type)
    );

    const startedAt =
      call.startedAt ??
      existing?.startedAt ??
      call.createdAt ??
      (ended ? null : new Date().toISOString());

    const event = {
      ...(existing || {}),
      _id: existing?._id ?? `group-call-${callId}`,
      type: "group_call",
      isGroup: true,
      groupId,
      callId,
      callType:
        call.callType ?? existing?.callType ?? "video",
      status: ended ? "ended" : "active",
      startedAt,
      endedAt: ended
        ? call.endedAt ?? new Date().toISOString()
        : existing?.endedAt ?? null,
      createdAt:
        existing?.createdAt ??
        startedAt ??
        call.endedAt ??
        new Date().toISOString(),
    };

    return {
      ...chat,
      messages: existing
        ? messages.map((message) =>
            message === existing ? event : message
          )
        : [...messages, event],
    };
  });
}

export default function App() {
  // =========================
  // 1. USER AND CHAT STATE
  // =========================
  const [callChatPanel, setCallChatPanel] = useState(null);
  const [user, setUser] = useState(null);

  const authenticatedUserId = user?.id ?? user?._id ?? user?.userId ?? null;

  const [checkingSession, setCheckingSession] = useState(true);

  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [search, setSearch] = useState("");

  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);

  const [newSearch, setNewSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [messageRequests, setMessageRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showMessageRequests, setShowMessageRequests] = useState(false);
const [showChatDetails, setShowChatDetails] = useState(false);
const [messageJump, setMessageJump] = useState(null);
  // =========================
  // 3. NOTIFICATION STATE
  // =========================

  const [toast, setToast] = useState("");
  const [mentionToast, setMentionToast] = useState(null);
  const [mentionSuccessToast, setMentionSuccessToast] = useState("");

  const [error, setError] = useState("");

  // =========================
  // 4. CHAT AND SOCKET STATE
  // =========================

  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [socketStatus, setSocketStatus] = useState("connecting");

  const [socket, setSocket] = useState(null);

  const [chatFilter, setChatFilter] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);

  // =========================
  // 5. GROUP STATE
  // =========================

  const [groups, setGroups] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [savingGroup, setSavingGroup] = useState(false);

  // =========================
  // 6. MESSAGE COMPOSER STATE
  // =========================

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);

  const [editDraft, setEditDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // =========================
  // 7. LOADING STATE
  // =========================

  const [loadingMessages, setLoadingMessages] = useState(false);

  // =========================
  // 8. SETTINGS STATE
  // =========================

  const [showSettings, setShowSettings] = useState(false);

  const [theme, setTheme] = useState("light");
  const [savingTheme, setSavingTheme] = useState(false);

  const [showActiveStatus, setShowActiveStatus] = useState(true);
  const [savingActiveStatus, setSavingActiveStatus] = useState(false);

  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);

  // =========================
  // 9. CALL STATE
  // =========================

  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [incomingGroupCall, setIncomingGroupCall] = useState(null);

  const [groupCallStatus, setGroupCallStatus] = useState("");
  const [activeGroupCall, setActiveGroupCall] = useState(null);
  const [ongoingGroupCall, setOngoingGroupCall] = useState(null);

  const [callStatus, setCallStatus] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // =========================
  // 10. REFS
  // =========================
  const pushRegistrationUserRef = useRef(null);

  const bottomRef = useRef(null);
  const toastTimer = useRef(null);

  const activeIdRef = useRef(activeId);
  const inputRef = useRef(null);
  const socketRef = useRef(null);

  const pendingNotificationRef = useRef(null);
  const chatsRef = useRef(chats);

  const recoveringCallIdsRef = useRef(new Set());
  const handledCallActionsRef = useRef(new Set());

const [callMessageNotifications, setCallMessageNotifications] = useState({});  

  // =========================
  // 11. ACTIVE CHAT
  // =========================

  const activeChat = chats.find((chat) =>
    sameId(chat.id, activeId)
  );
  const applyGroupNickname = useCallback((update) => {
    if (!update?.groupId || !update.userId || typeof update.nickname !== "string") return;

    function updateGroup(group) {
      if (!sameId(group.id ?? group._id, update.groupId) || !Array.isArray(group.members)) {
        return group;
      }
      return {
        ...group,
        members: group.members.map((member) =>
          sameId(member.id ?? member._id, update.userId)
            ? { ...member, nickname: update.nickname }
            : member
        ),
      };
    }

    setGroups((previous) => previous.map(updateGroup));
    setChats((previous) => previous.map((chat) => chat.isGroup ? updateGroup(chat) : chat));
  }, [setGroups, setChats]);

  const applyGroupMembers = useCallback(({ group } = {}) => {
    if (!group?.id || !Array.isArray(group.members)) return;

    setGroups((previous) => previous.some((item) => sameId(item.id, group.id))
      ? previous.map((item) => sameId(item.id, group.id) ? { ...item, ...group } : item)
      : [...previous, group]);
    setChats((previous) => previous.some((chat) => chat.isGroup && sameId(chat.id, group.id))
      ? previous.map((chat) => chat.isGroup && sameId(chat.id, group.id) ? { ...chat, ...group } : chat)
      : [...previous, { ...group, isGroup: true, messages: [], unread: 0 }]);
  }, [setGroups, setChats]);

  useEffect(() => {
    if (!socket) return;
    socket.on("group:members:updated", applyGroupMembers);
    return () => socket.off("group:members:updated", applyGroupMembers);
  }, [socket, applyGroupMembers]);

  const conversationChat = useMemo(() => {
    if (!activeChat?.isGroup || !Array.isArray(activeChat.members)) return activeChat;

    const nicknames = new Map(activeChat.members
      .filter((member) => member.nickname)
      .map((member) => [String(member.id ?? member._id), member.nickname]));

    if (!nicknames.size || !Array.isArray(activeChat.messages)) return activeChat;
    return {
      ...activeChat,
      messages: activeChat.messages.map((message) => {
        const nickname = nicknames.get(String(message.senderId));
        return nickname ? { ...message, senderName: nickname } : message;
      }),
    };
  }, [activeChat]);

const showGroupCallChat = Boolean(
  activeGroupCall &&
  callChatPanel &&
  activeChat?.isGroup &&
  sameId(activeChat.id, activeGroupCall.groupId)
);
  // =========================
  // 12. CUSTOM HOOKS
  // =========================

  const applyPrivateNickname = useConversationSettings({
    user,
    activeChat,
    setChats,
    socket, 
  });

  useMessageSocketEvents({
    socket,
    user,
    setChats,
  });

  const {
    localStream,
    remoteStream,
    connectionState,
    mediaError,
    createOffer,
    createAnswer,
    handleRemoteAnswer,
    handleRemoteCandidate,
    cleanupCall,
    setCallId,
  } = useWebRTC(socket);
const {
  room: groupCallRoom,
  participants: groupCallParticipants,
  connectionState: groupCallConnectionState,
  error: groupCallError,
  joinGroupCall,
  leaveGroupCall,
} = useGroupCall();

const { handleTypingChange, typingUserIds } =
  useTypingIndicator(socket, activeChat);

  // =========================
  // 13. NOTIFICATION HANDLER
  // =========================

  const showNotice = useCallback((message) => {
    setToast(message);

    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }

    toastTimer.current = window.setTimeout(() => {
      setToast("");
    }, 2800);
  }, []);

  useEffect(() => {
    if (!socket) return;

    function handleGroupNicknameUpdated(update) {
      applyGroupNickname(update);

      if (
        typeof update?.notice === "string" &&
        sameId(activeIdRef.current, update.groupId)
      ) {
        showNotice(update.notice);
      }
    }

    socket.on("group:nickname:updated", handleGroupNicknameUpdated);
    return () => socket.off("group:nickname:updated", handleGroupNicknameUpdated);
  }, [socket, applyGroupNickname, showNotice]);

  useEffect(() => {
    if (!socket) return;

    function handleGroupBackgroundNotice(update) {
      if (!update?.groupId || !sameId(activeIdRef.current, update.groupId)) return;

      const notice = groupBackgroundNotice(update);
      if (notice) showNotice(notice);
    }

    socket.on("group:background:updated", handleGroupBackgroundNotice);
    return () => socket.off("group:background:updated", handleGroupBackgroundNotice);
  }, [socket, showNotice]);

  // =========================
  // 14. MESSAGE REQUESTS
  // =========================
const loadMessageRequests = useCallback(async () => {
  if (!user) return;

  setLoadingRequests(true);

  try {
    const response = await api.getMessageRequests();
    setMessageRequests(response?.requests || []);
  } catch (err) {
    console.error("Could not load message requests:", err);
  } finally {
    setLoadingRequests(false);
  }
}, [user]);

// Keep the latest chats available for notification taps.
useEffect(() => {
  chatsRef.current = chats;
}, [chats]);

// Load when the user logs in.
useEffect(() => {
  if (!user) {
    setMessageRequests([]);
    return;
  }

  loadMessageRequests();
}, [user, loadMessageRequests]);

// Refresh when the modal opens.
useEffect(() => {
  if (!user || !showMessageRequests) return;

  loadMessageRequests();
}, [user, showMessageRequests, loadMessageRequests]);

useEffect(() => {
  const userId = user?.id ?? user?._id ?? user?.userId;

  if (!userId) {
    pushRegistrationUserRef.current = null;
    return;
  }

  const normalizedUserId = String(userId);

  // Prevent duplicate registration for the same account.
  if (pushRegistrationUserRef.current === normalizedUserId) {
    return;
  }

  pushRegistrationUserRef.current = normalizedUserId;

  let cancelled = false;

  const register = async () => {
    try {
      await registerPushNotifications(normalizedUserId);

      if (!cancelled) {
        console.log("Push notifications registered for user.");
      }
    } catch (error) {
      if (!cancelled) {
        console.error(
          "Push notification registration failed:",
          error
        );

        // Allow another attempt if registration fails.
        if (
          pushRegistrationUserRef.current === normalizedUserId
        ) {
          pushRegistrationUserRef.current = null;
        }
      }
    }
  };

  register();

  return () => {
    cancelled = true;
  };
}, [user?.id, user?._id, user?.userId]);


 useEffect(() => {
  
    const unlockAudio = async () => {
      const audio = new Audio("/sounds/incoming-ringtone.mp3");
      audio.volume = 0;

      try {
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        console.log("Audio unlocked successfully.");
      } catch (error) {
        console.warn("Audio unlock failed:", error);
      }
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
    };
  }, []);
  // Refresh requests when a new private message arrives.
  useEffect(() => {
    if (!socket) return;

    function handleNewMessage() {
      loadMessageRequests();
    }

    socket.on("message:new", handleNewMessage);

    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [socket, loadMessageRequests]);

  useEffect(() => {
  if (!socket || !activeCall || !authenticatedUserId) return;

  const otherUserId = String(activeCall.recipientId ?? "");
  if (!otherUserId) return;

  function handleCallChatMessage(message) {
    if (!message) return;

    const senderId = String(
      message.senderId?._id ??
      message.senderId ??
      message.sender?._id ??
      message.sender?.id ??
      ""
    );

    if (senderId !== otherUserId) return;

    notifyCallMessage(otherUserId, message);
  }

  socket.on("message:new", handleCallChatMessage);

  return () => {
    socket.off("message:new", handleCallChatMessage);
  };
}, [socket, activeCall?.recipientId, authenticatedUserId]);

// ==========================================
// GROUP CALL SOCKET EVENTS
// ==========================================

useEffect(() => {
  if (!socket) return;

  // 1. Receive an incoming group call invitation
  const handleIncomingGroupCall = (call) => {
    console.log("Incoming group call:", call);

    if (!call?.callId || !call?.groupId) return;
    setOngoingGroupCall({ ...call, status: "active" });
    setIncomingGroupCall(call);
    setGroupCallStatus("Incoming group call");
    setChats((previous) => updateGroupCallHistory(previous, call));

    if (sameId(activeIdRef.current, call.groupId)) {
      const chat = chatsRef.current.find((item) => item.isGroup && sameId(item.id, call.groupId));
      showNotice(groupCallStartNotice(call, chat?.members));
    }
  };

  // 2. Invitation accepted
  const handleGroupInvitationAccepted = (data) => {
    console.log("Group invitation accepted:", data);

    // We can update the participant list or invitation
    // status in a later step.
  };

  // 3. Invitation declined
  const handleGroupInvitationDeclined = (data) => {
    console.log("Group invitation declined:", data);

    // We can display this in the host's participant list later.
  };

  // 4. Invitation expired
  const handleGroupInvitationMissed = (data) => {
    console.log("Group invitation missed:", data);

    setIncomingGroupCall((current) => {
      if (current?.callId === data.callId) {
        return null;
      }

      return current;
    });

    setGroupCallStatus("");
  };

  // 5. A participant leaves
  const handleGroupParticipantLeft = (data) => {
    console.log("Group participant left:", data);
  };

  // 6. Host ends the group call
 const handleGroupCallEnded = (data) => {
   console.log("Group call ended:", data);
   if (!data?.callId || !data?.groupId) return;

   setChats((previous) => updateGroupCallHistory(previous, data, true));
   setOngoingGroupCall((current) =>
     String(current?.callId ?? "") === String(data.callId) ? null : current
   );
   setIncomingGroupCall((current) =>
     String(current?.callId ?? "") === String(data.callId) ? null : current
   );

   if (String(activeGroupCall?.callId ?? "") === String(data.callId)) {
     Promise.resolve()
       .then(() => leaveGroupCall())
       .catch((error) => console.error("LiveKit cleanup failed:", error));
     setActiveGroupCall(null);
   }
   setGroupCallStatus("");
   showNotice("The group call has ended.");
 };
  // Register listeners
  socket.on("group-call:incoming", handleIncomingGroupCall);

  socket.on(
    "group-call:invitation:accepted",
    handleGroupInvitationAccepted
  );

  socket.on(
    "group-call:invitation:declined",
    handleGroupInvitationDeclined
  );

  socket.on(
    "group-call:invitation:missed",
    handleGroupInvitationMissed
  );

  socket.on(
    "group-call:participant-left",
    handleGroupParticipantLeft
  );

  socket.on("group-call:ended", handleGroupCallEnded);

  // Remove listeners when the effect is cleaned up
  return () => {
    socket.off("group-call:incoming", handleIncomingGroupCall);

    socket.off(
      "group-call:invitation:accepted",
      handleGroupInvitationAccepted
    );

    socket.off(
      "group-call:invitation:declined",
      handleGroupInvitationDeclined
    );

    socket.off(
      "group-call:invitation:missed",
      handleGroupInvitationMissed
    );

    socket.off(
      "group-call:participant-left",
      handleGroupParticipantLeft
    );

    socket.off("group-call:ended", handleGroupCallEnded);
  };
}, [
  socket,
  activeGroupCall,
  leaveGroupCall,
  showNotice,
]);

  function handleAcceptedRequest(userId) {
    const requestedUser = chats.find((chat) =>
      sameId(chat.id, userId)
    );

    if (requestedUser) {
      selectChat({
        ...requestedUser,
        conversationStatus: "accepted",
      });
    }

    loadMessageRequests();
  }
function notifyCallMessage(chatId, message) {
  if (!chatId || !message) return;

  const key = String(chatId);

  setCallMessageNotifications((previous) => {
    const current = previous[key];

    return {
      ...previous,
      [key]: {
        unreadCount: (current?.unreadCount || 0) + 1,
        latestMessage: {
          id: String(message.id || message._id),
          senderName:
            message.senderName ||
            message.sender?.username ||
            "New message",
          text:
            message.text ||
            message.content ||
            "Sent a message",
        },
      },
    };
  });
}

function clearCallMessageNotifications(chatId) {
  if (!chatId) return;

  setCallMessageNotifications((previous) => ({
    ...previous,
    [String(chatId)]: {
      unreadCount: 0,
      latestMessage: null,
    },
  }));
}
  // =========================
  // 15. MESSAGE ACTIONS HOOK
  // =========================

  const {
    sendMessage,
    handleReply,
    handleDeleteMessage,
    startEditing,
    cancelEditing,
    saveEditedMessage,
    removeImage,
  } = useMessageActions({
    activeChat,
    draft,
    setDraft,
    replyTo,
    setReplyTo,
    inputRef,
    socketRef,
    showNotice,
    setError,
    setMentionSuccessToast,
    editDraft,
    setEditDraft,
    setEditingMessageId,
    setSavingEdit,
    savingEdit,
  });

  // =========================
  // 16. CHAT MESSAGES HOOK
  // =========================

  useChatMessages({
    socket,
    user,
    activeIdRef,
    setChats,
    setOnlineIds,
  });

  // =========================
  // 17. CHAT SOCKET HOOK
  // =========================

  useChatSocket({
    socket,
    setSocketStatus,
    setError,
    setMentionToast,
  });

  // =========================
  // 18. END CALL HANDLER
  // =========================

const handleEndCall = useCallback(() => {
  const currentCall = activeCall || incomingCall;
 
  if (!currentCall) return;

  if (
    socketRef.current?.connected &&
    currentCall.recipientId &&
    currentCall.callId
  ) {
    socketRef.current.emit("call:end", {
      recipientId: currentCall.recipientId,
      callId: currentCall.callId,
    });
  }

  cleanupCall();

  setActiveCall(null);
  setIncomingCall(null);
  setCallId(null);
  setCallStatus("");
  setIsMuted(false);
  setIsCameraOff(false);

  console.log("Private call ended and cleaned up.");
}, [activeCall, incomingCall, cleanupCall]);

  // =========================
  // 19. CALL SOCKET EVENTS
  // =========================

  useEffect(() => {
    if (!socket) return;

function handleIncomingCall(call) {
  console.log("📞 INCOMING CALL RECEIVED:", call);

  console.log("Current activeCall:", activeCall);
  console.log("Current incomingCall:", incomingCall);

  if (activeCall || incomingCall || activeGroupCall || groupCallStatus) {
    console.warn("⚠️ Automatically declining because user is busy.");

    socket.emit("call:respond", {
      callerId: call.callerId,
      callId: call.callId,
      accepted: false,
    });

    return;
  }

  const caller = chats.find((chat) =>
    sameId(chat.id, call.callerId)
  );

  console.log("✅ Showing incoming call screen.");

  setIncomingCall({
    ...call,
    displayName:
      caller?.name ||
      caller?.username ||
      "Chatterbox user",
  });
}
    // Caller receives the response.
    async function handleCallResponse(response) {
      if (
        !activeCall ||
        response.callId !== activeCall.callId
      ) {
        return;
      }

      if (!response.accepted) {
        cleanupCall();

        setActiveCall(null);
        setCallStatus("");
        setIsMuted(false);
        setIsCameraOff(false);

        showNotice("The user declined your call.");
        return;
      }

      try {
        await handleRemoteAnswer(response.answer);

        setActiveCall((previous) =>
          previous
            ? { ...previous, status: "Connected" }
            : null
        );

        setCallStatus("Connected");
      } catch (err) {
        console.error("Could not establish call:", err);
        handleEndCall();
      }
    }

    // Receive ICE candidates.
    async function handleIncomingCandidate(data) {
      const currentCallId =
        activeCall?.callId || incomingCall?.callId;

      if (data.callId !== currentCallId) return;

      try {
        await handleRemoteCandidate(data.candidate);
      } catch (err) {
        console.error(
          "Could not process ICE candidate:",
          err
        );
      }
    }

    // Call ended.
function handleCallEnded(data) {
  if (!data?.callId) return;

  const currentCallId =
    activeCall?.callId || incomingCall?.callId;

  if (data.callId !== currentCallId) return;

  cleanupCall();

  setActiveCall(null);
  setIncomingCall(null);
  setCallStatus("");
  setIsMuted(false);
  setIsCameraOff(false);

  showNotice("The call has ended.");
}

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:response", handleCallResponse);
    socket.on("call:ice-candidate", handleIncomingCandidate);
    socket.on("call:ended", handleCallEnded);

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:response", handleCallResponse);
      socket.off("call:ice-candidate", handleIncomingCandidate);
      socket.off("call:ended", handleCallEnded);
    };
  }, [
    socket,
    activeCall,
    incomingCall,
    activeGroupCall,
    chats,
    handleRemoteAnswer,
    handleRemoteCandidate,
    cleanupCall,
    handleEndCall,
    showNotice,
  ]);

  // =========================
  // 20. START CALL
  // =========================
const handleStartCall = async (chat, callType) => {
  if (
    !socketRef.current || 
    !chat || 
    activeCall || 
    incomingCall ||
    activeGroupCall || 
    groupCallStatus
  ) {
    return;
  }

  if (chat.isGroup) {
    showNotice("Calls are only available for private conversations.");
    return;
  }

  try {
    setCallStatus("Calling...");

    const offer = await createOffer(chat.id, callType);

    socketRef.current.emit(
      "call:start",
      {
        recipientId: chat.id,
        callType,
        offer,
      },
      (response) => {
        if (!response?.ok) {
          cleanupCall();
          setCallStatus("");
          showNotice(response?.message || "Could not start call.");
          return;
        }

        setCallId(response.callId);

        setActiveCall({
          callId: response.callId,
          recipientId: chat.id,
          callType,
          displayName: chat.username || chat.name,
          status: "Calling...",
        });
      }
    );
  } catch (error) {
    console.error("Start call error:", error);
    cleanupCall();
    setCallStatus("");
    showNotice(error.message || "Could not start call.");
  }
};
 // ==========================================
 // GROUP CALL HELPER
 // ==========================================

const findGroupChat = (groupId) => {
  return chatsRef.current.find(
    (chat) =>
      chat.isGroup &&
      sameId(chat.id, groupId)
  );
};

// ==========================================
// GROUP CALL ACKNOWLEDGEMENT HELPER
// ==========================================

const emitGroupCallAck = (currentSocket, eventName, payload) => {
  return new Promise((resolve, reject) => {
    if (!currentSocket?.connected) {
      reject(new Error("Socket connection is unavailable."));
      return;
    }

    currentSocket.timeout(12000).emit(
      eventName,
      payload,
      (timeoutError, result) => {
        if (timeoutError) {
          reject(
            new Error(`${eventName} timed out. Please try again.`)
          );
          return;
        }

        resolve(result || {});
      }
    );
  });
};


// ==========================================
// 20A. JOIN AN EXISTING GROUP CALL
// ==========================================


const joinExistingGroupCall = async (
  chat,
  call,
  currentSocket,
  {
    endCallOnFailure = false,
    successMessage = "You joined the ongoing group call.",
  } = {}
) => {
  // STEP 1: Validate call information.
  if (!call?.callId) {
    throw new Error(
      "Active group call information is missing."
    );
  }

  if (!currentSocket?.connected) {
    throw new Error(
      "Connection unavailable. Please try again."
    );
  }

  if (call.invitationStatus === "not-invited") {
    throw new Error(
      "You are not allowed to join this group call."
    );
  }

  // Normalize MongoDB group IDs.
  const groupId = String(
    call.groupId?._id ??
    call.groupId?.id ??
    call.groupId ??
    chat?._id ??
    chat?.id ??
    ""
  );

  if (!groupId) {
    throw new Error("Group ID is missing.");
  }

  const callId = String(call.callId);

  const currentUserId = String(
    user?.id ?? user?._id ?? user?.userId ?? ""
  );

  const hostId = String(
    call.hostId?._id ??
    call.hostId?.id ??
    call.hostId ??
    ""
  );

  const isHost =
    call.invitationStatus === "host" ||
    Boolean(
      currentUserId &&
      hostId &&
      currentUserId === hostId
    );

  let serverJoined = false;

  try {
    // STEP 2: Authorize joining through backend.
    setGroupCallStatus("Joining group call...");

    const joinResponse = await emitGroupCallAck(
      currentSocket,
      "group-call:join",
      {
        groupId,
        callId,
      }
    );

    if (!joinResponse?.ok) {
      throw new Error(
        joinResponse?.message ||
        "Could not join the group call."
      );
    }

    serverJoined = true;

    const serverCall = joinResponse.call || call;

    // STEP 3: Join Socket.IO call events.
    const socketJoinResponse = await emitGroupCallAck(
      currentSocket,
      "group-call:socket-join",
      {
        groupId,
        callId,
      }
    );

    if (!socketJoinResponse?.ok) {
      throw new Error(
        socketJoinResponse?.message ||
        "Could not connect to group call events."
      );
    }

    if (!currentSocket.connected) {
      throw new Error(
        "Socket disconnected while joining the call."
      );
    }

    // STEP 4: Connect to LiveKit ONCE.
    setGroupCallStatus("Connecting...");

    const livekitResult = await joinGroupCall(
      {
        ...chat,
        id: groupId,
      },
      callId
    );

    if (!livekitResult) {
      throw new Error(
        "Group call connection was cancelled. Please try again."
      );
    }

    // STEP 5: Save the connected call.
    const connectedCall = {
      ...serverCall,
      callId,
      groupId,
      groupName:
        serverCall.groupName ||
        chat?.name ||
        "Group call",
      callType:
        serverCall.callType ||
        call.callType ||
        "video",
      isHost:
        isHost ||
        String(
          serverCall.hostId?._id ??
          serverCall.hostId?.id ??
          serverCall.hostId ??
          ""
        ) === currentUserId,
    };

    setActiveGroupCall(connectedCall);

    // STEP 6: Dismiss matching invitation.
    setIncomingGroupCall((current) =>
      String(current?.callId ?? "") === callId
        ? null
        : current
    );

    setGroupCallStatus("Connected");

    showNotice(successMessage);

    console.log("GROUP CALL JOIN SUCCESS:", {
      groupId,
      callId,
      callType: connectedCall.callType,
    });

    return true;

  } catch (error) {
    console.error("GROUP CALL JOIN ERROR:", {
      groupId,
      callId,
      isHost,
      serverJoined,
      message: error?.message,
      stack: error?.stack,
    });

    // STEP 7: Clean up backend participation.
    try {
      if (currentSocket?.connected) {
        if (endCallOnFailure) {
          await emitGroupCallAck(
            currentSocket,
            "group-call:end",
            {
              groupId,
              callId,
            }
          );
        } else if (serverJoined && !isHost) {
          await emitGroupCallAck(
            currentSocket,
            "group-call:leave",
            {
              groupId,
              callId,
            }
          );
        }
      } else {
        console.warn(
          "GROUP CALL SERVER CLEANUP SKIPPED:",
          {
            groupId,
            callId,
            reason: "Socket.IO disconnected",
          }
        );
      }
    } catch (cleanupError) {
      console.error(
        "GROUP CALL SERVER CLEANUP ERROR:",
        cleanupError
      );
    }

    // STEP 8: Clean up the local LiveKit room.
    try {
      await leaveGroupCall();
    } catch (cleanupError) {
      console.error(
        "LIVEKIT CLEANUP ERROR:",
        cleanupError
      );
    }

    // STEP 9: Reset React call state.
    setActiveGroupCall(null);
    setGroupCallStatus("");

    throw error;
  }
};


// ==========================================
// 20B. START OR JOIN GROUP CALL
// ==========================================

const handleStartGroupCall = async (
  chat,
  callType = "video"
) => {
  if (!chat?.isGroup) {
    showNotice("Please select a group first.");
    return;
  }

  if (activeCall || incomingCall || activeGroupCall) {
    showNotice("Please finish your current call first.");
    return;
  }

  if (
    [
      "Checking group call...",
      "Starting group call...",
      "Connecting...",
      "Accepting invitation...",
    ].includes(groupCallStatus)
  ) {
    return;
  }

  if (!["audio", "video"].includes(callType)) {
    showNotice("Invalid group call type.");
    return;
  }

  const currentSocket = socketRef.current;

  if (!currentSocket?.connected) {
    showNotice("Connection unavailable. Please try again.");
    return;
  }

  try {
    setGroupCallStatus("Checking group call...");

    // STEP 1: Check if this group already has an active call.
    const activeResponse = await emitGroupCallAck(
      currentSocket,
      "group-call:get-active",
      {
        groupId: chat.id,
      }
    );

    if (!activeResponse.ok) {
      throw new Error(
        activeResponse.message ||
          "Could not check active group calls."
      );
    }

    // STEP 2: Join an existing call instead of creating another.
    if (activeResponse.call) {
      await joinExistingGroupCall(
        chat,
        {
          ...activeResponse.call,
          invitationStatus: activeResponse.invitationStatus,
        },
        currentSocket
      );

      return;
    }

    // STEP 3: No active call exists. Start a new one.
    setGroupCallStatus("Starting group call...");

    const startResponse = await emitGroupCallAck(
      currentSocket,
      "group-call:start",
      {
        groupId: chat.id,
        callType,
      }
    );

    // Another member may have started a call between
    // our active-call check and this request.
    if (!startResponse.ok && startResponse.call) {
      await joinExistingGroupCall(
        chat,
        startResponse.call,
        currentSocket
      );

      return;
    }

    if (!startResponse.ok) {
      throw new Error(
        startResponse.message ||
          "Could not start the group call."
      );
    }

    const newCall = startResponse.call;

    if (!newCall?.callId) {
      throw new Error(
        "The server did not return a valid call ID."
      );
    }

    setOngoingGroupCall({ ...newCall, groupId: chat.id, status: "active" });
    setChats((previous) =>
      updateGroupCallHistory(previous, { ...newCall, groupId: chat.id })
    );

    if (sameId(activeIdRef.current, chat.id)) {
      showNotice(groupCallStartNotice({
        ...newCall,
        callType: newCall.callType ?? callType,
        hostId: newCall.hostId ?? authenticatedUserId,
        hostName: user?.username,
      }, chat.members));
    }

    // STEP 4: Join the newly created call as its host.
    await joinExistingGroupCall(
      chat,
      {
        ...newCall,
        invitationStatus: "host",
      },
      currentSocket,
      {
        endCallOnFailure: true,
        successMessage: "You started the group call.",
      }
    );

  } catch (error) {
    console.error("GROUP CALL START/JOIN ERROR:", {
      message: error?.message,
      stack: error?.stack,
    });

    // The join helper already cleans up failed LiveKit joins.
    // This also handles errors occurring before that helper.
    setActiveGroupCall(null);
    setGroupCallStatus("");

    showNotice(
      error?.message ||
        "Could not start or join the group call."
    );
  }
};


// ==========================================
// 20C. DECLINE GROUP CALL
// ==========================================

const handleDeclineGroupCall = (
  callOverride = null
) => {
  const call = callOverride || incomingGroupCall;
  const currentSocket = socketRef.current;

  if (!call?.callId || !call?.groupId) {
    return false;
  }

  if (!currentSocket?.connected) {
    showNotice("Connection unavailable. Please try again.");
    return false;
  }

  emitGroupCallAck(
    currentSocket,
    "group-call:decline",
    {
      groupId: call.groupId,
      callId: call.callId,
    }
  )
    .then((result) => {
      if (!result.ok) {
        showNotice(
          result.message ||
            "Could not decline the invitation."
        );
        return;
      }

      setIncomingGroupCall((current) =>
        current?.callId === call.callId ? null : current
      );

      showNotice("Group call invitation declined.");
    })
    .catch((error) => {
      console.error("GROUP CALL DECLINE ERROR:", error);

      showNotice(
        error?.message ||
          "Could not decline the invitation."
      );
    });

  return true;
};


// ==========================================
// 20D. LEAVE OR END GROUP CALL
// ==========================================
const handleEndGroupCall = async () => {
  if (!activeGroupCall) return;

  const call = activeGroupCall;
  const currentSocket = socketRef.current;

  try {
    if (currentSocket?.connected) {
      const eventName = call.isHost
        ? "group-call:end"
        : "group-call:leave";

      const response = await emitGroupCallAck(
        currentSocket,
        eventName,
        {
          groupId: call.groupId,
          callId: call.callId,
        }
      );

      if (!response.ok) {
        console.warn(
          "GROUP CALL EXIT RESPONSE:",
          response.message
        );
      }
    }
  } catch (error) {
    console.error("GROUP CALL EXIT ERROR:", error);
  } finally {
    try {
      await leaveGroupCall();
    } catch (error) {
      console.error("LIVEKIT LEAVE ERROR:", error);
    }

    setActiveGroupCall(null);
    setGroupCallStatus("");

    showNotice(
      call.isHost
        ? "You ended the group call."
        : "You left the group call."
    );
  }
};

// =========================
// 21. ACCEPT INCOMING CALL
// =========================

async function handleAcceptIncoming(callOverride = null) {
  const call = callOverride || incomingCall;
  const currentSocket = socketRef.current;
  if(activeGroupCall){
    showNotice("Leave the group call before answering a private call.");
    handleDeclineIncoming(call);
    return false;
  }
  console.log("ACCEPT CALL DEBUG:", {
    callId: call?.callId,
    callerId: call?.callerId,
    callType: call?.callType,
    hasOffer: Boolean(call?.offer),
    offerType: call?.offer?.type,
    hasSdp: Boolean(call?.offer?.sdp),
    socketConnected: Boolean(currentSocket?.connected),
  });

  if (!call || !currentSocket?.connected) return false;

  if (!call.offer?.sdp || call.offer.type !== "offer") {
    console.error("Missing or invalid incoming WebRTC offer:", call);
    setCallStatus("");
    showNotice("Incoming call offer is missing. Please try again.");
    return false;
  }

  try {
    setCallStatus("Connecting...");

    const answer = await createAnswer(
      call.callerId,
      call.callId,
      call.callType,
      call.offer
    );

    const response = await new Promise((resolve) => {
      currentSocket.emit(
        "call:respond",
        {
          callerId: call.callerId,
          callId: call.callId,
          accepted: true,
          answer,
        },
        resolve
      );
    });

    if (!response?.ok) {
      cleanupCall();
      setIncomingCall(null);
      setActiveCall(null);
      setCallStatus("");
      showNotice(response?.message || "Could not accept the call.");
      return false;
    }

    setActiveCall({
      callId: call.callId,
      recipientId: call.callerId,
      callType: call.callType,
      displayName: call.displayName || "Chatterbox user",
      status: "Connected",
    });

    setIncomingCall(null);
    setCallStatus("Connected");

    return true;
  } catch (err) {
    console.error("Could not accept call:", err);

    cleanupCall();
    setIncomingCall(null);
    setActiveCall(null);
    setCallStatus("");

    showNotice(err.message || "Could not accept the call.");
    return false;
  }
}

// =========================
// 22. DECLINE INCOMING CALL
// =========================

function handleDeclineIncoming(callOverride = null) {
  const call = callOverride || incomingCall;
  const currentSocket = socketRef.current;

  if (!call || !currentSocket) return false;

  currentSocket.emit("call:respond", {
    callerId: call.callerId,
    callId: call.callId,
    accepted: false,
  });

  cleanupCall();

  setIncomingCall(null);
  setActiveCall(null);
  setCallStatus("");
  setIsMuted(false);
  setIsCameraOff(false);

  return true;
}


// ==========================================
// 20E. ACCEPT INCOMING GROUP CALL
// ==========================================

const handleAcceptGroupCall = async (callOverride = null) => {
  const call = callOverride || incomingGroupCall;
  const currentSocket = socketRef.current;

  if (!call?.callId) {
    showNotice("Group call information is missing.");
    return false;
  }

  if (!currentSocket?.connected) {
    showNotice("Connection unavailable. Please try again.");
    return false;
  }

  // Prevent answering two calls at the same time.
  if (activeCall || incomingCall || activeGroupCall) {
    showNotice("Please finish your current call first.");
    return false;
  }

  // Find the group associated with this invitation.
  const groupId = call.groupId || call.group?.id;

  const chat = chatsRef.current.find(
    (item) =>
      item.isGroup &&
      String(item.id) === String(groupId)
  );

  if (!chat) {
    showNotice("Could not find the group for this invitation.");
    return false;
  }

  try {
    setGroupCallStatus("Accepting invitation...");

    // STEP 1: Accept the invitation through the backend.
    const acceptResponse = await new Promise((resolve, reject) => {
      currentSocket.emit(
        "group-call:accept",
        {
          groupId,
          callId: call.callId,
        },
        (result) => {
          if (!result?.ok) {
            reject(
              new Error(
                result?.message || "Could not accept the group call."
              )
            );
            return;
          }

          resolve(result);
        }
      );
    });

    // STEP 2: Join the Socket.IO room and LiveKit meeting.
    await joinExistingGroupCall(
      chat,
      {
        ...(acceptResponse.call || call),
        callId: call.callId,
        groupId,
        invitationStatus: "accepted",
      },
      currentSocket
    );

    // STEP 3: Remove the incoming invitation popup.
    setIncomingGroupCall((current) =>
      current?.callId === call.callId ? null : current
    );

    setGroupCallStatus("Connected");

    showNotice("You accepted and joined the group call.");

    return true;

  } catch (error) {
    console.error("Accept group call error:", error);

    await leaveGroupCall();

    setActiveGroupCall(null);
    setGroupCallStatus("");

    showNotice(
      error.message || "Could not join the group call."
    );

    return false;
  }
};


  // =========================
  // 23. MUTE AND CAMERA
  // =========================

  function handleToggleMute() {
    if (!localStream) return;

    const nextMuted = !isMuted;

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsMuted(nextMuted);
  }

  function handleToggleCamera() {
    if (!localStream) return;

    const nextCameraOff = !isCameraOff;

    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff;
    });

    setIsCameraOff(nextCameraOff);
  }


// =========================
// 24. BACKGROUND PICKER
// =========================

function openBackgroundPicker(chat) {
  if (!chat) return;

  setBackgroundPickerOpen(true);
}

async function handleBackgroundChange(background) {
  if (!activeChat) return;

  const chatId = activeChat.id;
  setError("");

  try {
    if (activeChat.isGroup) {
      const update = await api.updateGroupBackground(chatId, background);
      if (!socket?.connected && sameId(activeIdRef.current, chatId)) {
        showNotice(groupBackgroundNotice(update) || "Chat background updated.");
      }

      setChats((previous) =>
        previous.map((chat) =>
          chat.isGroup && sameId(chat.id, chatId)
            ? { ...chat, background }
            : chat
        )
      );

      setGroups((previous) =>
        previous.map((group) =>
          sameId(group.id, chatId) ? { ...group, background } : group
        )
      );
    } else {
      const update = await api.updateConversationBackground(chatId, background);
      setChats((previous) => previous.map((chat) => {
        if (chat.isGroup || !sameId(chat.id, chatId)) return chat;
        const messages = chat.messages || [];
        const notice = update.noticeMessage;
        return {
          ...chat,
          background: update.background,
          messages: notice && !messages.some((message) => sameId(message.id, notice.id))
            ? [...messages, notice]
            : messages,
        };
      }));
    }

    setBackgroundPickerOpen(false);
    if (!activeChat.isGroup) showNotice("Chat background updated.");
  } catch (error) {
    console.error("Could not save chat background:", error);
    setError(error.message || "Could not save the chat background.");
  }
  
}

useEffect(() => {
  if (!activeChat?.isGroup) {
    setOngoingGroupCall(null);
    return;
  }

  const groupId = activeChat.id;
  const currentSocket = socketRef.current;

  if (!currentSocket) return;

  let cancelled = false;

  const checkOngoingCall = async () => {
    try {
      if (!currentSocket.connected) return;

      const response = await emitGroupCallAck(
        currentSocket,
        "group-call:get-active",
        { groupId }
      );

      if (cancelled) return;

      if (response.ok && response.call?.callId) {
        setOngoingGroupCall({
          ...response.call,
          groupId,
        });
      } else {
        setOngoingGroupCall(null);
      }
    } catch (error) {
      if (!cancelled) {
        console.error("Check ongoing group call:", error);
      }
    }
  };

  checkOngoingCall();

  currentSocket.on("connect", checkOngoingCall);

  return () => {
    cancelled = true;
    currentSocket.off("connect", checkOngoingCall);
  };
}, [activeChat?.id, activeChat?.isGroup, socket]);

useEffect(() => {
  if (!user) return;

  setShowActiveStatus(user.showActiveStatus ?? true);
}, [user]);
  // =========================
  // 25. ACTIVE STATUS
  // =========================

  async function handleActiveStatusChange(nextValue) {
    if (savingActiveStatus) return;

    setSavingActiveStatus(true);

    try {
      const data = await api.updateActiveStatus(nextValue);

      setShowActiveStatus(data.showActiveStatus);
    } catch (error) {
      console.error("Active Status update failed:", error);
      alert(error.message);
    } finally {
      setSavingActiveStatus(false);
    }
  }

  // =========================
  // 26. FILTERED CHATS
  // =========================

  const filteredChats = useMemo(() => {
    const term = search.trim().toLowerCase();

    const matchingChats = chats.filter((chat) => {
      const name = chat.name || chat.username || "";

      const matchesSearch =
        !term ||
        name.toLowerCase().includes(term) ||
        (chat.email || "").toLowerCase().includes(term);

      const matchesFilter =
        chatFilter === "all" ||
        (chatFilter === "unread" && (chat.unread || 0) > 0) ||
        (chatFilter === "groups" && chat.isGroup === true);

      return matchesSearch && matchesFilter;
    });
    return matchingChats
      .map((chat) => ({ chat, timestamp: messageTimestamp(latestChatMessage(chat)) }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(({ chat }) => chat);
  }, [chats, search, chatFilter]);

  // =========================
  // 27. ACTIVE CHAT REF
  // =========================

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // =========================
  // 28. LOAD USER THEME
  // =========================

  useEffect(() => {
    if (!user) return;

    const savedTheme =
      user.theme === "dark" ? "dark" : "light";

    setTheme(savedTheme);

    document.documentElement.setAttribute(
      "data-theme",
      savedTheme
    );
  }, [user]);

  // =========================
  // 29. UPDATE THEME
  // =========================

  async function handleThemeChange(nextTheme) {
    if (!["light", "dark"].includes(nextTheme)) return;
    if (savingTheme || nextTheme === theme) return;

    setSavingTheme(true);
    setError("");

    try {
      const result = await api.updateTheme(nextTheme);
      const savedTheme = result.theme || nextTheme;

      setTheme(savedTheme);

      setUser((previous) =>
        previous
          ? { ...previous, theme: savedTheme }
          : previous
      );

      document.documentElement.setAttribute(
        "data-theme",
        savedTheme
      );

      showNotice("Appearance updated.");
    } catch (err) {
      setError(
        err.message || "Could not update appearance."
      );
    } finally {
      setSavingTheme(false);
    }
  }

  // =========================
  // 30. ADD OR UPDATE CHAT
  // =========================

  const addOrUpdateChat = useCallback((person) => {
    setChats((previous) => {
      const existing = previous.find((chat) =>
        sameId(chat.id, person.id)
      );

      if (existing) {
        return previous.map((chat) =>
          sameId(chat.id, person.id)
            ? { ...chat, ...person }
            : chat
        );
      }

      return [
        { ...person, messages: [], unread: 0 },
        ...previous,
      ];
    });
  }, []);

  // =========================
  // 31. RESTORE LOGIN SESSION
  // =========================

  useEffect(() => {
    let cancelled = false;

api.me()
  .then(({ user: current }) => {
    console.log("SESSION RESTORE SUCCESS:", Boolean(current));

    if (!cancelled) {
      setUser(current);
    }
  })
  .catch((err) => {
    console.error("SESSION RESTORE FAILED:", err.message);

    if (!cancelled) {
      setUser(null);
    }
  })
  .finally(() => {
    if (!cancelled) {
      setCheckingSession(false);
    }
  });

    return () => {
      cancelled = true;
    };
  }, []);


// =========================
// 32. LOAD CHATS AND CONNECT SOCKET
// =========================
useEffect(() => {
  if (!authenticatedUserId) return;

  let mounted = true;

  console.log(
    "INITIALIZING SOCKET FOR USER:",
    authenticatedUserId
  );

  const chatSocket = connectSocket();

  socketRef.current = chatSocket;
  setSocket(chatSocket);

  function loadChatLists() {
    // Load private conversations.
    api.users("", { includeActivity: true })
      .then(({ users }) => {
        if (!mounted) return;

        setChats((previous) => {
          const existingPrivateChats = new Map(
            previous
              .filter((chat) => !chat.isGroup)
              .map((chat) => [String(chat.id), chat])
          );

          const returnedIds = new Set(users.map((person) => String(person.id)));
          const privateChats = users.map((person) => {
            const existing = existingPrivateChats.get(
              String(person.id)
            );

            return {
              ...person,
              messages: existing?.messages || [],
              unread: existing?.unread || 0,
            };
          });

          return [
            ...previous.filter((chat) => chat.isGroup),
            ...privateChats,
            ...previous.filter((chat) => !chat.isGroup &&
              !returnedIds.has(String(chat.id))),
          ];
        });
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message);
        }
      });

    // Load groups.
    api.groups()
      .then(({ groups: savedGroups }) => {
        if (!mounted) return;

        setGroups(savedGroups);

        setChats((previous) => {
          const groupChats = savedGroups.map((group) => {
            const existing = previous.find(
              (chat) =>
                chat.isGroup &&
                sameId(chat.id, group.id)
            );

            return {
              ...group,
              isGroup: true,
              messages: existing?.messages || [],
              unread: existing?.unread || 0,
            };
          });

          return [
            ...groupChats,
            ...previous.filter((chat) => !chat.isGroup),
          ];
        });
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message);
        }
      });
  }

  loadChatLists();
  chatSocket.io.on("reconnect", loadChatLists);

  return () => {
    mounted = false;

    console.log(
      "CLEANING UP SOCKET FOR USER:",
      authenticatedUserId
    );

    chatSocket.io.off("reconnect", loadChatLists);
    chatSocket.disconnect();

    if (socketRef.current === chatSocket) {
      socketRef.current = null;
    }

    setSocket((current) =>
      current === chatSocket ? null : current
    );
  };
}, [authenticatedUserId]);
  // =========================
  // 33. LOAD SELECTED CHAT HISTORY
  // =========================

  useEffect(() => {
    if (!user || !activeId) return;

    let cancelled = false;

    setLoadingMessages(true);
    setError("");

    const historyRequest = activeChat?.isGroup
      ? api.groupMessages(activeId)
      : api.messages(activeId);

    historyRequest
      .then(({ messages }) => {
        if (cancelled) return;

        setChats((previous) =>
          previous.map((chat) => {
            if (!sameId(chat.id, activeId)) return chat;
            const fetched = Array.isArray(messages) ? messages : [];
            if (!chat.isGroup) return { ...chat, messages: fetched, unread: 0 };

            const localCalls = (chat.messages || []).filter(
              (item) => item.type === "group_call"
            );
            const merged = [...fetched];
            for (const event of localCalls) {
              const index = merged.findIndex(
                (item) => String(item.callId ?? "") === String(event.callId)
              );
              if (index < 0) merged.push(event);
              else if (event.status === "ended") {
                merged[index] = { ...merged[index], ...event };
              }
            }
            merged.sort((a, b) =>
              new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
            );
            return { ...chat, messages: merged, unread: 0 };
          })
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, activeId, activeChat?.isGroup]);

  // =========================
  // 34. SCROLL TO LATEST MESSAGE
  // =========================

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [activeId, activeChat?.messages?.length]);

  // =========================
  // 35. SEARCH PEOPLE
  // =========================

  useEffect(() => {
    if (!showNewChat && !showCreateGroup) return;

    const timer = window.setTimeout(async () => {
      try {
        const { users } = await api.users(newSearch);

        setSearchResults(users);
      } catch (err) {
        setError(err.message);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showNewChat, showCreateGroup, newSearch]);

  // =========================
  // 36. SELECT CHAT
  // =========================

  function selectChat(person) {
    addOrUpdateChat({
      ...person,
      unread: 0,
    });

    setActiveId(person.id);
    activeIdRef.current = person.id;

    setMobileChatOpen(true);
    setShowNewChat(false);

    setNewSearch("");
    setSearchResults([]);

    setChats((previous) =>
      previous.map((chat) =>
        sameId(chat.id, person.id)
          ? { ...chat, unread: 0 }
          : chat
      )
    );
  }

// ==========================================
// HANDLE PUSH NOTIFICATION TAPS
// ==========================================

const handleNotificationTap = useCallback(
  (data) => {
    if (!data || !user) {
      pendingNotificationRef.current = data;
      return;
    }

    console.log("Handling notification:", data);

    // --------------------------------------
    // PRIVATE MESSAGE REQUEST
    // --------------------------------------

    if (data.type === "message_request") {
      pendingNotificationRef.current = null;

      setShowMessageRequests(true);

      return;
    }
// --------------------------------------
// ANDROID INCOMING CALL
// --------------------------------------

if (data.type === "group_call") {
  const currentSocket = socketRef.current;
  const chat = chatsRef.current.find(c => c.isGroup && sameId(c.id, data.groupId));
  if (!currentSocket?.connected || !chat) {
    pendingNotificationRef.current = data;
    return;
  }
  pendingNotificationRef.current = null;
  const key = `${data.callId}:${data.action}`;
  if (handledCallActionsRef.current.has(key) || recoveringCallIdsRef.current.has(data.callId)) return;
  recoveringCallIdsRef.current.add(data.callId);
  (async () => {
    try {
      const response = await emitGroupCallAck(currentSocket, "group-call:get-active", { groupId: data.groupId });
      if (!response.ok || !response.call || response.call.callId !== data.callId) throw new Error("This group call has ended.");
      selectChat(chat);
      if (String(data.action).includes("DECLINE") || data.action === "decline") {
        await emitGroupCallAck(currentSocket, "group-call:decline", { groupId: data.groupId, callId: data.callId });
      } else if (!activeGroupCall) {
        await joinExistingGroupCall(chat, response.call, currentSocket);
      }
      handledCallActionsRef.current.add(key);
    } catch (error) { showNotice(error.message); }
    finally {
      recoveringCallIdsRef.current.delete(data.callId);
      await clearPendingIncomingCallAction();
    }
  })();
  return;
}
if (data.type === "incoming_call") {
  const callId = data.callId;

  const nativeAction = data.action || data.callAction;

  let action = "";

  if (
    nativeAction === "com.hazeljane.chatterbox.ANSWER_CALL" ||
    nativeAction === "answer"
  ) {
    action = "answer";
  } else if (
    nativeAction === "com.hazeljane.chatterbox.DECLINE_CALL" ||
    nativeAction === "decline"
  ) {
    action = "decline";
  } else if (
    nativeAction === "com.hazeljane.chatterbox.OPEN_INCOMING_CALL" ||
    nativeAction === "open"
  ) {
    action = "open";
  }

  if (!callId || !action) {
    console.warn("Invalid incoming-call notification action.");
    return;
  }

  const currentSocket = socketRef.current;

  // Wait until the authenticated socket is connected.
  if (!currentSocket?.connected) {
    pendingNotificationRef.current = data;
    return;
  }

  const actionKey = `${callId}:${action}`;

  // Ignore actions already handled.
  if (handledCallActionsRef.current.has(actionKey)) {
    pendingNotificationRef.current = null;
    clearPendingIncomingCallAction().catch(console.error);
    return;
  }

  // Avoid duplicate recovery requests.
  if (recoveringCallIdsRef.current.has(callId)) {
    return;
  }

  recoveringCallIdsRef.current.add(callId);

  currentSocket.emit(
    "call:recover",
    { callId },
    async (response) => {
      try {
        if (!response?.ok || !response.call) {
          console.warn(
            "Incoming call recovery failed:",
            response?.message
          );

          pendingNotificationRef.current = null;

          showNotice(
            response?.message || "This call is no longer available."
          );

          await clearPendingIncomingCallAction();

          return;
        }

        const recoveredCall = response.call;

        const caller = chatsRef.current.find((chat) =>
          sameId(chat.id, recoveredCall.callerId)
        );

        const call = {
          ...recoveredCall,
          displayName:
            caller?.name ||
            caller?.username ||
            recoveredCall.callerName ||
            "Chatterbox user",
        };

        pendingNotificationRef.current = null;

        if (action === "answer") {
          // Answer immediately using the recovered call.
          const accepted = await handleAcceptIncoming(call);

          if (!accepted) {
            // Keep the call visible so the user can still
            // answer manually if automatic answering fails.
            setIncomingCall(call);
          }
        } else if (action === "decline") {
          handleDeclineIncoming(call);
        } else {
          // OPEN: show the normal incoming-call interface.
          setIncomingCall(call);
        }

        handledCallActionsRef.current.add(actionKey);

        await clearPendingIncomingCallAction();
      } catch (error) {
        console.error(
          "Android incoming-call handling failed:",
          error
        );
      } finally {
        recoveringCallIdsRef.current.delete(callId);
      }
    }
  );

  return;
}
    // --------------------------------------
    // GROUP MESSAGE
    // --------------------------------------

    if (data.type === "group_message") {
      const group = chatsRef.current.find(
        (chat) =>
          chat.isGroup &&
          sameId(chat.id, data.groupId)
      );

      if (!group) {
        pendingNotificationRef.current = data;
        console.log("Waiting for group chat to load.");
        return;
      }

      pendingNotificationRef.current = null;
      selectChat(group);

      return;
    }

    // --------------------------------------
    // PRIVATE MESSAGE
    // --------------------------------------

    if (data.type === "private_message") {
      const privateChat = chatsRef.current.find(
        (chat) =>
          !chat.isGroup &&
          sameId(chat.id, data.senderId)
      );

      if (!privateChat) {
        pendingNotificationRef.current = data;
        console.log("Waiting for private chat to load.");
        return;
      }

      pendingNotificationRef.current = null;
      selectChat(privateChat);

      return;
    }

    console.warn(
      "Unknown notification type:",
      data.type
    );
  },
  [user, loadMessageRequests, activeGroupCall]
);

// Register the handler with pushNotifications.js.
useEffect(() => {
  setNotificationTapHandler(handleNotificationTap);

  return () => {
    setNotificationTapHandler(null);
  };
}, [handleNotificationTap]);

// ==========================================
// ANDROID BUBBLE CHAT NAVIGATION
// ==========================================

useEffect(() => {
  const stopListening = listenForBubbleNavigation((data) => {
    if (!data) return;

    console.log("ANDROID BUBBLE OPENED:", data);

    const isGroup =
      data.type === "group_message" ||
      Boolean(data.groupId);

    if (isGroup) {
      if (!data.groupId) return;

      handleNotificationTap({
        type: "group_message",
        groupId: data.groupId,
      });

      return;
    }

    const senderId = data.senderId;

    if (!senderId) {
      console.warn("Bubble navigation missing senderId:", data);
      return;
    }

    handleNotificationTap({
      type: "private_message",
      senderId,
      conversationId: data.conversationId,
    });
  });

  return () => {
    if (typeof stopListening === "function") {
      stopListening();
    }
  };
}, [handleNotificationTap]);
useEffect(() => {
  const pending = pendingNotificationRef.current;

  if (!pending || !user) return;

  if (
    ["incoming_call", "group_call"].includes(pending.type) &&
    !socket?.connected
  ) {
    return;
  }

  handleNotificationTap(pending);
}, [chats, user, socket, socketStatus, handleNotificationTap]);


// Recover ongoing group state after reconnect, resume, or selecting a chat.
useEffect(() => {
  if (!activeChat?.isGroup || !socket?.connected) { setOngoingGroupCall(null); return; }
  let cancelled = false;
  const refresh = () => socket.timeout(10000).emit("group-call:get-active", { groupId: activeChat.id }, (err, response) => {
    if (!cancelled && !err && response?.ok) setOngoingGroupCall(response.call || null);
  });
  refresh();
  const visible = () => { if (document.visibilityState === "visible") refresh(); };
  document.addEventListener("visibilitychange",visible);
  const timer = setInterval(refresh,15000);
  return () => { cancelled=true; clearInterval(timer); document.removeEventListener("visibilitychange",visible); };
}, [activeChat?.id, activeChat?.isGroup, socket, socketStatus]);


// =========================
// 37. LOG OUT
// =========================


async function handleLogout() {
  // 1. Remove this device's FCM token before clearing the session.
  try {
    await unregisterPushNotifications();
  } catch (error) {
    console.error(
      "FCM token cleanup failed:",
      error.message
    );
  }

  // 2. Log out from the backend.
  try {
    await api.logout();
  } catch (error) {
    console.error("API logout failed:", error);
  }

  // 3. Reset push registration tracking.
  pushRegistrationUserRef.current = null;

  // 4. Disconnect Socket.IO.
  socketRef.current?.disconnect();
  socketRef.current = null;

  setSocket(null);

  // 5. Clear authenticated user and chat data.
  setUser(null);
  setChats([]);
  setGroups([]);
  setActiveId("");
  setOnlineIds(new Set());

  // 6. Clear notification data.
  pendingNotificationRef.current = null;
  setMessageRequests([]);
  setShowMessageRequests(false);

  // 7. Reset interface state.
  setMobileChatOpen(false);
  setMenuOpen(false);
  setShowCreateGroup(false);
  setSelectedMemberIds([]);
  setGroupName("");

  // 8. Reset call state.
  cleanupCall();
  leaveGroupCall();

  setActiveCall(null);
  setIncomingCall(null);
  setCallStatus("");
  setIsMuted(false);
  setIsCameraOff(false);
  
  setIncomingGroupCall(null);

  setActiveGroupCall(null);
  setGroupCallStatus("");
}



  // =========================
  // 38. CREATE GROUP
  // =========================

  async function handleCreateGroup(event) {
    event.preventDefault();

    const name = groupName.trim();

    if (name.length < 2 || name.length > 50) {
      setError(
        "Group name must be between 2 and 50 characters."
      );
      return;
    }

    if (selectedMemberIds.length === 0) {
      setError("Choose at least one person for your group.");
      return;
    }

    if (savingGroup) return;

    setSavingGroup(true);
    setError("");

    try {
      const { group } = await api.createGroup({
        name,
        memberIds: selectedMemberIds,
      });

      const newGroup = {
        ...group,
        isGroup: true,
        messages: [],
        unread: 0,
      };

      setGroups((previous) => [
        group,
        ...previous,
      ]);

      setChats((previous) => [
        newGroup,
        ...previous.filter(
          (chat) =>
            !(chat.isGroup && sameId(chat.id, group.id))
        ),
      ]);

      setActiveId(group.id);
      activeIdRef.current = group.id;

      setMobileChatOpen(true);
      setShowCreateGroup(false);

      setGroupName("");
      setSelectedMemberIds([]);
      setNewSearch("");
      setError("");

      showNotice("Group created successfully!");
    } catch (err) {
      setError(
        err.message || "Could not create the group."
      );
    } finally {
      setSavingGroup(false);
    }
  }

  // =========================
  // 39. DELETE GROUP
  // =========================

  async function handleDeleteGroup(group) {
    if (!group?.isGroup) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${group.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await api.deleteGroup(group.id);

      setChats((previous) =>
        previous.filter(
          (chat) => !sameId(chat.id, group.id)
        )
      );

      setGroups((previous) =>
        previous.filter(
          (item) => !sameId(item.id, group.id)
        )
      );

      if (sameId(activeId, group.id)) {
        setActiveId("");
        activeIdRef.current = "";
        setMobileChatOpen(false);
      }

      showNotice("Group deleted successfully.");
    } catch (err) {
      setError(
        err.message || "Could not delete the group."
      );
    }
  }

  // =========================
  // 40. LOADING SCREEN
  // =========================

  if (checkingSession) {
    return (
      <div className="full-loading">
        <LoaderCircle className="spin" size={28} />
        <span>Getting your chats ready...</span>
      </div>
    );
  }
function renderChatContent(content) {
  const callGroupId = activeGroupCall?.groupId;

  const isCallGroup =
    activeChat?.isGroup &&
    callGroupId &&
    sameId(activeChat.id, callGroupId);

  return callChatPanel && isCallGroup
    ? createPortal(content, callChatPanel)
    : content;
}

// =========================
// 41. CHAT BACKGROUND
// =========================

const displayedBackground = activeChat?.background ?? "default";

// =========================
// 42. AUTHENTICATION SCREEN
// =========================

if (!user) {
  return (
    <AuthScreen
      onAuthenticated={(authenticatedUser) => {
        setUser(authenticatedUser);
        setError("");
      }}
    />
  );
}
const currentUserId =
  user?.id ?? user?._id ?? user?.userId;

const typingUsers = (activeChat?.members || [])
  .filter((member) => {
    const memberId = member.id ?? member._id ?? member.userId;

    return (
      typingUserIds.some((id) => sameId(id, memberId)) &&
      !sameId(memberId, currentUserId)
    );
  });

const displayedTypingUsers = typingUsers.slice(0, 3);

const getTypingName = (member) =>
  member.nickname ||
  member.username ||
  member.name ||
  "Someone";

const getTypingAvatar = (member) =>
  member.avatar ||
  member.profilePicture ||
  member.profileImage ||
  member.photo ||
  "/default-avatar.png";

const typingMessage =
  typingUsers.length === 1
    ? `${getTypingName(typingUsers[0])} is typing...`
    : typingUsers.length === 2
      ? `${getTypingName(typingUsers[0])} and ${getTypingName(typingUsers[1])} are typing...`
      : typingUsers.length === 3
        ? `${getTypingName(typingUsers[0])}, ${getTypingName(typingUsers[1])} and ${getTypingName(typingUsers[2])} are typing...`
        : typingUsers.length > 3
          ? `${getTypingName(typingUsers[0])}, ${getTypingName(typingUsers[1])} and ${typingUsers.length - 2} others are typing...`
          : "";
  // =========================
  // 42. MAIN APPLICATION
  // =========================

  return (
    <main className="app-shell">

      {/* CHAT SIDEBAR */}
      <div
        className={
          mobileChatOpen ? "sidebar-hidden-mobile" : ""
        }
      >
        <ChatSidebar
          user={user}
          chats={chats}
          activeId={activeId}
          search={search}
          setSearch={setSearch}
          filteredChats={filteredChats}
          chatFilter={chatFilter}
          setChatFilter={setChatFilter}
          onlineIds={onlineIds}
          socketStatus={socketStatus}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          showNotice={showNotice}
          handleLogout={handleLogout}
          selectChat={selectChat}
          setShowNewChat={setShowNewChat}
          setShowCreateGroup={setShowCreateGroup}
          setError={setError}
          setSelectedMemberIds={setSelectedMemberIds}
          setGroupName={setGroupName}
          setNewSearch={setNewSearch}
          setShowSettings={setShowSettings}
        />
      </div>

      {/* CHAT PANEL */}
      <section
        className={`chat-panel ${
          mobileChatOpen ? "chat-panel-mobile-open" : ""
        } ${
          activeChat
            ? `chat-background-${displayedBackground}`
            : ""
        }`}
      >
        {activeChat ? (
          <>
            {/* CHAT HEADER */}



<ChatHeader
  activeChat={activeChat}
  onlineIds={onlineIds}
  setMobileChatOpen={setMobileChatOpen}
  showNotice={showNotice}
  handleDeleteGroup={handleDeleteGroup}
  onOpenBackgroundPicker={openBackgroundPicker}
  onStartCall={handleStartCall}
  onStartGroupCall={handleStartGroupCall}
  ongoingGroupCall={ongoingGroupCall}
  onJoinGroupCall={() => {
    if (!activeChat?.isGroup) return;

    handleStartGroupCall(
      activeChat,
      ongoingGroupCall?.callType || "video"
    );
  }}
  callStatus={callStatus}
  groupCallStatus={groupCallStatus}
  messageRequestCount={messageRequests.length}
  setShowMessageRequests={setShowMessageRequests}

  // NEW: Open Chat Information
  onOpenChatDetails={() => setShowChatDetails(true)}
/>


{showChatDetails && activeChat && (
  <ChatDetails
    key={`details:${activeChat.isGroup ? "group" : "private"}:${activeChat.id}`}
    chat={activeChat}
    onJumpToMessage={(id) => {
      setMessageJump({ id, chatId: activeChat.id });
      setShowChatDetails(false);
    }}
    currentUserId={user?.id ?? user?._id ?? user?.userId}
    onFindGroupMembers={async () => {
      const { users } = await api.users();
      return Array.isArray(users) ? users : [];
    }}
    onAddGroupMember={async (chat, memberId) => {
      const update = await api.addGroupMembers(chat.id ?? chat._id, [memberId]);
      applyGroupMembers(update);
    }}
    currentUser={user}
    onSavePrivateNickname={async (chat, nickname, memberId) => {
      const update = await api.updatePrivateNickname(chat.id ?? chat._id, nickname, memberId);
      applyPrivateNickname(update);
    }}
    onSaveGroupNickname={async (chat, nickname, memberId) => {
      const update = await api.updateGroupNickname(chat.id ?? chat._id, nickname, memberId);
      applyGroupNickname(update);
      if (!socket?.connected && update.notice) showNotice(update.notice);
    }}
    messages={activeChat.messages || []}
    online={
      !activeChat.isGroup &&
      Boolean(onlineIds?.has(String(activeChat.id)))
    }
    onClose={() => setShowChatDetails(false)}
onAction={async (action, payload) => {
  const selectedChat = payload?.chat || activeChat;

  if (!selectedChat) return;

  switch (action) {
    case "theme":
      setShowChatDetails(false);
      openBackgroundPicker(selectedChat);
      break;

    case "open-chat-head":
      showNotice(
        "Android chat head integration is not connected yet."
      );
      break;

    case "delete-conversation":
      showNotice(
        "Conversation deletion requires a backend endpoint."
      );
      break;

    case "block-contact":
      if (selectedChat.isGroup) return;

      showNotice(
        "Blocking requires a backend endpoint."
      );
      break;

    case "report-technical-problem":
      showNotice(
        "Technical problem reporting requires a backend endpoint."
      );
      break;

    default:
      console.log("Chat details action:", action, payload);
  }
}}
  />
)}


            {/* CHAT ERROR */}
            <ChatError
              error={error}
              onDismiss={() => setError("")}
            />

            {/* MESSAGES */}


<ConversationBody
  activeChat={conversationChat}
  messageJump={sameId(messageJump?.chatId, activeChat.id) ? messageJump : null}
  loadingMessages={loadingMessages}
  user={user}
  socketRef={socketRef}
  onReply={handleReply}
  deleteMessage={handleDeleteMessage}
  editingMessageId={editingMessageId}
  editDraft={editDraft}
  savingEdit={savingEdit}
  setEditDraft={setEditDraft}
  saveEditedMessage={saveEditedMessage}
  cancelEditing={cancelEditing}
  startEditing={startEditing}
  removeImage={removeImage}
  bottomRef={bottomRef}
  mentionSuccessToast={mentionSuccessToast}
  setMentionSuccessToast={setMentionSuccessToast}

  activeGroupCall={activeGroupCall}
  ongoingGroupCall={ongoingGroupCall}

  onJoinGroupCall={async ({ callId, groupId }) => {
    if (!callId || !groupId || !activeChat?.isGroup) {
      throw new Error("Group call information is missing.");
    }

    const currentSocket = socketRef.current;

    if (!currentSocket?.connected) {
      throw new Error("Socket connection unavailable.");
    }

    const response = await emitGroupCallAck(
      currentSocket,
      "group-call:get-active",
      { groupId }
    );

    if (
      !response?.ok ||
      !response.call ||
      String(response.call.callId) !== String(callId)
    ) {
      throw new Error("This group call has already ended.");
    }

    return joinExistingGroupCall(
      {
        ...activeChat,
        id: groupId,
      },
      {
        ...response.call,
        groupId,
      },
      currentSocket
    );
  }}
/>

            {/* REPLY PREVIEW */}
            <ReplyPreview
              replyTo={replyTo}
              onCancel={() => setReplyTo(null)}
            />

{typingUsers.length > 0 && (
  <div className="typing-indicator">
    <div className="typing-avatars">
      {displayedTypingUsers.map((member) => (
        <img
          key={String(member.id ?? member._id ?? member.userId)}
          src={getTypingAvatar(member)}
          alt={getTypingName(member)}
          className="typing-avatar"
          onError={(e) => {
            e.currentTarget.src = "/default-avatar.png";
          }}
        />
      ))}
    </div>

    <span className="typing-text">
      {typingMessage}
    </span>

    <div className="typing-dots">
      <span />
      <span />
      <span />
    </div>
  </div>
)}

<MessageComposer
  key={`composer:${activeChat.isGroup ? "group" : "private"}:${activeChat.id}`}
  draft={draft}
  setDraft={setDraft}
  onTypingChange={handleTypingChange}
  inputRef={inputRef}
  sendMessage={sendMessage}
  showNotice={showNotice}
  socketStatus={socketStatus}
  mentionUsers={
    activeChat.isGroup
      ? activeChat.members || []
      : []
  }
/>


          </>
        ) : (
          /* EMPTY CHAT SCREEN */
          <div className="empty-chat-panel">
            <div className="welcome-icon">
              <MessageCircle size={28} />
            </div>

            <h2>Your conversations, all in one place.</h2>

            <p>
              Select someone from your people list or start a new
              conversation.
            </p>

            <button
              className="create-chat-submit"
              onClick={() => setShowNewChat(true)}
            >
              <Plus size={18} />
              Find people
            </button>
          </div>
        )}
      </section>

      {/* FIND PEOPLE MODAL */}
      <FindPeopleModal
        open={showNewChat}
        setOpen={setShowNewChat}
        newSearch={newSearch}
        setNewSearch={setNewSearch}
        searchResults={searchResults}
        selectChat={selectChat}
      />

      {/* SETTINGS MODAL */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onThemeChange={handleThemeChange}
        savingTheme={savingTheme}
        showActiveStatus={showActiveStatus}
        onActiveStatusChange={handleActiveStatusChange}
        savingActiveStatus={savingActiveStatus}
      />

      {/* MESSAGE REQUESTS MODAL */}
      {showMessageRequests && (
        <MessageRequestsModal
          requests={messageRequests}
          loading={loadingRequests}
          onClose={() => setShowMessageRequests(false)}
          onRequestUpdated={loadMessageRequests}
          onAccepted={handleAcceptedRequest}
          showNotice={showNotice}
        />
      )}

      {/* CHAT BACKGROUND PICKER */}
<ChatBackgroundPicker
  isOpen={backgroundPickerOpen}
  onClose={() => setBackgroundPickerOpen(false)}
  currentBackground={displayedBackground}
  onSelect={handleBackgroundChange}
/>

      {/* CREATE GROUP MODAL */}
      <CreateGroupModal
        open={showCreateGroup}
        setOpen={setShowCreateGroup}
        groupName={groupName}
        setGroupName={setGroupName}
        newSearch={newSearch}
        setNewSearch={setNewSearch}
        searchResults={searchResults}
        user={user}
        selectedMemberIds={selectedMemberIds}
        setSelectedMemberIds={setSelectedMemberIds}
        savingGroup={savingGroup}
        handleCreateGroup={handleCreateGroup}
      />

{/* ==========================================
    PRIVATE CALL
========================================== */}

<CallModal
  call={incomingCall || activeCall}
  localStream={localStream}
  remoteStream={remoteStream}
  connectionState={connectionState}
  mediaError={mediaError}
  isIncoming={Boolean(incomingCall)}
  isOutgoing={Boolean(activeCall && callStatus === "Calling...")}
  isMuted={isMuted}
  isCameraOff={isCameraOff}
  onAccept={() => handleAcceptIncoming()}
  onDecline={handleDeclineIncoming}
  onEnd={handleEndCall}
  onToggleMute={handleToggleMute}
  onToggleCamera={handleToggleCamera}
  unreadCount={0}
  latestMessage={null}
  onOpenChat={() => {
    if (activeChat && !activeChat.isGroup) {
      selectChat(activeChat);
    }
  }}
/>

{/* ==========================================
    ACTIVE GROUP CALL
========================================== */}

{activeGroupCall && groupCallRoom && (
  <GroupCallModal
    call={activeGroupCall}
    room={groupCallRoom}
    participants={groupCallParticipants}
    connectionState={groupCallConnectionState}
    error={groupCallError}
    onClose={handleEndGroupCall}
    chatPanelRef={setCallChatPanel}
    unreadCount={0}
    latestMessage={null}
    onOpenChat={() => {
      const groupId = activeGroupCall.groupId;

      const group = groupId
        ? chatsRef.current.find(
            (chat) =>
              chat.isGroup && sameId(chat.id, groupId)
          )
        : null;

      if (!group) {
        showNotice("The group chat is still loading.");
        return false;
      }

      if (
        !activeChat?.isGroup ||
        !sameId(activeChat.id, groupId)
      ) {
        selectChat(group);
      }

      return true;
    }}
  />
)}

{/* ==========================================
    INCOMING GROUP CALL
========================================== */}

{incomingGroupCall && !activeGroupCall && (
  <IncomingGroupCall
    call={incomingGroupCall}
    onAccept={() =>
      handleAcceptGroupCall(incomingGroupCall)
    }
    onDecline={() =>
      handleDeclineGroupCall(incomingGroupCall)
    }
  />
)}
      {/* NOTIFICATION TOASTS */}
      <NotificationToasts
        toast={toast}
        mentionToast={mentionToast}
        onDismissMention={() => setMentionToast(null)}
        mentionSuccessToast={mentionSuccessToast}
        onDismissMentionSuccess={() =>
          setMentionSuccessToast("")
        }
      />

    </main>
  );
}
