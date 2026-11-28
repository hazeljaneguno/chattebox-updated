import { useEffect, useRef } from "react";
import "./ChatScreen.css";

export default function ChatScreen({ label, onBack, children, embedded = false }) {
  const dialog = useRef(null);

  useEffect(() => {
    const screen = dialog.current;
    if (!screen) return;
    const viewport = window.visualViewport;
    const fitViewport = () => {
      if (viewport) screen.style.setProperty("--chat-screen-height", `${viewport.height}px`);
    };
    fitViewport();
    viewport?.addEventListener("resize", fitViewport);
    screen.showModal();
    screen.querySelector('input[type="search"]')?.focus();
    return () => {
      viewport?.removeEventListener("resize", fitViewport);
      screen.close();
    };
  }, [embedded]);

  if (embedded) {
    return (
      <section className="chat-screen chat-screen-embedded" aria-label={label}>
        <div className="chat-screen-layout">{children}</div>
      </section>
    );
  }

  return (
    <dialog ref={dialog} className="chat-screen" aria-label={label} onCancel={(event) => {
      event.preventDefault();
      onBack();
    }}>
      <div className="chat-screen-layout">{children}</div>
    </dialog>
  );
}
