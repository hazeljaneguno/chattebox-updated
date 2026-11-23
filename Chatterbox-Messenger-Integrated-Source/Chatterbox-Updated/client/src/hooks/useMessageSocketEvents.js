import { useEffect } from "react";
import { sameId } from "../utils/chatHelpers.js";

/** Sync message attachments, deletions, and reactions with socket events. */
export default function useMessageSocketEvents({ socket, user, setChats }) {
  // Group attachment removal.
  useEffect(() => {
    if (!socket) return;

    function handleAttachmentRemoved(updatedMessage) {
      setChats((previousChats) =>
        previousChats.map((chat) => {
          if (!chat.isGroup || !sameId(chat.id, updatedMessage.groupId)) {
            return chat;
          }

          const messages = chat.messages || [];

          if (updatedMessage.deleted) {
            return {
              ...chat,
              messages: messages.filter(
                (message) => !sameId(message.id, updatedMessage.id)
              ),
            };
          }

          return {
            ...chat,
            messages: messages.map((message) =>
              sameId(message.id, updatedMessage.id)
                ? { ...message, attachment: null }
                : message
            ),
          };
        })
      );
    }

    socket.on("group:message:attachment-removed", handleAttachmentRemoved);

    return () => {
      socket.off("group:message:attachment-removed", handleAttachmentRemoved);
    };
  }, [socket, setChats]);

  // Private and group message deletion.
  useEffect(() => {
    if (!socket || !user) return;

    const currentUserId = user.id ?? user._id ?? user.userId;

    function updateDeletedMessage(updatedMessage, isGroupMessage) {
      setChats((previousChats) =>
        previousChats.map((chat) => {
          if (
            isGroupMessage &&
            (!chat.isGroup || !sameId(chat.id, updatedMessage.groupId))
          ) {
            return chat;
          }

          if (!isGroupMessage && chat.isGroup) return chat;

          const messages = chat.messages || [];

          // Remove the message only from the current user's view.
          if (updatedMessage.deleteType === "deleteForYou") {
            if (!sameId(updatedMessage.deletedFor, currentUserId)) return chat;

            return {
              ...chat,
              messages: messages.filter(
                (message) =>
                  !sameId(message.id ?? message._id, updatedMessage.id)
              ),
            };
          }

          // Keep a placeholder when the message was deleted for everyone.
          if (updatedMessage.isDeleted) {
            return {
              ...chat,
              messages: messages.map((message) =>
                sameId(message.id ?? message._id, updatedMessage.id)
                  ? {
                      ...message,
                      text: "",
                      attachment: null,
                      isDeleted: true,
                      deletedBy: updatedMessage.deletedBy,
                      deletedAt: updatedMessage.deletedAt,
                      replyTo: null,
                    }
                  : message
              ),
            };
          }

          return chat;
        })
      );
    }

    function handlePrivateMessageDeleted(message) {
      updateDeletedMessage(message, false);
    }

    function handleGroupMessageDeleted(message) {
      updateDeletedMessage(message, true);
    }

    socket.on("message:deleted", handlePrivateMessageDeleted);
    socket.on("group:message:deleted", handleGroupMessageDeleted);

    return () => {
      socket.off("message:deleted", handlePrivateMessageDeleted);
      socket.off("group:message:deleted", handleGroupMessageDeleted);
    };
  }, [socket, user, setChats]);

  // Live private-message reactions.
  // Live reactions for private and group messages.
  useEffect(() => {
    if (!socket) return;

    function handleReactionUpdated(update) {
      if (!update?.messageId || !Array.isArray(update.reactions)) {
        return;
      }

      const isGroupUpdate = update.isGroup === true;
      if (isGroupUpdate && !update.groupId) return;

      setChats((previousChats) =>
        previousChats.map((chat) => {
          const isGroupChat = chat.isGroup === true || chat.type === "group";

          if (isGroupChat !== isGroupUpdate) return chat;

          if (isGroupUpdate && !sameId(chat.id ?? chat._id, update.groupId)) {
            return chat;
          }

          const messages = chat.messages ?? [];
          const index = messages.findIndex((message) =>
            sameId(message.id ?? message._id, update.messageId)
          );

          if (index === -1 || messages[index].isDeleted) return chat;

          const nextMessages = [...messages];
          nextMessages[index] = {
            ...messages[index],
            reactions: update.reactions,
          };

          return { ...chat, messages: nextMessages };
        })
      );
    }

    socket.on("message:reaction:updated", handleReactionUpdated);

    return () => {
      socket.off("message:reaction:updated", handleReactionUpdated);
    };
  }, [socket, setChats]);
}