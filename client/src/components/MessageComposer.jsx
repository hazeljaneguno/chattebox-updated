import { useEffect, useRef, useState } from "react";
import { Plus, Camera, Mic, Smile, ThumbsUp, Send, X, FileText } from "lucide-react";
import ComposerPhotoGrid, { hasNativePhotoGrid } from "./ComposerPhotoGrid.jsx";

import preparePhoto from "../utils/preparePhoto.js";
import useVoiceRecorder from "../hooks/useVoiceRecorder.js";
import "./MessageComposer.css";

const emojis = ["😊", "😂", "❤️", "😍", "😮", "😢", "😡", "👍", "🎉", "🙏", "🔥", "👋"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MessageComposer({
  draft,
  setDraft,
  inputRef,
  sendMessage,
  socketStatus,
  onTypingChange,
}) {
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const submittingRef = useRef(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileError, setFileError] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [hd, setHd] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const voice = useVoiceRecorder({
    onRecorded: selectFile,
    onError: setFileError,
    maxBytes: MAX_FILE_BYTES,
  });
  const voiceBusy = voice.status !== "idle";
  const busy = sending || photoBusy || voiceBusy;
  const hasDraft = Boolean(draft.trim() || selectedFile);
  const attachmentType = selectedFile?.type || "";

  useEffect(() => {
    const url = selectedFile && selectedFile.type.startsWith("audio/") ? URL.createObjectURL(selectedFile) : "";
    setPreviewUrl(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  function selectFile(file, photoId = null) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError("File must be 10 MB or smaller.");
      return;
    }
    setFileError("");
    setSelectedFile(file);
    setSelectedPhoto(photoId);
  }

  function handleFileChange(event) {
    selectFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function removeFile() {
    setSelectedFile(null);
    setSelectedPhoto(null);
    setFileError("");
  }

  async function handleSubmit(event, like = false) {
    event.preventDefault();
if (submittingRef.current || busy || socketStatus !== "connected") return;
if (!hasDraft && !like) return;

onTypingChange?.(false);
    submittingRef.current = true;
    setSending(true);
    setFileError("");
    try {
      const attachment = await preparePhoto(selectedFile, hd);
      await sendMessage(event, attachment, {
        focusInput: !galleryOpen && !like,
        textOverride: like ? "👍" : undefined,
      });
      setEmojiOpen(false);
      removeFile();
    } catch (error) {
      setFileError(error.message || "Unable to send the message.");
    } finally {
      submittingRef.current = false;
      setSending(false);
    }
  }

function handleDraftChange(nextDraft) {
  setDraft(nextDraft);
  onTypingChange?.(Boolean(nextDraft.trim()));
}
  function openPhotos() {
    if (!hasNativePhotoGrid) {
      photoInputRef.current?.click();
      return;
    }
    inputRef.current?.blur();
    setEmojiOpen(false);
    setGalleryOpen((open) => !open);
  }

  function addEmoji(emoji) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? start;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    if (next.length > 4000) return;
    handleDraftChange(next);
    input?.focus();
    requestAnimationFrame(() => input?.setSelectionRange(start + emoji.length, start + emoji.length));
  }

  function toggleEmoji() {
    setGalleryOpen(false);
    setEmojiOpen((open) => !open);
  }

  function startRecording() {
    inputRef.current?.blur();
    setEmojiOpen(false);
    setGalleryOpen(false);
    voice.start();
  }

  return (
    <div className="composer-wrap">
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleFileChange}
        accept="image/*,video/mp4,video/webm,video/quicktime,video/3gpp,.pdf,.doc,.docx,.txt,.csv,.xlsx,.zip"
      />
      <input ref={photoInputRef} type="file" hidden accept="image/*" onChange={handleFileChange} />

      <input ref={cameraInputRef} type="file" hidden accept="image/*" capture="environment"
        onChange={handleFileChange} />

      <form className="message-composer has-composer-tools" onSubmit={handleSubmit}>
        <button type="button" className="composer-tool" aria-label="Add attachment" disabled={busy}
          onClick={() => fileInputRef.current?.click()}>
          <Plus size={21} />
        </button>
        <button type="button" className="composer-tool" aria-label="Take a photo" disabled={busy}
          onClick={() => cameraInputRef.current?.click()}>
          <Camera size={20} />
        </button>
        <button type="button" className="composer-tool" aria-label="Photos" disabled={busy}
          aria-expanded={hasNativePhotoGrid ? galleryOpen : undefined} onClick={openPhotos}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#fbbc04" d="M12 0a6 6 0 0 0 0 12Z" />
            <path fill="#ea4335" d="M24 12a6 6 0 0 0-12 0Z" />
            <path fill="#4285f4" d="M12 24a6 6 0 0 0 0-12Z" />
            <path fill="#34a853" d="M0 12a6 6 0 0 0 12 0Z" />
          </svg>
        </button>
        <button type="button" className="composer-tool" aria-label="Record a voice message"
          disabled={busy} onClick={startRecording}>
          <Mic size={20} />
        </button>

        <div className="composer-entry">
          <input
  ref={inputRef}
  value={draft}
  onChange={(event) => handleDraftChange(event.target.value)}
  onBlur={() => onTypingChange?.(false)}
  placeholder="Message…"
  aria-label="Write a message"
  readOnly={sending}
  maxLength={4000}
/>
          <button type="button" className="composer-tool composer-emoji-button" aria-label="Emoji picker"
            aria-expanded={emojiOpen} disabled={busy} onMouseDown={(event) => event.preventDefault()}
            onClick={toggleEmoji}>
            <Smile size={20} />
          </button>
        </div>

        {hasDraft ? (
          <button type="submit" className="send-button" aria-label="Send message"
            disabled={busy || socketStatus !== "connected"}>
            <Send size={18} />
          </button>
        ) : (
          <button type="button" className="composer-tool composer-like-button" aria-label="Send a like"
            disabled={busy || socketStatus !== "connected"} onClick={(event) => handleSubmit(event, true)}>
            <ThumbsUp size={21} fill="currentColor" />
          </button>
        )}
      </form>

      {emojiOpen && (
        <div className="composer-emoji-picker" aria-label="Choose an emoji">
          {emojis.map((emoji) => (
            <button type="button" key={emoji} disabled={busy}
              onMouseDown={(event) => event.preventDefault()} onClick={() => addEmoji(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {voiceBusy && (
        <div className="composer-voice-controls">
          <span role="status">
            {voice.status === "starting" ? "Opening microphone…" :
              voice.status === "recording" ? "Recording…" : "Preparing voice message…"}
          </span>
          {voice.status === "recording" && <button type="button" onClick={voice.stop}>Stop</button>}
          <button type="button" onClick={() => voice.cancel()}>Cancel</button>
        </div>
      )}

      {(galleryOpen || attachmentType.startsWith("image/")) && (
        <button type="button" className="composer-hd-toggle" aria-label="HD photo quality"
          aria-pressed={hd} disabled={busy} onClick={() => setHd((enabled) => !enabled)}>
          HD {hd ? "on" : "off"}
        </button>
      )}

      {attachmentType.startsWith("image/") && (!galleryOpen || selectedPhoto == null) && (
        <button type="button" className="composer-hd-toggle composer-clear-photo"
          disabled={busy} onClick={removeFile}>Clear photo</button>
      )}

      {selectedFile && !attachmentType.startsWith("image/") && (
        <div className="attachment-preview composer-attachment-preview">
          <div className="attachment-icon"><FileText size={22} /></div>
          <div className="attachment-details">
            <strong>{attachmentType.startsWith("audio/") ? "Voice message" : selectedFile.name}</strong>
            {previewUrl && attachmentType.startsWith("audio/") && (
              <audio className="composer-audio-preview" src={previewUrl} controls aria-label="Preview voice message" />
            )}
            <span>{sending ? "Sending…" : formatFileSize(selectedFile.size)}</span>
          </div>
          <button type="button" className="remove-attachment" onClick={removeFile}
            aria-label="Remove attachment" disabled={busy}>
            <X size={18} />
          </button>
        </div>
      )}
      {fileError && <p className="attachment-error" role="alert">{fileError}</p>}
      {galleryOpen && (
        <ComposerPhotoGrid
          chosenPhoto={selectedPhoto}
          onChoose={selectFile}
          onClear={removeFile}
          onError={setFileError}
          disabled={sending}
          onBusyChange={setPhotoBusy}
        />
      )}
    </div>
  );
}
