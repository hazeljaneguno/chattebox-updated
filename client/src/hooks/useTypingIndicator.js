import { useCallback, useEffect, useRef, useState } from "react";

const IDLE_MS = 2000;
const REFRESH_MS = 1500;
const EXPIRE_MS = 5000;

export default function useTypingIndicator(socket, activeChat, showTypingIndicator = true) {
  const chatId = String(activeChat?.id ?? "");
  const isGroup = Boolean(activeChat?.isGroup);
  const chatKey = `${isGroup}:${chatId}`;
  const [activity, setActivity] = useState(null);
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
    if (!socket || !chatId) return;

    const people = new Map();
    const timers = new Map();

    function publish() {
      setActivity({ chatKey, people: [...people.values()] });
    }

    function remove(sourceId) {
      clearTimeout(timers.get(sourceId));
      timers.delete(sourceId);
      if (people.delete(sourceId)) publish();
    }

    function handleTyping(event) {
      if (event?.chatId !== chatId || event.isGroup !== isGroup) return;

      const { sourceId, userId } = event;
      if (!event.isTyping) {
        remove(sourceId);
        return;
      }

      clearTimeout(timers.get(sourceId));
      people.set(sourceId, userId);
      timers.set(sourceId, setTimeout(() => remove(sourceId), EXPIRE_MS));
      publish();
    }

    function reset() {
      stopTyping();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      people.clear();
      setActivity(null);
    }

    socket.on("chat:typing", handleTyping);
    socket.on("disconnect", reset);

    return () => {
      socket.off("chat:typing", handleTyping);
      socket.off("disconnect", reset);
      reset();
    };
  }, [socket, chatId, isGroup, chatKey, stopTyping]);

  const typingUserIds =
    activity?.chatKey === chatKey ? [...new Set(activity.people)] : [];

  return { handleTypingChange, typingUserIds };
}