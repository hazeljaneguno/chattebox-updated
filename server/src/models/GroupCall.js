
import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "missed"],
      default: "pending",
    },

    invitedAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
    
    respondedAt: {
      type: Date,
      default: null,
    },

    joinedAt: {
      type: Date,
      default: null,
    },

    leftAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const groupCallSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },

    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    roomName: {
      type: String,
      required: true,
      unique: true,
    },

    callType: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "ended"],
      default: "active",
      index: true,
    },

    maxParticipants: {
      type: Number,
      default: 10,
      min: 1,
      max: 10,
    },

    invitations: {
      type: [invitationSchema],
      default: [],
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

groupCallSchema.index(
 { group: 1},
 {
    unique: true,
    partialFilterExpression: {
      status: "active",
    },
 }
);

export default mongoose.model("GroupCall", groupCallSchema);
