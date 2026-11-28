import { useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import Avatar from "./Avatar.jsx";
import ChatScreen from "./ChatScreen.jsx";
import { api } from "../api.js";
import { formatChatDate } from "../utils/chatHelpers.js";
import { getAttachmentMediaType, getAttachmentUrl } from "../utils/messageHelpers.js";

function senderId(request) {
  return request.user?.id ?? request.user?._id;
}

const actions = {
  block: { run: (id) => api.blockConversation(id), notice: "User blocked." },
  reject: { run: (id) => api.rejectMessageRequest(id), notice: "Message request declined." },
  delete: { run: (id) => api.deleteMessageRequest(id), notice: "Message request deleted." },
  accept: { run: (id) => api.acceptMessageRequest(id), notice: "Message request accepted." },
};

export default function MessageRequestsModal({
  requests = [],
  loading = false,
  onClose,
  onRequestUpdated,
  onAccepted,
  showNotice,
  inline = false,
  embedded = false,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const selected = requests.find((request) => senderId(request) === selectedId);

  function openRequest(id) {
    setError("");
    setShowInfo(false);
    setSelectedId(id);
  }

  async function handleAction(action) {
    if (!selectedId || busy) return;
    const { run, notice } = actions[action];
    setBusy(true);
    setError("");
    try {
      await run(selectedId);
      if (action === "accept") onAccepted?.(selectedId);
      setSelectedId(null);
      showNotice?.(notice);
      onRequestUpdated?.();
    } catch (error) {
      setError(error.message || "Could not update this request.");
    } finally {
      setBusy(false);
    }
  }

  const list = (
    <div className={inline ? "conversation-list sidebar-page chat-request-list" : "chat-screen-scroll chat-request-list"}>
      {inline && <button type="button" className="chat-screen-back-link" onClick={onClose}>
        <ArrowLeft size={17} /> Back to Menu
      </button>}
      {loading && !requests.length && <p role="status">Loading requests…</p>}
      {!loading && !requests.length && <p>No message requests.</p>}
      {requests.map((request) => {
        const id = senderId(request);
        const name = request.user?.username || "Unknown user";
        const preview = request.message?.text || (request.message?.attachment ? "Sent an attachment" : "Message request");
        return (
          <button type="button" className="chat-recipient chat-request-row" key={id} onClick={() => openRequest(id)}>
            <Avatar name={name} photo={request.user?.profilePicture} />
            <span><strong>{name}</strong><small>{preview}</small></span>
            <time dateTime={request.createdAt}>{formatChatDate(request.createdAt)}</time>
          </button>
        );
      })}
    </div>
  );

  if (selected) {
    const name = selected.user?.username || "Unknown user";
    const photo = selected.user?.profilePicture;
    const message = selected.message;
    const createdAt = message?.createdAt || selected.createdAt;
    const attachment = message?.attachment;
    const url = getAttachmentUrl(attachment);
    const back = () => {
      if (!busy) setSelectedId(null);
    };

    return (
      <ChatScreen embedded={embedded} key={selectedId} label={`Message request from ${name}`} onBack={back}>
        <header className="chat-screen-header">
          <button type="button" className="chat-screen-icon" aria-label="Back to message requests" disabled={busy} onClick={back}>
            <ArrowLeft size={23} />
          </button>
          <Avatar name={name} photo={photo} />
          <h2>{name}</h2>
          <button type="button" className="chat-screen-icon" aria-label="About this request" aria-expanded={showInfo}
            onClick={() => setShowInfo((visible) => !visible)}>
            <Info size={22} />
          </button>
        </header>
        {showInfo && (
          <div className="chat-request-info">
            <p>This is a private message request. You can preview it before deciding whether to chat.</p>
            <button type="button" className="chat-screen-back-link" disabled={busy} onClick={() => handleAction("reject")}>
              Decline request
            </button>
          </div>
        )}
        <div className="chat-screen-scroll chat-request-thread">
          <div className="chat-request-profile">
            <Avatar name={name} photo={photo} />
            <h3>{name}</h3>
            <span>Message request</span>
          </div>
          <div className="chat-request-message">
            {createdAt && <time dateTime={createdAt}>{formatChatDate(createdAt)}</time>}
            <div className="chat-request-bubble-row">
              <Avatar small name={name} photo={photo} />
              <div className="chat-request-bubble">
                {message?.text && <p>{message.text}</p>}
                {url && (
                  <a href={url} target="_blank" rel="noreferrer">
                    {getAttachmentMediaType(attachment) === "image"
                      ? <img src={url} alt="Attached image" />
                      : "Open attachment"}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        <footer className="chat-request-footer">
          <p>Accept to let {name} send more messages and call you.</p>
          {error && <p role="alert">{error}</p>}
          <div className="chat-request-buttons">
            <button type="button" disabled={busy} onClick={() => handleAction("block")}>Block</button>
            <button type="button" disabled={busy} onClick={() => handleAction("delete")}>Delete</button>
            <button type="button" disabled={busy} onClick={() => handleAction("accept")}>Accept</button>
          </div>
          {busy && <p role="status">Updating request…</p>}
        </footer>
      </ChatScreen>
    );
  }

  if (inline || embedded) return list;
  return (
    <ChatScreen label="Message requests" onBack={onClose}>
      <header className="chat-screen-header">
        <button type="button" className="chat-screen-icon" aria-label="Back" onClick={onClose}><ArrowLeft size={23} /></button>
        <h2>Message requests</h2>
      </header>
      {list}
    </ChatScreen>
  );
}
