import { useEffect, useRef } from "react";
import {
  Reply,
  Pencil,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

export default function MessageActions({
  mine,
  menuOpen,
  onReply,
  onEdit,
  onToggleMenu,
  onDeleteForYou,
  onDeleteForEveryone,
}) {
  const optionsRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handleOutsideTap(event) {
      const options = optionsRef.current;

      if (options && !options.contains(event.target)) {
        onToggleMenu?.();
      }
    }

    document.addEventListener("pointerdown", handleOutsideTap, true);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideTap, true);
    };
  }, [menuOpen, onToggleMenu]);

  return (
    <div className="message-actions">
      {!mine && (
        <button
          type="button"
          className="message-action-icon reply-message-button"
          onClick={onReply}
          title="Reply to message"
          aria-label="Reply to message"
        >
          <Reply size={16} />
        </button>
      )}

      {mine && (
        <button
          type="button"
          className="message-action-icon edit-message-button"
          onClick={onEdit}
          title="Edit message"
          aria-label="Edit message"
        >
          <Pencil size={15} />
        </button>
      )}

      <div className="message-options" ref={optionsRef}>
        <button
          type="button"
          className="message-action-icon options-message-button"
          onClick={onToggleMenu}
          title="Message options"
          aria-label="Message options"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal size={17} />
        </button>

        {menuOpen && (
          <div className="message-options-menu">
            <button type="button" onClick={onDeleteForYou}>
              <Trash2 size={15} />
              Delete for you
            </button>

            {mine && (
              <button
                type="button"
                className="delete-everyone-option"
                onClick={onDeleteForEveryone}
              >
                <Trash2 size={15} />
                Delete for everyone
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}