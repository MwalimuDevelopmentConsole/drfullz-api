const mongoose = require("mongoose");
const { Schema } = mongoose;

const userBalLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    description: { type: String },
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: true }
);

const UserBalLog = mongoose.model("UserBalLog", userBalLogSchema);

module.exports = UserBalLog;