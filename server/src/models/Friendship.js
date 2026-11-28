import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;
const friendshipSchema = new mongoose.Schema({
  _id: String,
  participants: { type: [ObjectId], required: true, index: true },
  requestedBy: { type: ObjectId, required: true },
  status: { type: String, enum: ["pending", "accepted", "declined"], required: true },
}, { timestamps: true });

export default mongoose.model("Friendship", friendshipSchema);
