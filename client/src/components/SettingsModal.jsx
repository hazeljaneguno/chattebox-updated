import { api } from "../api.js";
import preparePhoto from "../utils/preparePhoto.js";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, AtSign, Camera, Check, ChevronRight, CircleDot, Inbox, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { initials } from "./Avatar.jsx";
import { getAttachmentUrl } from "../utils/messageHelpers.js";
import "./SettingsModal.css";

function SettingsRow({ icon: Icon, label, detail, onClick, end, ...attributes }) {
  const Element = onClick ? "button" : "div";
  return (
    <Element className="settings-row" onClick={onClick}
      {...(onClick ? { type: "button" } : {})} {...attributes}>
      <span className="settings-row-icon"><Icon size={20} aria-hidden="true" /></span>
      <span className="settings-row-copy">
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
      {end}
    </Element>
  );
}

export default function SettingsModal({
  isOpen, onClose, user, theme, onThemeChange, savingTheme = false,
  showActiveStatus = true, onActiveStatusChange, savingActiveStatus = false,
  onMessageRequests, messageRequestsPage, onLogout, onProfilePictureChange,
}) {
  if (!isOpen) return null;
  return <OpenSettings {...{
    onClose, user, theme, onThemeChange, savingTheme, showActiveStatus,
    onActiveStatusChange, savingActiveStatus, onMessageRequests, messageRequestsPage, onLogout, onProfilePictureChange,
  }} />;
}

function OpenSettings({
  onClose, user, theme, onThemeChange, savingTheme,
  showActiveStatus, onActiveStatusChange, savingActiveStatus,
  onMessageRequests, messageRequestsPage, onLogout, onProfilePictureChange,
}) {
  const [page, setPage] = useState("Settings");
  const picker = useRef(null);
  const savingPhotoRef = useRef(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const backButton = useRef(null);
  const body = useRef(null);
  const username = user?.username || "";
  const name = user?.displayName || user?.name || username || "Your account";
  const photo = user?.profilePicture;
  const back = page === "Settings" ? onClose : () => setPage("Settings");

  useLayoutEffect(() => {
    backButton.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [page]);

  async function changePhoto(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || savingPhotoRef.current) return;

    savingPhotoRef.current = true;
    setSavingPhoto(true);
    setPhotoError("");
    try {
      const photo = await preparePhoto(file);
      const form = new FormData();
      form.append("file", photo);
      const { profilePicture } = await api.uploadProfilePicture(form);
      if (!profilePicture) throw new Error("The server did not return a profile photo.");
      onProfilePictureChange?.(profilePicture);
    } catch (error) {
      setPhotoError(error.message || "Could not upload the photo.");
    } finally {
      savingPhotoRef.current = false;
      setSavingPhoto(false);
    }
  }

  return (
    <section className="chatterbox-settings" aria-labelledby="settings-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") back();
      }}>
      <header className="chat-details-topbar settings-topbar">
        <button ref={backButton} className="chat-details-top-button" type="button" onClick={back}
          aria-label={page === "Settings" ? "Back to chats" : "Back to settings"}>
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <h2 id="settings-title">{page}</h2>
      </header>
      <div className="settings-scroll" ref={body}>
        {page === "Settings" && <>
          <div className="settings-profile">
            <div className="settings-avatar-picker">
            <span className="settings-profile-avatar" aria-hidden="true">
              {initials(name)}
              {photo && <img key={photo} src={getAttachmentUrl({ url: photo })} alt=""
                onError={(event) => { event.currentTarget.hidden = true; }} />}
            </span>
            <input ref={picker} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={changePhoto} />
            <button type="button" className="settings-camera" aria-label="Change profile photo"
              disabled={savingPhoto} onClick={() => picker.current?.click()}>
              <Camera size={18} aria-hidden="true" />
            </button>
            </div>
            {savingPhoto && <span role="status">Saving photo…</span>}
            {photoError && <span role="alert">{photoError}</span>}
            <h3>{name}</h3>
            {username && <span>@{username}</span>}
            <button type="button" onClick={() => setPage("Profile")}>View profile</button>
          </div>
          <section className="settings-group" aria-label="Account">
            <h3>Account</h3>
            <SettingsRow icon={UserRound} label={name} detail="Signed in to Chatterbox"
              onClick={() => setPage("Profile")} end={<Check size={18} aria-hidden="true" />} />
          </section>
          <section className="settings-group" aria-label="Preferences">
            <h3>Preferences</h3>
            <SettingsRow icon={theme === "dark" ? Moon : Sun} label="Appearance"
              detail={theme === "dark" ? "Dark" : "Light"}
              onClick={() => setPage("Appearance")} end={<ChevronRight size={18} aria-hidden="true" />} />
          </section>
          <section className="settings-group" aria-label="Profile and visibility">
            <h3>Profile and visibility</h3>
            {username && <SettingsRow icon={AtSign} label="Username" detail={`@${username}`}
              onClick={() => setPage("Profile")} end={<ChevronRight size={18} aria-hidden="true" />} />}
            <SettingsRow icon={CircleDot} label="Active status"
              detail={savingActiveStatus ? "Saving…" : showActiveStatus ? "On" : "Off"}
              role="switch" aria-checked={showActiveStatus} disabled={savingActiveStatus}
              onClick={() => onActiveStatusChange?.(!showActiveStatus)}
              end={<span className="settings-toggle" aria-hidden="true" />} />
          </section>
          {messageRequestsPage && (
            <section className="settings-group" aria-label="Privacy">
              <h3>Privacy</h3>
              <SettingsRow icon={Inbox} label="Message requests" detail="Review messages from new contacts"
                onClick={() => {
                  setPage("Message requests");
                  onMessageRequests?.();
                }} end={<ChevronRight size={18} aria-hidden="true" />} />
            </section>
          )}
          <section className="settings-group" aria-label="Account actions">
            <h3>Account actions</h3>
            <SettingsRow icon={LogOut} label="Log out" onClick={onLogout} />
          </section>
        </>}
        {page === "Message requests" && messageRequestsPage}
        {page === "Profile" && (
          <section className="settings-group" aria-label="Profile details">
            <SettingsRow icon={UserRound} label="Name" detail={name} />
            {username && <SettingsRow icon={AtSign} label="Username" detail={username} />}
          </section>
        )}
        {page === "Appearance" && (
          <section className="settings-group" aria-label="Theme">
            <h3>Theme</h3>
            {[{ id: "light", label: "Light", icon: Sun }, { id: "dark", label: "Dark", icon: Moon }].map((option) => (
              <SettingsRow key={option.id} icon={option.icon} label={option.label}
                aria-pressed={theme === option.id} disabled={savingTheme || theme === option.id}
                onClick={() => onThemeChange(option.id)}
                end={theme === option.id && <Check size={18} aria-hidden="true" />} />
            ))}
            {savingTheme && <p role="status">Saving your preference…</p>}
          </section>
        )}
      </div>
    </section>
  );
}
