
import mongoose from "mongoose";

const { Schema } = mongoose;

/* =========================================
   DELIVERY / READ RECEIPTS
========================================= */

const recipientSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
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
   EMOJI REACTIONS
========================================= */

const reactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
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

/* =========================================
   MESSAGE SCHEMA
========================================= */

const messageSchema = new Schema(
  {
    // Conversation identifier
    conversationKey: {
      type: String,
      required: true,
      index: true,
    },

    // Sender
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Private message recipient
    // Null for group messages
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Group identifier
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      default: null,
      index: true,
    },

    isGroup: {
      type: Boolean,
      default: false,
    },

    // Message type
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

    // Text content
    text: {
      type: String,
      default: "",
      trim: true,
      maxlength: 4000,
    },

    // Attachments
    attachment: {
      url: {
        type: String,
        default: null,
      },

      originalName: {
        type: String,
        default: "",
      },

      mimeType: {
        type: String,
        default: "",
      },

      size: {
        type: Number,
        default: 0,
      },
    },

    // Reply to another message
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    /* =====================================
       EMOJI REACTIONS
    ===================================== */

    reactions: {
      type: [reactionSchema],
      default: [],
    },

    /* =====================================
       GROUP CALL INFORMATION
    ===================================== */

    callId: {
      type: String,
      default: null,
      index: true,
    },

    callType: {
      type: String,
      enum: ["audio", "video", null],
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
        null,
      ],
      default: null,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    /* =====================================
       MESSAGE DELIVERY
    ===================================== */

    deliveredTo: {
      type: [recipientSchema],
      default: [],
    },

    readBy: {
      type: [recipientSchema],
      default: [],
    },

    /* =====================================
       DELETE MESSAGE
    ===================================== */

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    deletedFor: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

/* =========================================
   INDEXES
========================================= */

messageSchema.index({
  conversationKey: 1,
  createdAt: -1,
});

messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, createdAt: -1 });

messageSchema.index({
  groupId: 1,
  createdAt: -1,
});

messageSchema.index({
  groupId: 1,
  callId: 1,
});

/* =========================================
   EXPORT
========================================= */

export default mongoose.model(
  "Message",
  messageSchema
);
