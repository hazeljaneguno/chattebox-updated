import { getAttachmentUrl } from "../utils/messageHelpers.js";

export function initials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

export function colorFor(name = "") {
  const colors = ["coral", "purple", "blue", "green", "gold"];

  return (
    colors[
      [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
        colors.length
    ]
  );
}

export default function Avatar({
  name = "",
  online = false,
  small = false,
  photo,
}) {
  return (
    <div
      className={`avatar ${colorFor(name)} ${
        small ? "avatar-small" : ""
      }`}
    >
      {initials(name)}
      {photo && <img className="chatterbox-avatar-photo" key={photo} src={getAttachmentUrl({ url: photo })}
        alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}
      {online && <span className="online-dot" />}
    </div>
  );
}