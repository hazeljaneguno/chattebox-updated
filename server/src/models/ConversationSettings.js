import mongoose from "mongoose";

const conversationSettingsSchema = new mongoose.Schema(
  {
    conversationKey: {
      type: String,
      required: true,
      unique: true,
    },
    nicknames: { type: Map, of: String, default: {} },
    background: {
      type: String,
      enum: [
        "default",
        "lavender",
        "ocean",
        "sunset",
        "forest",
        "rose",
        "mint",
        "peach",
        "night",
        "sky",
      ],
      default: "default",
    },
  },
  { timestamps: true }
);

export default mongoose.model(
  "ConversationSettings",
  conversationSettingsSchema
);