import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Reply, MoreHorizontal, Trash2, Copy, Pin, Forward, AlarmClock, Sparkles, Pencil, Flag, BellRing, Download, X, Search, ArrowLeft, Settings2 } from "lucide-react";
import { createPortal } from "react-dom";

const DEFAULT_REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"];
const GROUPS = {
  "Smileys & People": ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏","😒","🙄","😬","😮‍💨","🤥","🫨","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","🫤","😟","🙁","☹️","😮","😯","😲","😳","🥺","🥹","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👻","👽","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾","👋","🤚","🖐️","✋","🖖","🫱","🫲","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","💪","🦾","🧠","👀","👁️","👄","👶","🧒","👦","👧","🧑","👨","👩","🧓","👴","👵","🙋","🙇","🤦","🤷","💃","🕺"],
  "Animals & Nature": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🦆","🦅","🦉","🦋","🐛","🐝","🐞","🐢","🐍","🦖","🐙","🦀","🐠","🐬","🐳","🦈","🐘","🦒","🐎","🦄","🐕","🐈","🌵","🌲","🌳","🌴","🌱","🌿","☘️","🍀","🍁","🍂","🍃","🌷","🌹","🥀","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌙","⭐","🌟","✨","⚡","🔥","🌈","☀️","🌤️","🌧️","❄️","☃️","💧","🌊"],
  "Food & Drink": ["🍎","🍏","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🥑","🥦","🥕","🌽","🌶️","🥒","🍞","🥐","🥨","🧀","🥚","🍳","🥞","🧇","🥓","🍔","🍟","🍕","🌭","🥪","🌮","🌯","🥗","🍝","🍜","🍣","🍤","🍙","🍚","🍛","🍲","🍿","🧈","🍩","🍪","🎂","🍰","🧁","🍫","🍬","🍭","🍮","🍯","🍼","🥛","☕","🫖","🍵","🧃","🥤","🧋","🍹","🍸","🍺"],
  "Activities": ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🥅","⛳","🏹","🎣","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🎿","🏂","🏋️","🚴","🏊","🏆","🥇","🥈","🥉","🎖️","🎮","🕹️","🎲","♟️","🎯","🎳","🎨","🎭","🎤","🎧","🎼","🎹","🥁","🎸","🎻","🎺","🎬","🎪","🎉","🎊","🎈","🎁","🎀","🎂"],
  "Travel & Places": ["🚗","🚕","🚌","🚎","🏎️","🚓","🚑","🚒","🚚","🚜","🏍️","🚲","🛴","🚂","🚆","🚇","🚄","✈️","🚀","🛸","🚁","⛵","🚢","⚓","🗺️","🧭","🏔️","⛰️","🌋","🏕️","🏖️","🏝️","🏜️","🏟️","🏛️","🏗️","🏠","🏡","🏢","🏥","🏫","🏰","🗼","🗽","⛪","🕌","🌁","🌃","🌆","🌇","🌉","🌌","🎡","🎢","🎠"],
  "Objects": ["⌚","📱","💻","⌨️","🖥️","🖨️","🖱️","💾","💿","📷","📸","📹","🎥","📺","📻","☎️","📞","📟","🔋","🔌","💡","🔦","🕯️","🧯","🛒","💰","💸","💵","💳","💎","⚖️","🔧","🔨","🪛","🧰","🔑","🗝️","🔒","🔓","📦","📬","✉️","📧","📨","📩","📄","📃","📑","📊","📈","📉","📅","📌","📍","📎","✂️","🖊️","✏️","📝","📚","📖","🔍","🔎","🧸","🪄"],
  "Symbols": ["❤️","🩷","🧡","💛","💚","💙","🩵","💜","🤎","🖤","🩶","🤍","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☯️","✡️","🔯","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","✅","☑️","✔️","❌","❎","➕","➖","➗","‼️","⁉️","❓","❔","❕","❗","💯","🔔","🔕","🔊","🔇","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤","🔺","🔻","⭐","🔆","♻️","🔞","🚫","⚠️","🆗","🆕","🆒","🆓"],
  "Flags": ["🏳️","🏴","🏁","🚩","🏳️‍🌈","🇵🇭","🇺🇸","🇬🇧","🇨🇦","🇦🇺","🇯🇵","🇰🇷","🇨🇳","🇹🇼","🇸🇬","🇲🇾","🇮🇩","🇹🇭","🇻🇳","🇮🇳","🇫🇷","🇩🇪","🇮🇹","🇪🇸","🇧🇷","🇲🇽","🇳🇿","🇿🇦","🇦🇪","🇸🇦"]
};
const SEARCH_WORDS = {heart:"❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🤎 🖤 🩶 🤍 💔 💕 💞 💓 💗 💖 💘",love:"❤️ 🥰 😍 😘 🫶 💕",laugh:"😂 🤣 😆 😹",happy:"😀 😃 😄 😁 😊 🥳",sad:"😢 😭 😞 ☹️",cry:"😭 😢 🥹",angry:"😡 😠 🤬",thumb:"👍 👎",like:"👍 ❤️",fire:"🔥 ❤️‍🔥",clap:"👏 🙌",party:"🎉 🥳 🎊",smile:"🙂 😊 😄 😁 😀",kiss:"😘 😚 😗",pray:"🙏",surprise:"😮 😲 😯",wow:"😮 😲 🤩",flower:"🌹 🌸 🌺 🌻 🌷",cat:"🐱 😺 😸 😹 😻",dog:"🐶 🐕"};
const RECENTS_KEY = "chatterbox-recent-reactions-v1";
const CUSTOM_KEY = "chatterbox-custom-reactions-v1";
const load = (key, fallback) => {
  try {
    const value = JSON.parse(window.localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch { return fallback; }
};
const save = (key, value) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

export default function MessageActions({
  mine, menuOpen, onReply, onEdit, onToggleMenu, showQuickReply = true,
  onDeleteForYou, onDeleteForEveryone, isImage = false, canRemoveImage = false,
  text = "", pinned = false, onAction, onReact,
}) {
  const [more, setMore] = useState(false);
  const [picker, setPicker] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [search, setSearch] = useState("");
  const [recents, setRecents] = useState(() => load(RECENTS_KEY, []));
  const [reactions, setReactions] = useState(() => {
    const saved = load(CUSTOM_KEY, DEFAULT_REACTIONS);
    return saved.length === 6 && saved.every(v => typeof v === "string")
      ? saved : DEFAULT_REACTIONS;
  });
  const [replaceIndex, setReplaceIndex] = useState(0);

  const anchorRef = useRef(null);
  const floatingMenuRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const photoMoreRef = useRef(null);
  const photoMoreOpen = menuOpen && isImage && more;

  useLayoutEffect(() => {
    const dialog = photoMoreRef.current;
    if (photoMoreOpen && dialog && !dialog.open) dialog.showModal();
  }, [photoMoreOpen]);

  useLayoutEffect(() => {
    if (!menuOpen || picker || photoMoreOpen) return;

    const menu = floatingMenuRef.current;
    const anchor = anchorRef.current?.closest(".message-bubble-surface")
      ?? anchorRef.current;
    if (!menu || !anchor) return;

    const positionMenu = () => {
      const gap = 8;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const right = left + (viewport?.width ?? window.innerWidth);
      const bottom = top + (viewport?.height ?? window.innerHeight);
      const bubble = anchor.getBoundingClientRect();

      menu.style.maxWidth = `${Math.max(0, right - left - 2 * gap)}px`;
      menu.style.maxHeight = `${Math.max(0, bottom - top - 2 * gap)}px`;

      const { width, height } = menu.getBoundingClientRect();
      const preferredLeft = mine ? bubble.right - width : bubble.left;
      const below = bubble.bottom + gap;
      const above = bubble.top - height - gap;
      const preferredTop = below + height <= bottom - gap
        || bottom - bubble.bottom >= bubble.top - top ? below : above;

      menu.style.left = `${Math.max(left + gap, Math.min(preferredLeft, right - width - gap))}px`;
      menu.style.top = `${Math.max(top + gap, Math.min(preferredTop, bottom - height - gap))}px`;
    };

    positionMenu();
    const viewport = window.visualViewport;
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    viewport?.addEventListener("resize", positionMenu);
    viewport?.addEventListener("scroll", positionMenu);

    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(positionMenu)
      : null;
    observer?.observe(anchor);
    observer?.observe(menu);

    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      viewport?.removeEventListener("resize", positionMenu);
      viewport?.removeEventListener("scroll", positionMenu);
      observer?.disconnect();
    };
  }, [menuOpen, picker, mine, photoMoreOpen]);

  useEffect(() => {
    if (!menuOpen) {
      setMore(false);
      setPicker(false);
      setCustomize(false);
      setSearch("");
    }
  }, [menuOpen]);

  const close = useCallback(() => {
    setMore(false);
    setPicker(false);
    setCustomize(false);
    setSearch("");
    if (menuOpen) onToggleMenu?.();
  }, [menuOpen, onToggleMenu]);

  useEffect(() => {
    if (!menuOpen) return;

    function handleOutsideClick(event) {
      const openPanel = picker ? emojiPickerRef.current : floatingMenuRef.current;
      if (openPanel && !openPanel.contains(event.target)) close();
    }

    function handleEscape(event) {
      if (event.key === "Escape" && !event.defaultPrevented) close();
    }

    document.addEventListener("click", handleOutsideClick, true);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("click", handleOutsideClick, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen, picker, close]);

  const react = (emoji) => {
    if (customize) {
      const updated = [...reactions];
      updated[replaceIndex] = emoji;
      setReactions(updated);
      save(CUSTOM_KEY, updated);
      setReplaceIndex(index => (index + 1) % 6);
      return;
    }
    const updated = [emoji, ...recents.filter(item => item !== emoji)].slice(0, 24);
    setRecents(updated);
    save(RECENTS_KEY, updated);
    onReact?.(emoji);
    close();
  };

  const action = async (type) => {
    try {
      if (type === "copy") {
        if (text && navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      } else if (type === "reply") onReply?.();
      else if (type === "edit") onEdit?.();
      else if (type === "delete") onDeleteForYou?.();
      else if (type === "delete-everyone") onDeleteForEveryone?.();
      else await onAction?.(type);
    } catch (error) {
      console.error("Message action failed:", error);
    } finally { close(); }
  };

  // Keep category headings, but remove the category navigation buttons.
  // Search across all groups and show only matching emojis under their headings.
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const aliasMatches = new Set();
    if (q) {
      Object.entries(SEARCH_WORDS).forEach(([word, emojis]) => {
        if (word.includes(q) || q.includes(word)) {
          emojis.split(" ").forEach(emoji => aliasMatches.add(emoji));
        }
      });
    }
    const source = [
      ...(recents.length ? [["Recently Used", recents]] : []),
      ...Object.entries(GROUPS),
    ];
    return source.map(([name, emojis]) => {
      const matching = q
        ? emojis.filter(emoji =>
            emoji.includes(search.trim()) ||
            aliasMatches.has(emoji) ||
            name.toLowerCase().includes(q)
          )
        : emojis;
      return { name, emojis: matching };
    }).filter(section => section.emojis.length > 0);
  }, [search, recents]);

  const actions = more ? [
    ["forward", Forward, "Forward"],
    ["pin", Pin, pinned ? "Unpin" : "Pin"],
    ["reminder", AlarmClock, "Set a reminder"],
    ["ai-image", Sparkles, "Make AI Image"],
    ["bump", BellRing, "Bump"],
    ...(mine ? [["edit", Pencil, "Edit"]] : [["report", Flag, "Report"]]),
    ...(mine ? [["delete-everyone", Trash2, "Delete for everyone"]] : []),
  ] : [
    ["reply", Reply, "Reply"],
    ...(isImage
      ? [["save-image", Download, "Save image"]]
      : [["copy", Copy, "Copy"], ["delete", Trash2, "Delete"]]),
  ];

  const photoMoreActions = [
    ["delete", "Delete"],
    ["reminder", "Set a reminder"],
    ["pin", pinned ? "Unpin" : "Pin"],
    ["forward", "Forward"],
    ...(canRemoveImage ? [["remove-image", "Remove image"]] : []),
    ["ai-edit", "Edit with AI"],
    ...(mine
      ? [["edit", "Edit"], ["delete-everyone", "Delete for everyone"]]
      : [["report", "Report"]]),
  ];

  const emojiPicker = (
    <div
      className="messenger-emoji-overlay"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <div className="messenger-emoji-backdrop" />
      <div
        ref={emojiPickerRef}
        className="messenger-emoji-picker"
        role="dialog"
        aria-modal="true"
        aria-label="Choose a reaction"
      >
        <div className="messenger-emoji-heading">
          <strong>{customize ? "Customize your reactions" : "Choose a reaction"}</strong>
          <button type="button" onClick={close} aria-label="Close emoji picker"><X size={19} /></button>
        </div>
        {customize ? (
          <div className="messenger-customize-area">
            <p className="messenger-emoji-help">Select a reaction slot, then choose an emoji below.</p>
            <div className="messenger-custom-slots">
              {reactions.map((emoji, i) => (
                <button type="button" key={i} className={replaceIndex === i ? "is-selected" : ""} onClick={() => setReplaceIndex(i)} aria-label={`Customize reaction ${i + 1}`}>{emoji}</button>
              ))}
            </div>
            <button className="messenger-emoji-done" type="button" onClick={() => setCustomize(false)}>Done customizing</button>
          </div>
        ) : (
          <button type="button" className="messenger-customize-link" onClick={() => { setCustomize(true); setReplaceIndex(0); }}>
            <Settings2 size={16} /> Customize your reactions
          </button>
        )}
        <label className="messenger-emoji-search">
          <Search size={17} />
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search emojis (heart, laugh, cat...)" aria-label="Search emojis" />
        </label>
        <div className="messenger-emoji-scroll" aria-label="Emoji categories">
          {sections.length ? sections.map(({ name, emojis }) => (
            <section className="messenger-emoji-section" key={name}>
              <h4 className="messenger-emoji-section-title">{name}</h4>
              <div className="messenger-emoji-grid">
                {emojis.map((emoji, index) => (
                  <button type="button" key={`${emoji}-${index}`} onClick={() => react(emoji)} title={emoji} aria-label={`React with ${emoji}`}>{emoji}</button>
                ))}
              </div>
            </section>
          )) : <p className="messenger-emoji-empty">No matching emojis. Try heart, smile, or laugh.</p>}
        </div>
      </div>
    </div>
  );

  const actionsClassName = `message-actions messenger-actions ${mine ? "messenger-actions-mine" : "messenger-actions-theirs"}`;

  return (
    <div ref={anchorRef} className={actionsClassName}>

      {showQuickReply && (
        <button
          type="button"
          className="messenger-quick-reply"
          title="Reply"
          aria-label="Reply to message"
          onClick={(event) => {
            event.stopPropagation();
            onReply?.();
          }}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <Forward size={21} strokeWidth={3} />
        </button>
      )}

      {menuOpen && !picker && !photoMoreOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={floatingMenuRef}
          className={actionsClassName}
          style={{
            position: "fixed",
            inset: "auto",
            width: "max-content",
            height: "auto",
            margin: 0,
            transform: "none",
            overflow: "auto",
            pointerEvents: "auto",
            zIndex: 10000,
          }}
          onClick={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
        >
          <div
            className="messenger-action-float"
            style={{
              position: "static",
              margin: 0,
              transform: "none",
              maxWidth: "min(88vw, 330px)",
            }}
          >
            <div className="messenger-reactions" role="group" aria-label="React to message">
              {reactions.map((emoji, i) => (
                <button type="button" key={`${i}-${emoji}`} className="messenger-reaction-button" onClick={() => react(emoji)} aria-label={`React ${emoji}`}>{emoji}</button>
              ))}
              <button type="button" className="messenger-reaction-expand" onClick={() => { setPicker(true); setCustomize(false); setSearch(""); }} aria-label="More reactions">+</button>
            </div>
            <div className="messenger-action-panel" role="menu" aria-label="Message actions">
              {more && <button type="button" role="menuitem" onClick={() => setMore(false)}><ArrowLeft size={17} /> Back</button>}
              {actions.map(([id, Icon, label]) => (
                <button type="button" role="menuitem" key={id} onClick={() => action(id)}><Icon size={17} />{label}</button>
              ))}
              {!more && <button type="button" role="menuitem" onClick={() => setMore(true)}><MoreHorizontal size={17} /> More</button>}
            </div>
          </div>
        </div>,
        document.body
      )}
      {photoMoreOpen && createPortal(
        <dialog
          ref={photoMoreRef}
          className="messenger-photo-more"
          aria-label="More photo actions"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (event.target === event.currentTarget) close();
          }}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
        >
          <div className="messenger-photo-more-content">
            <h2>More</h2>
            {photoMoreActions.map(([id, label]) => (
              <button type="button" key={id} onClick={() => action(id)}>{label}</button>
            ))}
          </div>
        </dialog>,
        document.body
      )}
      {menuOpen && picker && typeof document !== "undefined" && createPortal(emojiPicker, document.body)}
    </div>
  );
}
