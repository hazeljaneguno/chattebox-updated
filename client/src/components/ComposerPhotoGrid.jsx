import { useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Check } from "lucide-react";
import "./ComposerPhotoGrid.css";

export const hasNativePhotoGrid = Capacitor.getPlatform() === "android";
const recentPhotos = registerPlugin("RecentPhotos");
let requestedGalleryAccess = false;

export default function ComposerPhotoGrid({
  chosenPhotos, onChoose, onClear, onError, disabled, onBusyChange,
}) {
  const [gallery, setGallery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [choosing, setChoosing] = useState(false);
  const [galleryError, setGalleryError] = useState("");

  const loadingRef = useRef(false);
  const activeAlbum = useRef("");

  async function load(options) {
    loadingRef.current = true;
    setLoading(true);
    setGalleryError("");
    try {
      const next = await recentPhotos.list({ albumId: activeAlbum.current, ...options });
      activeAlbum.current = next.albumId ?? "";
      setGallery(next);
    } catch (error) {
      setGallery(null);
      setGalleryError(error.message || "Could not load recent photos.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loadingRef.current) {
      const request = !requestedGalleryAccess;
      requestedGalleryAccess = true;
      load({ request });
    }

    function refresh() {
      if (document.visibilityState === "visible" && !loadingRef.current) {
        load({});
      }
    }
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  async function choose(photo) {
    setChoosing(true);
    onBusyChange(true);
    try {
      const result = photo
        ? await recentPhotos.readPhoto({ id: photo.id })
        : await recentPhotos.browse();
      if (!result?.data) return;
      const binary = atob(result.data);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      onChoose(new File([bytes], result.name, { type: result.type }), photo?.id ?? null);
    } catch (error) {
      onError(error.message || "Could not open the photo.");
    } finally {
      setChoosing(false);
      onBusyChange(false);
    }
  }

  return (
    <section className="composer-photos" aria-label="Photo gallery">
      <div className="composer-photos-actions">
        {gallery && gallery.access !== "denied" && (
          <select aria-label="Select album" value={gallery.albumId ?? ""}
            disabled={disabled || choosing || loading}
            onChange={(event) => load({ albumId: event.target.value })}>
            <option value="">All Photos</option>
            {gallery.albums?.map((album) => (
              <option key={album.id} value={album.id}>{album.name}</option>
            ))}
          </select>
        )}
        <button type="button" disabled={disabled || choosing || loading} onClick={() => choose()}>
          Browse photos
        </button>
        {gallery?.access === "limited" && (
          <button type="button" disabled={disabled || choosing || loading} onClick={() => load({ manage: true })}>
            Manage access
          </button>
        )}
      </div>
      {loading ? <p role="status">Loading photos…</p> : galleryError ? (
        <p role="status">{galleryError}</p>
      ) : gallery?.access === "denied" ? (
        <p>Use Browse photos to choose an image without gallery access.</p>
      ) : gallery?.photos.length ? (
        <div className="composer-photos-grid">
          {gallery.photos.map((photo) => (
            <button
              type="button"
              key={photo.id}
              disabled={disabled || choosing}
              aria-label={photo.name || "Select photo"}
              aria-pressed={chosenPhotos.includes(photo.id)}
              onClick={() => chosenPhotos.includes(photo.id) ? onClear(photo.id) : choose(photo)}
            >
              <img src={photo.thumbnail} alt="" />
              {chosenPhotos.includes(photo.id) && <span><Check size={15} /></span>}
            </button>
          ))}
        </div>
      ) : <p>No photos available.</p>}
    </section>
  );
}
