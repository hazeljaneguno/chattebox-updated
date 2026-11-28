
import { useEffect } from "react";
import { sameId } from "../utils/chatHelpers.js";

export default function useChatMessages({
  socket,
  user,
  activeIdRef,
  setChats,
}) {
  useEffect(() => {
    if (!socket || !user) return;

    function acknowledgeDelivery(message, event) {
      if (!message.id || !message.senderId || sameId(message.senderId, user.id)) return;
      if (message.isDeleted || (message.type && !["text", "image", "audio", "video", "file"].includes(message.type))) return;
      socket.emit(event, { messageId: message.id, status: "delivered" });
    }

    function handleReceipt({ messageId, groupId, deliveredTo, readBy } = {}) {
      if (!messageId || !Array.isArray(deliveredTo)) return;

      setChats((previous) => previous.map((chat) => {
        if (groupId ? !chat.isGroup || !sameId(chat.id, groupId) : chat.isGroup) return chat;
        if (!chat.messages?.some((message) => sameId(message.id, messageId))) return chat;
        return {
          ...chat,
          messages: chat.messages.map((message) => sameId(message.id, messageId)
            ? {
                ...message,
                deliveredTo: deliveredTo.length >= (message.deliveredTo?.length ?? 0)
                  ? deliveredTo
                  : message.deliveredTo,
                read: Boolean(message.read || readBy?.length),
                readBy: Array.isArray(readBy) && readBy.length >= (message.readBy?.length ?? 0)
                  ? readBy
                  : message.readBy,
              }
            : message),
        };
      }));
    }

    function handleDirectMessage(message) {
      const otherId = sameId(message.senderId, user.id)
        ? message.recipientId
        : message.senderId;

      if (!otherId) return;
      acknowledgeDelivery(message, "message:receipt");
      const isActive = sameId(activeIdRef.current, otherId);
      const isOwnMessage = sameId(message.senderId, user.id);

      setChats((previous) => {
        if (!previous.some((chat) => !chat.isGroup && sameId(chat.id, otherId))) {
          return [...previous, {
            id: otherId,
            username: (isOwnMessage ? message.recipientName : message.senderName) || "Chat",
            messages: [message],
            unread: isActive || isOwnMessage ? 0 : 1,
          }];
        }

        return previous.map((chat) => {
          if (chat.isGroup || !sameId(chat.id, otherId)) return chat;
          const messages = chat.messages || [];
          if (messages.some((item) => sameId(item.id, message.id))) return chat;

          return {
            ...chat,
            messages: [...messages, message],
            unread: (chat.unread || 0) + (isActive || isOwnMessage ? 0 : 1),
          };
        });
      });
    }

    function handleGroupMessage(message) {
      acknowledgeDelivery(message, "group:message:receipt");
      setChats((previous) =>
        previous.map((chat) => {
          if (!chat.isGroup || !sameId(chat.id, message.groupId)) {
            return chat;
          }

          const messages = chat.messages || [];

          if (messages.some((item) => sameId(item.id, message.id))) {
            return chat;
          }

          const isActive = sameId(activeIdRef.current, message.groupId);
          const isOwnMessage = sameId(message.senderId, user.id);

          return {
            ...chat,
            messages: [...messages, message],
            unread:
              isActive || isOwnMessage
                ? chat.unread || 0
                : (chat.unread || 0) + 1,
          };
        })
      );
    }

    function handleMessageUpdated(message) {
      const otherId = sameId(message.senderId, user.id)
        ? message.recipientId
        : message.senderId;

      setChats((previous) =>
        previous.map((chat) =>
          !chat.isGroup && sameId(chat.id, otherId)
            ? {
                ...chat,
                messages: (chat.messages || []).map((item) =>
                  sameId(item.id, message.id)
                    ? { ...item, ...message }
                    : item
                ),
              }
            : chat
        )
      );
    }

    socket.on("message:new", handleDirectMessage);
    socket.on("group:message:new", handleGroupMessage);
    socket.on("message:updated", handleMessageUpdated);
    socket.on("message:receipt", handleReceipt);
    socket.on("group:message:receipt", handleReceipt);

    return () => {
      socket.off("message:new", handleDirectMessage);
      socket.off("group:message:new", handleGroupMessage);
      socket.off("message:updated", handleMessageUpdated);
      socket.off("message:receipt", handleReceipt);
      socket.off("group:message:receipt", handleReceipt);
    };
  }, [socket, user, activeIdRef, setChats]);
}
