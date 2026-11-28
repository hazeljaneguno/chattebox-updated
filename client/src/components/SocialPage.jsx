import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, UserPlus } from "lucide-react";
import { api } from "../api.js";
import SocialDiscover from "./SocialDiscover.jsx";
import Avatar from "./Avatar.jsx";
import "./SocialPage.css";

export default function SocialPage({ socket, onMessage, onOpenSocial, compact = false }) {
  const [showFriends, setShowFriends] = useState(false);
  const [people, setPeople] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const result = await api.social();
      if (version === loadVersion.current) {
        setPeople(result);
        setError("");
      }
    } catch (error) {
      if (version === loadVersion.current) setError(error.message || "Could not load people.");
    }
  }, []);

  useEffect(() => {
    void load();
    const events = ["social:updated", "conversation:blocked", "connect"];
    events.forEach((event) => socket?.on(event, load));
    return () => {
      loadVersion.current++;
      events.forEach((event) => socket?.off(event, load));
    };
  }, [socket, load]);

  async function update(person, action) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.updateFriendship(person.id, action);
      await load();
    } catch (error) {
      await load();
      setError(error.message || "Could not update the friend request.");
    } finally {
      setBusy(false);
    }
  }

  function row(person, action) {
    const count = person.sharedGroupCount;
    return (
      <li className="social-person" key={person.id}>
        <Avatar name={person.username} photo={person.profilePicture} />
        <span className="sidebar-page-copy">
          <strong>{person.username}</strong>
          {count > 0 && <small>{count} shared group {count === 1 ? "chat" : "chats"}</small>}
        </span>
        <div className="social-actions">{action}</div>
      </li>
    );
  }

  return (
    <section className={compact ? "social-page social-suggestions" : "conversation-list sidebar-page social-page"} aria-label="Chatterbox social">
      {!compact && (
        <nav className="social-home-tabs" aria-label="Social home">
          <button type="button" aria-pressed={!showFriends} onClick={() => setShowFriends(false)}>Feed</button>
          <button type="button" aria-pressed={showFriends} onClick={() => setShowFriends(true)}>Friends</button>
        </nav>
      )}
      {!compact && !showFriends && <SocialDiscover socket={socket} onMessage={onMessage} />}
      {(compact || showFriends) && error && <p role="alert">{error} <button type="button" onClick={load}>Retry</button></p>}
      {(compact || showFriends) && !people && !error && <p role="status">Loading people…</p>}
      {(compact || showFriends) && people && (
        <>
          {!compact && <section>
            <h2>Friend requests</h2>
            {people.incoming.length === 0 && <p>No incoming friend requests.</p>}
            <ul>{people.incoming.map((person) => row(person, <>
              <button type="button" disabled={busy} onClick={() => update(person, "confirm")}>Confirm</button>
              <button type="button" disabled={busy} onClick={() => update(person, "decline")}>Decline</button>
            </>))}</ul>
            {people.sent.length > 0 && (
              <ul>{people.sent.map((person) => row(person, <small>Request sent</small>))}</ul>
            )}
          </section>}
          <section>
            <h2>People you may know</h2>
            {people.suggestions.length === 0 && <p>No suggestions from your group chats yet.</p>}
            <ul>{(compact ? people.suggestions.slice(0, 3) : people.suggestions).map((person) => row(person,
              <button type="button" disabled={busy} onClick={() => update(person, "request")}>
                <UserPlus size={16} aria-hidden="true" /> Add friend
              </button>
            ))}</ul>
            {compact && <button type="button" onClick={onOpenSocial}>See friends and requests</button>}
          </section>
          {!compact && <section>
            <h2>Friends</h2>
            {people.friends.length === 0 && <p>No confirmed friends yet.</p>}
            <ul>{people.friends.map((person) => row(person,
              <button type="button" onClick={() => onMessage(person)}>
                <MessageCircle size={16} aria-hidden="true" /> Message
              </button>
            ))}</ul>
          </section>}
        </>
      )}
    </section>
  );
}
