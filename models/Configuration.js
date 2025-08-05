// models/Configuration.js
const mongoose = require('mongoose');

const configurationSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: mongoose.Schema.Types.Mixed,
  description: String,
  type: {
    type: String,
    enum: ['number', 'string', 'boolean', 'object'],
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

configurationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get configuration value
configurationSchema.statics.getValue = async function(key, defaultValue = null) {
  const config = await this.findOne({ key });
  return config ? config.value : defaultValue;
};

// Static method to set configuration value
configurationSchema.statics.setValue = async function(key, value, type, description, updatedBy) {
  return this.findOneAndUpdate(
    { key },
    { value, type, description, updatedBy },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('Configuration', configurationSchema);