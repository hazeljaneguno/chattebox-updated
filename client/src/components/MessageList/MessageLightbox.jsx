
import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export default function MessageLightbox({
  selectedImage,
  stackPhotos,
  onSelectPhoto,
  onClose,
  onPrevious,
  onNext,
}) {
  const galleryRef = useRef(null);
  const galleryOpen = Boolean(stackPhotos?.length);

  useLayoutEffect(() => {
    const dialog = galleryRef.current;
    if (galleryOpen && dialog && !dialog.open) dialog.showModal();
  }, [galleryOpen]);

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

  if (galleryOpen) {
    return createPortal(
      <dialog
        ref={galleryRef}
        className="message-stack-gallery"
        aria-labelledby="message-stack-title"
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <header>
          <button type="button" aria-label="Close photo gallery" onClick={onClose}>
            <X size={22} aria-hidden="true" />
          </button>
          <h2 id="message-stack-title">{stackPhotos.length} photos</h2>
        </header>
        <div className="message-stack-gallery-grid">
          {stackPhotos.map(({ message, src, alt }, index) => (
            <button type="button" key={message.id ?? message._id ?? index}
              aria-label={`Open photo ${index + 1}`} onClick={() => onSelectPhoto(message)}>
              <img src={src} alt={alt} loading="lazy" />
            </button>
          ))}
        </div>
      </dialog>,
      document.body
    );
  }

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
