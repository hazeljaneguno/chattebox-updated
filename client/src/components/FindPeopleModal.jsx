import { ArrowLeft, UsersRound } from "lucide-react";
import Avatar from "./Avatar.jsx";
import ChatScreen from "./ChatScreen.jsx";

export default function FindPeopleModal({
  open,
  setOpen,
  newSearch,
  setNewSearch,
  searchResults,
  searchPending,
  searchError,
  groups,
  onlineIds,
  selectChat,
  onCreateGroup,
}) {
  if (!open) return null;
  const close = () => setOpen(false);
  const term = newSearch.trim().toLowerCase();
  const matchingGroups = groups.filter((group) => !term || group.name?.toLowerCase().includes(term));

  return (
    <ChatScreen label="New message" onBack={close}>
      <header className="chat-screen-header">
        <button type="button" className="chat-screen-icon" aria-label="Back" onClick={close}>
          <ArrowLeft size={23} />
        </button>
        <h2>New message</h2>
      </header>
      <label className="chat-recipient-field">
        <span>To</span>
        <input
          type="search"
          value={newSearch}
          onChange={(event) => setNewSearch(event.target.value)}
          placeholder="Type a name or group"
          aria-label="Search recipients"
        />
      </label>
      <div className="chat-screen-scroll chat-recipient-list">
        {!term && (
          <button type="button" className="chat-recipient" onClick={onCreateGroup}>
            <span className="chat-recipient-group-icon"><UsersRound size={23} /></span>
            <span>Group chat</span>
          </button>
        )}
        {matchingGroups.map((group) => (
          <button type="button" className="chat-recipient" key={`group:${group.id}`} onClick={() => selectChat(group)}>
            <Avatar name={group.name} photo={group.profilePicture} />
            <span>{group.name}<small>Group chat</small></span>
          </button>
        ))}
        {searchResults.map((person) => (
          <button type="button" className="chat-recipient" key={`person:${person.id}`} onClick={() => selectChat(person)}>
            <Avatar name={person.username} photo={person.profilePicture} online={onlineIds.has(String(person.id))} />
            <span>{person.username}</span>
          </button>
        ))}
        {searchPending && <p role="status">Finding people…</p>}
        {searchError && <p role="alert">{searchError}</p>}
        {!searchPending && !searchError && !matchingGroups.length && !searchResults.length && (
          <p role="status">No people or groups found.</p>
        )}
      </div>
    </ChatScreen>
  );
}
