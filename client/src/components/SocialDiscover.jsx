import { useEffect, useState } from "react";
import { ArrowLeft, Camera, Search, UsersRound } from "lucide-react";
import { api } from "../api.js";
import Avatar from "./Avatar.jsx";
import ChatScreen from "./ChatScreen.jsx";
import { formatChatDate } from "../utils/chatHelpers.js";
import "./SocialDiscover.css";

export default function SocialDiscover({ socket, onMessage, notifications = false }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Home");
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [post, setPost] = useState("");
  const [pageName, setPageName] = useState("");
  const [pageDescription, setPageDescription] = useState("");
  const term = query.trim();

  useEffect(() => {
    const update = () => setRefresh((value) => value + 1);
    const events = ["connect", "social:updated", "conversation:blocked"];
    events.forEach((event) => socket?.on(event, update));
    return () => events.forEach((event) => socket?.off(event, update));
  }, [socket]);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const data = await api.discoverSocial(term);
        if (current) {
          setResult({ term, data });
          setError("");
        }
      } catch (error) {
        if (current) setError(error.message || "Could not load Social.");
      }
    }, term ? 200 : 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [term, refresh]);

  const data = result?.term === term ? result.data : null;
  const currentProfile = selected && (
    [...(data?.people || []), ...(data?.followers || [])].find((person) => person.id === selected.id)
  );

  async function act(path, method, body, after) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.updateSocialDiscovery(path, method, body);
      after?.();
      setRefresh((value) => value + 1);
    } catch (error) {
      setError(error.message || "Could not save your change.");
    } finally {
      setBusy(false);
    }
  }

  function follow(person) {
    void act(`links/follow/${encodeURIComponent(person.id)}`, "PUT", { active: !person.following });
  }

  function personRow(person, follower = false) {
    const ownProfile = data?.me.id === person.id;
    return (
      <li className="discover-row" key={person.id}>
        <button type="button" className="discover-person" onClick={() => setSelected(person)}>
          <Avatar name={person.username} photo={person.profilePicture} />
          <span>
            <strong>{person.username}</strong>
            <small>
              {follower ? `Started following you · ${formatChatDate(person.date)}` :
                `${person.digitalCreator ? "Digital creator · " : ""}${person.followers} followers`}
            </small>
          </span>
        </button>
        {!ownProfile && <button type="button" disabled={busy} onClick={() => follow(person)}>
          {person.following ? "Following" : follower ? "Follow back" : "Follow"}
        </button>}
      </li>
    );
  }

  const profile = currentProfile && (
    <ChatScreen label={currentProfile.username} onBack={() => setSelected(null)}>
      <header className="chat-screen-header">
        <button type="button" className="chat-screen-icon" aria-label="Back" onClick={() => setSelected(null)}><ArrowLeft size={22} /></button>
        <h2>Profile</h2>
      </header>
      <div className="chat-screen-scroll discover-profile">
        <div className="discover-cover" />
        <Avatar name={currentProfile.username} photo={currentProfile.profilePicture} />
        <h3>{currentProfile.username}</h3>
        <p>{currentProfile.followers ?? 0} followers</p>
        {currentProfile.digitalCreator && <p className="discover-creator"><Camera size={16} /> Digital creator</p>}
        {data?.me.id !== currentProfile.id && <div className="discover-profile-actions">
          <button type="button" disabled={busy} onClick={() => follow(currentProfile)}>
            {currentProfile.following ? "Following" : notifications ? "Follow back" : "Follow"}
          </button>
          <button type="button" onClick={() => { setSelected(null); onMessage(currentProfile); }}>Message</button>
        </div>}
        {data?.me.id !== currentProfile.id && (
          <p className="discover-profile-note">A first message goes to Message requests when the chat still needs approval.</p>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </ChatScreen>
  );

  if (notifications) {
    if (!data?.followers.length && !error) return null;
    return (
      <section className="discover sidebar-notification-group">
        <h2>{data?.me.digitalCreator ? "Creator followers" : "New followers"}</h2>
        {error && !selected && <p role="alert">{error}</p>}
        <ul>{data?.followers.map((person) => personRow(person, true))}</ul>
        {profile}
      </section>
    );
  }

  return (
    <section className="discover" aria-label="Social discovery">
      <label className="discover-search">
        <Search size={19} aria-hidden="true" />
        <input type="search" aria-label="Search people and pages" placeholder="Search people and pages"
          value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} />
      </label>
      <nav aria-label="Social sections">
        {["Home", "People", "Pages"].map((item) => (
          <button type="button" key={item} aria-pressed={item === tab} onClick={() => setTab(item)}>{item}</button>
        ))}
      </nav>
      {error && !selected && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading…</p>}
      {data && <>
        {!term && tab === "Home" && <section>
          <div className="discover-account">
            <Avatar name={data.me.username} photo={data.me.profilePicture} />
            <span>{data.me.digitalCreator ? "Digital creator" : "Personal profile"}</span>
            <button type="button" disabled={busy} onClick={() => act("profile", "PATCH", { digitalCreator: !data.me.digitalCreator })}>
              {data.me.digitalCreator ? "Switch to personal" : "Become a creator"}
            </button>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void act("posts", "POST", { text: post }, () => setPost("")); }}>
            <textarea aria-label="Write a post" placeholder="Share an update" value={post} maxLength={1200}
              onChange={(event) => setPost(event.target.value)} />
            <button type="submit" disabled={busy || !post.trim()}>Post</button>
          </form>
          {data.posts.map((item) => (
            <article className="discover-post" key={item.id}>
              <div className="discover-account">
                <Avatar name={item.author.username} photo={item.author.profilePicture} />
                <span><strong>{item.author.username}</strong><small>{formatChatDate(item.date)}</small></span>
              </div>
              <p>{item.text}</p>
            </article>
          ))}
        </section>}
        {(tab === "People" || (tab === "Home" && term)) && <section>
          <h2>People</h2>
          {!data.people.length && <p>No matching accounts.</p>}
          <ul>{data.people.map((person) => personRow(person))}</ul>
        </section>}
        {(tab === "Pages" || (tab === "Home" && term)) && <section>
          <h2>Pages</h2>
          {tab === "Pages" && !term && <form onSubmit={(event) => {
            event.preventDefault();
            void act("pages", "POST", { name: pageName, description: pageDescription }, () => {
              setPageName("");
              setPageDescription("");
            });
          }}>
            <input aria-label="Page name" placeholder="Page name" value={pageName} maxLength={80} onChange={(event) => setPageName(event.target.value)} />
            <input aria-label="Page description" placeholder="Description (optional)" value={pageDescription} maxLength={240}
              onChange={(event) => setPageDescription(event.target.value)} />
            <button type="submit" disabled={busy || !pageName.trim()}>Create page</button>
          </form>}
          {!data.pages.length && <p>No matching pages.</p>}
          <ul>{data.pages.map((page) => (
            <li className="discover-row" key={page.id}>
              <UsersRound size={22} aria-hidden="true" />
              <span className="discover-page-copy">
                <strong>{page.name}</strong><small>{page.members} members{page.owned ? " · Your page" : ""}</small>
                {page.description && <small>{page.description}</small>}
              </span>
              {!page.owned && <button type="button" disabled={busy}
                onClick={() => act(`links/join/${encodeURIComponent(page.id)}`, "PUT", { active: !page.joined })}>
                {page.joined ? "Leave" : "Join"}
              </button>}
            </li>
          ))}</ul>
        </section>}
      </>}
      {profile}
    </section>
  );
}
