
import { useEffect, useRef, useState } from "react";
import {
  X,
  ArrowLeft,
  ChevronRight,
  Sun,
  Moon,
  Check,
  CircleDot,
  MessageCircle,
  LoaderCircle,
} from "lucide-react";
import "./SettingsModal.css";

function SettingsModal({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  savingTheme = false,
  showActiveStatus = true,
  onActiveStatusChange,
  savingActiveStatus = false,
  showTypingIndicator = true,
  onTypingIndicatorChange,
}) {
  const [typingPageOpen, setTypingPageOpen] = useState(false);
  const backButtonRef = useRef(null);
  const typingPageButtonRef = useRef(null);
  const restoreTypingPageFocus = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setTypingPageOpen(false);
      restoreTypingPageFocus.current = false;
    } else if (typingPageOpen) {
      backButtonRef.current?.focus();
      restoreTypingPageFocus.current = true;
    } else if (restoreTypingPageFocus.current) {
      typingPageButtonRef.current?.focus();
      restoreTypingPageFocus.current = false;
    }
  }, [isOpen, typingPageOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event) {
      if (event.key === "Escape") {
        if (typingPageOpen) setTypingPageOpen(false);
        else onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, typingPageOpen]);

  if (!isOpen) return null;

  const themes = [
    {
      id: "light",
      label: "Light",
      description: "A bright and clean appearance",
      icon: Sun,
    },
    {
      id: "dark",
      label: "Dark",
      description: "A comfortable appearance for low light",
      icon: Moon,
    },
  ];

  return (
    <div
      className="settings-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        {typingPageOpen ? (
          <>
            <header className="settings-header typing-indicator-header">
              <button
                ref={backButtonRef}
                type="button"
                className="settings-close"
                onClick={() => setTypingPageOpen(false)}
                aria-label="Back to Settings"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 id="settings-title">Typing indicator</h2>
            </header>

            <div className="settings-content">
              <div className="active-status-option typing-indicator-option">
                <div className="active-status-description">
                  <strong id="typing-indicator-label">Show typing indicator</strong>
                  <small id="typing-indicator-description">
                    {showTypingIndicator
                      ? "Others can see when you're composing a message."
                      : "Your typing indicator is hidden from others."}
                  </small>
                </div>

                <button
                  type="button"
                  className={`active-status-switch ${showTypingIndicator ? "enabled" : ""}`}
                  role="switch"
                  aria-checked={showTypingIndicator}
                  aria-labelledby="typing-indicator-label"
                  aria-describedby="typing-indicator-description"
                  onClick={() => onTypingIndicatorChange(!showTypingIndicator)}
                >
                  <span className="active-status-switch-thumb" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="settings-header">
              <div>
                <h2 id="settings-title">Settings</h2>
                <p>Customize your Chatterbox experience.</p>
              </div>

              <button
                type="button"
                className="settings-close"
                onClick={onClose}
                aria-label="Close settings"
              >
                <X size={20} />
              </button>
            </header>

            <div className="settings-content">
              {/* Appearance */}
              <div className="settings-section-heading">
                <h3>Appearance</h3>
                <p>Choose how Chatterbox looks on your device.</p>
              </div>

              <div className="theme-options">
                {themes.map((item) => {
                  const Icon = item.icon;
                  const isSelected = theme === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`theme-option ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() => onThemeChange(item.id)}
                      disabled={savingTheme || isSelected}
                      aria-pressed={isSelected}
                    >
                      <span className="theme-icon">
                        <Icon size={22} />
                      </span>

                      <span className="theme-description">
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>

                      {isSelected && (
                        <span className="theme-check">
                          <Check size={17} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {savingTheme && (
                <p className="settings-saving">
                  Saving your preference...
                </p>
              )}

              {/* Active Status */}
              <div className="settings-section-heading active-status-heading">
                <h3>Privacy</h3>
                <p>Manage how others see your activity.</p>
              </div>

              <div className="active-status-option">
                <span className="active-status-icon">
                  <CircleDot size={22} />
                </span>

                <div className="active-status-description">
                  <strong>Active Status</strong>
                  <small>
                    Let others see when you're active on Chatterbox.
                  </small>
                </div>

                <button
                  type="button"
                  className={`active-status-switch ${
                    showActiveStatus ? "enabled" : ""
                  }`}
                  role="switch"
                  aria-checked={showActiveStatus}
                  aria-label="Show my active status"
                  disabled={savingActiveStatus}
                  onClick={() =>
                    onActiveStatusChange?.(!showActiveStatus)
                  }
                >
                  <span className="active-status-switch-thumb" />
                </button>
              </div>

              {savingActiveStatus && (
                <p className="settings-saving">
                  <LoaderCircle size={14} className="settings-spinner" />
                  Saving Active Status...
                </p>
              )}

              <p className="active-status-note">
                {showActiveStatus
                  ? "Others can see when you're online and when you were last active."
                  : "Your online and last-active status is hidden from others."}
              </p>

              <button
                ref={typingPageButtonRef}
                type="button"
                className="active-status-option typing-indicator-link"
                onClick={() => setTypingPageOpen(true)}
              >
                <span className="active-status-icon" aria-hidden="true">
                  <MessageCircle size={22} />
                </span>
                <span className="active-status-description">
                  <strong>Typing indicator</strong>
                  <small>{showTypingIndicator ? "On" : "Off"}</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default SettingsModal;
