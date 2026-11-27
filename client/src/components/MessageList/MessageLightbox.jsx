
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize, Download, MoreVertical, Pencil, Sparkles, Forward, Share2, RotateCw, X } from "lucide-react";

export default function MessageLightbox({
  selectedImage,
  stackPhotos,
  onSelectPhoto,
  onClose,
  onPrevious,
  onNext,
}) {
  const [focused, setFocused] = useState(false);
  const suppressPhotoClick = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rotation, setRotation] = useState(null);
  const [status, setStatus] = useState("");
  const busy = useRef(false);
  const imageRef = useRef(null);
  const galleryRef = useRef(null);
  const swipeStart = useRef(null);
  const galleryOpen = Boolean(stackPhotos?.length);

  useLayoutEffect(() => {
    const dialog = galleryRef.current;
    if (galleryOpen && dialog && !dialog.open) dialog.showModal();
  }, [galleryOpen]);

  useEffect(() => {
    if (!selectedImage || (menuOpen && galleryOpen)) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (menuOpen) setMenuOpen(false);
        else if (rotation !== null) setRotation(null);
        else if (focused) setFocused(false);
        else closeViewer();
      } else if (event.key === "ArrowLeft" && !menuOpen && rotation === null && onPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === "ArrowRight" && !menuOpen && rotation === null && onNext) {
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
  }, [selectedImage, onClose, onPrevious, onNext, menuOpen, rotation, galleryOpen, focused]);

  function startSwipe(event) {
    suppressPhotoClick.current = false;
    if (event.pointerType !== "touch" || rotation !== null || menuOpen) return;
    if (!event.isPrimary || (!onPrevious && !onNext)) {
      swipeStart.current = null;
      return;
    }

    swipeStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function finishSwipe(event) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.id !== event.pointerId) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    suppressPhotoClick.current = Math.hypot(dx, dy) > 10;
    if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy) * 1.35) return;

    if (dx < 0) onNext?.();
    else onPrevious?.();
  }

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function download(photos) {
    if (busy.current) return;
    busy.current = true;
    setStatus("Preparing download…");
    let saved = 0;
    try {
      for (const { src, alt } of photos) {
        const response = await fetch(src);
        if (!response.ok) throw new Error("Download failed");
        saveBlob(await response.blob(), alt || "photo");
        saved += 1;
      }
      setStatus(saved > 1 ? "Downloads requested. Allow multiple downloads if prompted." : "");
    } catch {
      setStatus(saved ? `Requested ${saved} downloads before an error.` : "Could not download the photo.");
    } finally {
      busy.current = false;
    }
  }

  async function share(photos) {
    setMenuOpen(false);
    const urls = photos.map(({ src }) => new URL(src, window.location.href).href);
    try {
      if (navigator.share) {
        await navigator.share(urls.length === 1 ? { url: urls[0] } : { text: urls.join("\n") });
      } else {
        await navigator.clipboard.writeText(urls.join("\n"));
        setStatus("Photo links copied.");
      }
    } catch (error) {
      if (error.name !== "AbortError") setStatus("Could not share the photo links.");
    }
  }

  async function saveEdit() {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = imageRef.current?.currentSrc || "";
    try {
      await image.decode();
    } catch {
      setStatus("Could not load the photo for editing.");
      return;
    }
    if (!image?.naturalWidth) return;
    const canvas = document.createElement("canvas");
    const sideways = rotation % 180 !== 0;
    canvas.width = sideways ? image.naturalHeight : image.naturalWidth;
    canvas.height = sideways ? image.naturalWidth : image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    try {
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(rotation * Math.PI / 180);
      context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve));
      if (!blob) throw new Error("Image export failed");
      saveBlob(blob, "edited-photo.png");
      setRotation(null);
    } catch {
      setStatus("Could not save the edited photo.");
    }
  }

  function closeViewer() {
    setFocused(false);
    setStatus("");
    setMenuOpen(false);
    setRotation(null);
    onClose?.();
  }

  function toolbar(photos, allowFocus = false) {
    return (
      <div className="photo-viewer-tools">
        {allowFocus && <button type="button" aria-label="Focus on photo" onClick={() => setFocused(true)}>
          <Maximize size={22} />
        </button>}
        <button type="button" aria-label="Download photos" onClick={() => download(photos)}>
          <Download size={22} />
        </button>
        <button type="button" aria-label="More photo actions" aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}>
          <MoreVertical size={22} />
        </button>
      </div>
    );
  }

  function actions(photos, canEdit) {
    if (!menuOpen) return null;
    return (
      <div className="photo-viewer-menu" onClick={() => setMenuOpen(false)}>
        <section aria-label="Photo actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" disabled={!canEdit} onClick={() => {
            setMenuOpen(false);
            setRotation(0);
          }}><Pencil size={20} /> Edit</button>
          <button type="button" disabled><Sparkles size={20} /> Edit with AI <small>Unavailable</small></button>
          <button type="button" disabled><Forward size={20} /> Forward <small>Unavailable</small></button>
          <button type="button" onClick={() => share(photos)}><Share2 size={20} /> Share</button>
          <button type="button" onClick={() => setMenuOpen(false)}>Close menu</button>
        </section>
      </div>
    );
  }

  if (galleryOpen) {
    return createPortal(
      <dialog
        ref={galleryRef}
        className="message-stack-gallery"
        aria-labelledby="message-stack-title"
        onCancel={(event) => {
          event.preventDefault();
          if (menuOpen) setMenuOpen(false);
          else closeViewer();
        }}
      >
        <header>
          <button type="button" aria-label="Close photo gallery" onClick={closeViewer}>
            <X size={22} aria-hidden="true" />
          </button>
          <h2 id="message-stack-title">{stackPhotos.length} photos</h2>
          {toolbar(stackPhotos)}
        </header>
        <div className="message-stack-gallery-grid">
          {stackPhotos.map(({ message, src, alt }, index) => (
            <button type="button" key={message.id ?? message._id ?? index}
              aria-label={`Open photo ${index + 1}`} onClick={() => { setStatus(""); onSelectPhoto(message); }}>
              <img src={src} alt={alt} loading="lazy" />
            </button>
          ))}
        </div>
        {status && <p className="photo-viewer-status" role="status">{status}</p>}
        {actions(stackPhotos, false)}
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
  const photos = [{ src, alt: selectedImage.alt }];

  return createPortal(
    <div
      className={`message-lightbox${focused ? " is-focused" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Message image preview"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        if (focused) setFocused(false);
        else closeViewer();
      }}
    >
      {!focused && (
        <>
          <button type="button" className="message-lightbox-close" onClick={closeViewer}
            aria-label="Close photo preview">
            <X size={22} aria-hidden="true" />
          </button>
          {toolbar(photos, rotation === null)}
        </>
      )}

      <div className="message-lightbox-content">
        <button
          type="button"
          className="photo-focus-toggle"
          aria-label={focused ? "Exit photo focus" : "Focus on photo"}
          disabled={rotation !== null}
          onClick={(event) => {
            if (event.detail === 0 || !suppressPhotoClick.current) setFocused((value) => !value);
            suppressPhotoClick.current = false;
          }}
          onPointerDown={startSwipe}
          onPointerUp={finishSwipe}
          onPointerCancel={() => {
            swipeStart.current = null;
            suppressPhotoClick.current = true;
          }}
        >
          <img
            ref={imageRef}
            draggable={false}
            style={rotation === null ? undefined : { rotate: `${rotation}deg` }}
            src={src}
            alt={typeof selectedImage === "string" ? "Message image" : selectedImage.alt || "Message image"}
          />
        </button>

        {!focused && typeof selectedImage !== "string" && selectedImage.senderName && (
          <span>{selectedImage.senderName}</span>
        )}
      </div>
      {rotation !== null && (
        <div className="photo-viewer-edit">
          <button type="button" onClick={() => setRotation((value) => (value + 90) % 360)}>
            <RotateCw size={18} /> Rotate
          </button>
          <button type="button" onClick={saveEdit}>Save copy</button>
          <button type="button" onClick={() => setRotation(null)}>Cancel</button>
        </div>
      )}
      {!focused && status && <p className="photo-viewer-status" role="status">{status}</p>}
      {!focused && actions(photos, true)}
    </div>,
    document.body
  );
}
