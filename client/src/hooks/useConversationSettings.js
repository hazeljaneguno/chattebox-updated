import { useEffect } from "react";
import { api } from "../api.js";
import { sameId } from "../utils/chatHelpers.js";

function isGroupChat(chat) {
  return chat?.isGroup === true || chat?.type === "group";
}

export default function useConversationSettings({
  user,
  activeChat,
  setChats,
  socket,
}) {
  const userId = user?._id ?? user?.id ?? user?.userId;
  const chatId = activeChat?.id ?? activeChat?._id;
  const isGroup = isGroupChat(activeChat);
  const conversationStatus = activeChat?.conversationStatus;

  // Load the saved background when the chat opens or becomes accepted.
  useEffect(() => {
    if (!userId || !chatId) return;
    if (!isGroup && conversationStatus && conversationStatus !== "accepted") return;

    let cancelled = false;

    async function loadConversationSettings() {
      try {
        const settings = await api.getConversationSettings(chatId, {
          isGroup,
        });

        if (cancelled) return;

        const background = settings?.background ?? "default";

        setChats((previous) =>
          previous.map((chat) =>
            isGroupChat(chat) === isGroup &&
            sameId(chat.id ?? chat._id, chatId)
              ? { ...chat, background }
              : chat
          )
        );
      } catch (error) {
        if (!cancelled && error.status !== 403) {
          console.error("Could not load conversation settings:", error);
        }
      }
    }

    loadConversationSettings();

    return () => {
      cancelled = true;
    };
  }, [userId, chatId, isGroup, conversationStatus, setChats]);

  // Apply live background changes to the matching conversation.
  useEffect(() => {
    if (!socket || !userId) return;

    const currentUserId = String(userId);

    function handlePrivateBackgroundUpdated(update) {
      if (
        !Array.isArray(update?.participantIds) ||
        typeof update.background !== "string"
      ) {
        return;
      }

      const participants = update.participantIds.map(String);
      if (!participants.includes(currentUserId)) return;

      const otherUserId = participants.find((id) => id !== currentUserId);
      if (!otherUserId) return;

      setChats((previous) =>
        previous.map((chat) => {
          if (isGroupChat(chat)) return chat;

          const matchesUser = sameId(chat.id ?? chat._id, otherUserId);
          const matchesConversation =
            Boolean(update.conversationKey) &&
            chat.conversationKey === update.conversationKey;

          return matchesUser || matchesConversation
            ? {
                ...chat,
                background: update.background,
                messages: update.noticeMessage &&
                  !(chat.messages || []).some((message) => sameId(message.id, update.noticeMessage.id))
                    ? [...(chat.messages || []), update.noticeMessage]
                    : chat.messages,
              }
            : chat;
        })
      );
    }

    function handleGroupBackgroundUpdated(update) {
      if (!update?.groupId || typeof update.background !== "string") return;

      setChats((previous) =>
        previous.map((chat) =>
          isGroupChat(chat) &&
          sameId(chat.id ?? chat._id, update.groupId)
            ? { ...chat, background: update.background }
            : chat
        )
      );
    }

    socket.on("conversation:background:updated", handlePrivateBackgroundUpdated);
    socket.on("group:background:updated", handleGroupBackgroundUpdated);

    return () => {
      socket.off("conversation:background:updated", handlePrivateBackgroundUpdated);
      socket.off("group:background:updated", handleGroupBackgroundUpdated);
    };
  }, [socket, userId, setChats]);
}