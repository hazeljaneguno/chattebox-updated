import mongoose from "mongoose";

const receiptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);
/* =========================================
   GROUP MESSAGE EMOJI REACTIONS
========================================= */

const reactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    emoji: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);
const groupMessageSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false, 
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      }
    ],
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The original group message being replied to
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupMessage",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "text",
        "group_call",
        "group_call_started",
        "group_call_ended",
      ],
      default: "text",
    },

    callId: {
      type: String,
      default: null,
    },

    callType: {
      type: String,
      enum: ["audio", "video"],
      default: null,
    },

    status: {
      type: String,
      enum: [
        "active",
        "ongoing",
        "in_progress",
        "ended",
        "completed",
        "cancelled",
        "failed",
      ],
    },

    startedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    text: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },

    attachment: {
      url: {
        type: String,
        default: "",
      },

      originalName: {
        type: String,
        trim: true,
        maxlength: 255,
        default: "",
      },
      mimeType: {
        type: String,
        default: "",
      },
      size: {
        type: Number,
        min: 0,
        default: 0,
      },
     
    },

/* =========================================
   DELIVERY AND READ RECEIPTS
========================================= */

deliveredTo: {
  type: [receiptSchema],
  default: [],
},

readBy: {
  type: [receiptSchema],
  default: [],
},

/* =========================================
   EMOJI REACTIONS
========================================= */

reactions: {
  type: [reactionSchema],
  default: [],
},
    },
  { timestamps: true }
);

  groupMessageSchema.pre("validate", function () {
  if (this.isDeleted) return;

  const isCallEvent = [
    "group_call",
    "group_call_started",
    "group_call_ended",
  ].includes(this.type);

  if (isCallEvent) {
    if (!this.callId?.trim()) {
      this.invalidate("callId", "A call event must have a call ID.");
    }
    return;
  }

  const hasText = Boolean(this.text?.trim());
  const hasAttachment = Boolean(this.attachment?.url);

  if (!hasText && !hasAttachment) {
    this.invalidate(
      "text",
      "A message must contain text or an attachment."
    );
  }
});

groupMessageSchema.index(
  { group: 1, callId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "group_call_ended" },
  }
);

export default mongoose.model("GroupMessage", groupMessageSchema);