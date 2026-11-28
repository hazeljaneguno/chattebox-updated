import { Fragment } from "react";
import { messageLink, messageLinkPattern } from "../utils/messageLinks.js";

const tokens = new RegExp(`(${messageLinkPattern.source}|@[a-zA-Z0-9_.-]+)`, "gi");

export default function MentionText({ text = "" }) {
  return text.split(tokens).map((part, index) => {
    if (/^@[a-zA-Z0-9_.-]+$/.test(part)) {
      return <span className="message-mention" key={index}>{part}</span>;
    }
    const link = /^(?:https?:\/\/|www\.)/i.test(part) && messageLink(part);
    if (link && index % 2 === 1) {
      return (
        <Fragment key={index}>
          <a className="message-text-link" href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
          {link.suffix}
        </Fragment>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
