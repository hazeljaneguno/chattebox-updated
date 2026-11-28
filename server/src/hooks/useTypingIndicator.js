import { useCallback, useEffect, useRef, useState } from "react";

const IDLE_MS = 2000;
const REFRESH_MS = 1500;
const EXPIRE_MS = 5000;

export function typingChatKey(chatId, isGroup) {
  return `${Boolean(isGroup)}:${chatId}`;
}

export default function useTypingIndicator(socket, activeChat, showTypingIndicator = true) {
  const chatId = String(activeChat?.id ?? "");
  const isGroup = Boolean(activeChat?.isGroup);
  const [typingByChat, setTypingByChat] = useState(() => new Map());
  const idleTimer = useRef(null);
  const lastSentAt = useRef(0);

  const stopTyping = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = null;

    if (lastSentAt.current && socket?.connected && chatId) {
      socket.emit("chat:typing", { chatId, isGroup, isTyping: false });
    }

    lastSentAt.current = 0;
  }, [socket, chatId, isGroup]);

  const handleTypingChange = useCallback((isTyping) => {
    if (!isTyping || !showTypingIndicator) {
      stopTyping();
      return;
    }

    if (!socket?.connected || !chatId) return;

    const now = Date.now();
    if (now - lastSentAt.current >= REFRESH_MS) {
      socket.emit("chat:typing", { chatId, isGroup, isTyping: true });
      lastSentAt.current = now;
    }

    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, IDLE_MS);
  }, [socket, chatId, isGroup, showTypingIndicator, stopTyping]);

  useEffect(() => {
    if (!showTypingIndicator) stopTyping();
  }, [showTypingIndicator, stopTyping]);

  useEffect(() => {
    if (!socket) return;
    socket.on("disconnect", stopTyping);
    return () => {
      socket.off("disconnect", stopTyping);
      stopTyping();
    };
  }, [socket, stopTyping]);

  useEffect(() => {
    if (!socket) return;

    const chats = new Map();

    function publish(key, sources) {
      const users = [...new Set([...sources.values()].map(({ userId }) => userId))];
      setTypingByChat((previous) => {
        const next = new Map(previous);
        if (users.length) next.set(key, users);
        else next.delete(key);
        return next;
      });
    }

    function remove(key, sources, sourceId) {
      clearTimeout(sources.get(sourceId)?.timer);
      if (!sources.delete(sourceId)) return;
      if (!sources.size) chats.delete(key);
      publish(key, sources);
    }

    function handleTyping(event) {
      if (event?.chatId == null || event.userId == null) return;

      const key = typingChatKey(event.chatId, event.isGroup);
      const sourceId = event.sourceId ?? event.userId;
      let sources = chats.get(key);
      if (!event.isTyping) {
        if (sources) remove(key, sources, sourceId);
        return;
      }

      if (!sources) {
        sources = new Map();
        chats.set(key, sources);
      }
      const previous = sources.get(sourceId);
      clearTimeout(previous?.timer);
      sources.set(sourceId, {
        userId: event.userId,
        timer: setTimeout(() => remove(key, sources, sourceId), EXPIRE_MS),
      });
      if (previous?.userId !== event.userId) publish(key, sources);
    }

    function reset() {
      for (const sources of chats.values()) {
        for (const { timer } of sources.values()) clearTimeout(timer);
      }
      chats.clear();
      setTypingByChat((previous) => previous.size ? new Map() : previous);
    }

    socket.on("chat:typing", handleTyping);
    socket.on("disconnect", reset);
    return () => {
      socket.off("chat:typing", handleTyping);
      socket.off("disconnect", reset);
      reset();
    };
  }, [socket]);

  const typingUserIds = typingByChat.get(typingChatKey(chatId, isGroup)) ?? [];

  return { handleTypingChange, typingUserIds, typingByChat };
}
