import {
  PhoneOff,
  Users,
  CircleDot,
} from "lucide-react";

import {
  RoomContext,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";

import "@livekit/components-styles";
import "./GroupCallModal.css";

export default function GroupCallModal({
  call,
  room,
  onClose,
}) {
  if (!call || !room) return null;

  const handleLeave = () => {
    onClose?.();
  };

  return (
    <div className="group-call-overlay">
      <div className="group-call-modal">

        {/* Meeting header */}
        <header className="group-call-header">

          <div className="group-call-heading">
            <div className="group-call-heading-icon">
              <Users size={21} />
            </div>

            <div>
              <h2>
                {call.groupName || "Chatterbox Meeting"}
              </h2>

              <p>
                {call.callType === "audio"
                  ? "Audio meeting"
                  : "Video meeting"}
                {" · "}
                Up to {call.maxParticipants || 10} participants
              </p>
            </div>
          </div>

          <div className="group-call-header-actions">

            <div className="group-call-live">
              <CircleDot size={13} />
              LIVE
            </div>

            <button
              type="button"
              className="group-call-close"
              onClick={handleLeave}
              aria-label="Leave meeting"
            >
              <PhoneOff size={18} />
              <span>Leave</span>
            </button>

          </div>
        </header>

        {/* LiveKit meeting room */}
        <RoomContext.Provider value={room}>
          <main className="group-call-room">
            <RoomAudioRenderer />
            <VideoConference />
          </main>
        </RoomContext.Provider>

      </div>
    </div>
  );
}
