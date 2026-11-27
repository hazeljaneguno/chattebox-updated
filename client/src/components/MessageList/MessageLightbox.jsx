
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export default function MessageLightbox({
  selectedImage,
  onClose,
  onPrevious,
  onNext,
}) {
  useEffect(() => {
    if (!selectedImage) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      } else if (event.key === "ArrowLeft" && onPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === "ArrowRight" && onNext) {
        event.preventDefault();
        onNext();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [selectedImage, onClose, onPrevious, onNext]);

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
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <button
        type="button"
        className="message-lightbox-close"
        onClick={onClose}
        aria-label="Close photo preview"
      >
        <X size={22} aria-hidden="true" />
      </button>

      {onPrevious && (
        <button
          type="button"
          className="message-lightbox-nav message-lightbox-previous"
          aria-label="Previous photo"
          onClick={onPrevious}
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          className="message-lightbox-nav message-lightbox-next"
          aria-label="Next photo"
          onClick={onNext}
        >
          <ChevronRight size={24} aria-hidden="true" />
        </button>
      )}

      <div className="message-lightbox-content">
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
