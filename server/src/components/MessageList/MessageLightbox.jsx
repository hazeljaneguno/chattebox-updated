
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function MessageLightbox({
  selectedImage,
  onClose,
}) {
  useEffect(() => {
    if (!selectedImage) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [selectedImage, onClose]);

  if (!selectedImage) return null;

  const src =
    typeof selectedImage === "string"
      ? selectedImage
      : selectedImage.src ||
        selectedImage.url ||
        selectedImage.imageUrl;

  if (!src) return null;

  return createPortal(
    <div
      className="message-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Message image preview"
      onClick={() => onClose?.()}
    >
<button
  type="button"
  className="message-details-close"
  onClick={onClose}
  aria-label="Close details"
>
  <X size={20} />
</button>

      <div
        className="message-lightbox-content"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={src}
          alt={typeof selectedImage === "string" ? "Message image" : selectedImage.alt || "Message image"}
        />

        {typeof selectedImage !== "string" && selectedImage.senderName && (
          <span>{selectedImage.senderName}</span>
        )}
      </div>
    </div>,
    document.body
  );
}
