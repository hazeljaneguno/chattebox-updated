import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, AtSign, Check, ChevronRight, CircleDot, Inbox, LogOut, Moon, Sun, UserRound } from "lucide-react";
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
  onMessageRequests, onLogout,
}) {
  if (!isOpen) return null;
  return <OpenSettings {...{
    onClose, user, theme, onThemeChange, savingTheme, showActiveStatus,
    onActiveStatusChange, savingActiveStatus, onMessageRequests, onLogout,
  }} />;
}

function OpenSettings({
  onClose, user, theme, onThemeChange, savingTheme,
  showActiveStatus, onActiveStatusChange, savingActiveStatus,
  onMessageRequests, onLogout,
}) {
  const [page, setPage] = useState("Settings");
  const dialog = useRef(null);
  const body = useRef(null);
  const username = user?.username || "";
  const name = user?.displayName || user?.name || username || "Your account";
  const photo = user?.profilePicture;
  const back = page === "Settings" ? onClose : () => setPage("Settings");

  useLayoutEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [page]);

  return (
    <dialog ref={dialog} className="chatterbox-settings" aria-labelledby="settings-title"
      onCancel={(event) => { event.preventDefault(); back(); }}>
      <header className="settings-topbar">
        <button type="button" onClick={back} aria-label={page === "Settings" ? "Close settings" : "Back to settings"}>
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <h2 id="settings-title">{page}</h2>
      </header>
      <div className="settings-scroll" ref={body}>
        {page === "Settings" && <>
          <div className="settings-profile">
            <span className="settings-profile-avatar" aria-hidden="true">
              {initials(name)}
              {photo && <img src={getAttachmentUrl({ url: photo })} alt=""
                onError={(event) => { event.currentTarget.hidden = true; }} />}
            </span>
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
            <SettingsRow icon={CircleDot} label="Active status"
              detail={savingActiveStatus ? "Saving…" : showActiveStatus ? "On" : "Off"}
              role="switch" aria-checked={showActiveStatus} disabled={savingActiveStatus}
              onClick={() => onActiveStatusChange?.(!showActiveStatus)}
              end={<span className="settings-toggle" aria-hidden="true" />} />
          </section>
          <section className="settings-group" aria-label="Privacy and account actions">
            <h3>Privacy and account actions</h3>
            {onMessageRequests && <SettingsRow icon={Inbox} label="Message requests"
              onClick={onMessageRequests} end={<ChevronRight size={18} aria-hidden="true" />} />}
            <SettingsRow icon={LogOut} label="Log out" onClick={onLogout} />
          </section>
        </>}
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
    </dialog>
  );
}
