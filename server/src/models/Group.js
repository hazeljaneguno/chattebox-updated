
import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    background: {
  type: String,
  enum: ["default", "lavender", "ocean", "sunset", "forest", "rose", "mint", "peach", "night", "sky" ],
  default: "default",
},
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    nicknames: {
      type: Map,
      of: { type: String, trim: true, maxlength: 60 },
      default: () =>({}),
    },
    
  },
  { timestamps: true }
);

export default mongoose.model("Group", groupSchema);
