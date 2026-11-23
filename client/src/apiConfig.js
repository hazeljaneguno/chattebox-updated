export function normalizeApiUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    throw new Error(
      "VITE_API_URL is missing. Set your backend URL in the environment file."
    );
  }

  if (raw.includes(",")) {
    throw new Error(
      "VITE_API_URL must contain only ONE backend URL."
    );
  }

  const url = new URL(raw);

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["/", "/api", "/api/"].includes(url.pathname)
  ) {
    throw new Error(
      "VITE_API_URL must be a valid backend origin."
    );
  }

  return url.origin;
}