import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import { getReplyPreview } from "../utils/messageHelpers.js";
import "./ForwardMessageDialog.css";

export default function ForwardMessageDialog({ chats, sourceChat, message, socketRef, onForwarded, onClose }) {
  const dialogRef = useRef(null);
  const sendingRef = useRef(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);

  const term = search.trim().toLowerCase();
  const destinations = chats
    .filter((chat) => String(chat.id) !== String(sourceChat.id) || Boolean(chat.isGroup) !== Boolean(sourceChat.isGroup))
    .map((chat) => ({
      ...chat,
      key: `${chat.isGroup ? "group" : "private"}:${chat.id}`,
      label: chat.username || chat.name || "Conversation",
    }));
  const matches = destinations.filter(({ label }) => label.toLowerCase().includes(term));

  async function forward(event) {
    event.preventDefault();
    const target = matches.find(({ key }) => key === selected);
    if (!target || sendingRef.current) return;
    setError("");
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError("Chat is disconnected. Try again after it reconnects.");
      return;
    }

    const text = message.text ?? message.content ?? "";
    const file = message.attachment;
    const attachment = file?.url ? {
      url: file.url,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
    } : undefined;
    if (message.isDeleted || message.deleted || message.deletedForEveryone || (!text.trim() && !attachment)) {
      setError("This message is no longer available to forward.");
      return;
    }

    sendingRef.current = true;
    setSending(true);
    try {
      const result = await socket.timeout(10000).emitWithAck(
        target.isGroup ? "group:message:send" : "message:send",
        { ...(target.isGroup ? { groupId: target.id } : { recipientId: target.id }), text, attachment }
      );
      if (!result?.ok) {
        setError(result?.message || "Could not forward this message.");
        return;
      }
      onClose();
      onForwarded?.();
    } catch {
      setError("Delivery could not be confirmed. Check the destination chat before trying again.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <dialog className="forward-message-dialog" ref={dialogRef} aria-labelledby="forward-message-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!sendingRef.current) onClose();
      }}>
      <form onSubmit={forward}>
        <h2 id="forward-message-title">Forward message</h2>
        <p className="forward-message-preview">{getReplyPreview(message)}</p>
        <label className="forward-message-search">
          Search chats
          <input value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
        </label>
        <fieldset className="forward-message-targets" disabled={sending}>
          <legend>Choose a chat</legend>
          {matches.length === 0 && <p>No matching chats.</p>}
          {matches.map((chat) => (
            <label key={chat.key}>
              <input type="radio" name="forward-chat" value={chat.key}
                checked={selected === chat.key} onChange={() => setSelected(chat.key)} />
              <Avatar name={chat.label} photo={chat.profilePicture} small />
              <span>{chat.label}<small>{chat.isGroup ? "Group" : "Private chat"}</small></span>
            </label>
          ))}
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="forward-message-actions">
          <button type="button" disabled={sending} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={sending || !matches.some(({ key }) => key === selected)}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
