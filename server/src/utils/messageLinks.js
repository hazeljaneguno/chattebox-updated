export const messageLinkPattern = /(?:https?:\/\/|\bwww\.)[^\s<>"']+/gi;

export function messageLink(token) {
  const label = token.replace(/[.,!?;:]+$/, "");
  const href = /^https?:\/\//i.test(label) ? label : `https://${label}`;
  try {
    return { href: new URL(href).href, label, suffix: token.slice(label.length) };
  } catch {
    return null;
  }
}

export function sharedMessageLinks(text) {
  return [...text.matchAll(messageLinkPattern)]
    .map(([token]) => messageLink(token))
    .filter(Boolean);
}
