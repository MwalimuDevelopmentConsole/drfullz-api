const mongoose = require("mongoose");

const baseSchema = new mongoose.Schema(
  {
    base: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    showDescription: {
      type: Boolean,
      default: false,
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model("BasePrice", baseSchema);
