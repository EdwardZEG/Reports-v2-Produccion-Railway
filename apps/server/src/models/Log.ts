import { Schema, model } from "mongoose";

const logSchema = new Schema({
  message: String,
  stack: String,
  timestamp: { type: Date, default: Date.now },
  route: String,
  method: String,
  statusCode: Number,
}, { timestamps: true });

export default model("Log", logSchema)