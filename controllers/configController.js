// controllers/configController.js
const Configuration = require('../models/Configuration');
const { 
  getAllConfigurations, 
  updateConfiguration, 
  validateConfigValue 
} = require('../seeders/configSeeder');

// Error handling wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Response formatter
const formatResponse = (success, data, message = null, statusCode = 200) => ({
  success,
  data,
  message,
  statusCode
});

// Get all configurations
const getAllConfigs = asyncHandler(async (req, res) => {
  const configurations = await getAllConfigurations();
  
  const response = formatResponse(true, configurations);
  res.status(response.statusCode).json(response);
});

// Get specific configuration by key
const getConfigByKey = asyncHandler(async (req, res) => {
  const { key } = req.params;
  
  const config = await Configuration.findOne({ key });
  
  if (!config) {
    const response = formatResponse(false, null, 'Configuration not found', 404);
    return res.status(response.statusCode).json(response);
  }
  
  const response = formatResponse(true, config);
  res.status(response.statusCode).json(response);
});

// Update configuration
const updateConfig = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value, description } = req.body;
  
  if (value === undefined) {
    const response = formatResponse(false, null, 'Value is required', 400);
    return res.status(response.statusCode).json(response);
  }
  
  // Get existing configuration to validate type
  const existingConfig = await Configuration.findOne({ key });
  
  if (!existingConfig) {
    const response = formatResponse(false, null, 'Configuration not found', 404);
    return res.status(response.statusCode).json(response);
  }
  
  // Validate value type
  const isValidType = validateConfigValue(value, existingConfig.type);
  
  if (!isValidType) {
    const response = formatResponse(false, null, 
      `Invalid value type. Expected ${existingConfig.type}`, 400);
    return res.status(response.statusCode).json(response);
  }
  
  // Update configuration
  const updatedConfig = await updateConfiguration(key, value, description, req.user.id);
  
  const response = formatResponse(true, updatedConfig, 'Configuration updated successfully');
  res.status(response.statusCode).json(response);
});

// Create new configuration
const createConfig = asyncHandler(async (req, res) => {
  const { key, value, type, description } = req.body;
  
  if (!key || value === undefined || !type) {
    const response = formatResponse(false, null, 'Key, value, and type are required', 400);
    return res.status(response.statusCode).json(response);
  }
  
  // Check if configuration already exists
  const existingConfig = await Configuration.findOne({ key });
  if (existingConfig) {
    const response = formatResponse(false, null, 'Configuration with this key already exists', 409);
    return res.status(response.statusCode).json(response);
  }
  
  // Validate value type
  const isValidType = validateConfigValue(value, type);
  
  if (!isValidType) {
    const response = formatResponse(false, null, `Invalid value type. Expected ${type}`, 400);
    return res.status(response.statusCode).json(response);
  }
  
  // Validate type
  const validTypes = ['number', 'string', 'boolean', 'object'];
  if (!validTypes.includes(type)) {
    const response = formatResponse(false, null, 
      `Invalid type. Must be one of: ${validTypes.join(', ')}`, 400);
    return res.status(response.statusCode).json(response);
  }
  
  // Create configuration
  const config = new Configuration({
    key,
    value,
    type,
    description,
    updatedBy: req.user.id
  });
  
  await config.save();
  
  const response = formatResponse(true, config, 'Configuration created successfully', 201);
  res.status(response.statusCode).json(response);
});

// Delete configuration
const deleteConfig = asyncHandler(async (req, res) => {
  const { key } = req.params;
  
  const config = await Configuration.findOne({ key });
  
  if (!config) {
    const response = formatResponse(false, null, 'Configuration not found', 404);
    return res.status(response.statusCode).json(response);
  }
  
  await Configuration.deleteOne({ key });
  
  const response = formatResponse(true, null, 'Configuration deleted successfully');
  res.status(response.statusCode).json(response);
});

// Reset configuration to default value
const resetConfig = asyncHandler(async (req, res) => {
  const { key } = req.params;
  
  // Import default configurations
  const { defaultConfigurations } = require('../seeders/configSeeder');
  
  // Find default configuration
  const defaultConfig = defaultConfigurations.find(config => config.key === key);
  
  if (!defaultConfig) {
    const response = formatResponse(false, null, 'No default value found for this configuration', 404);
    return res.status(response.statusCode).json(response);
  }
  
  // Update to default value
  const updatedConfig = await updateConfiguration(
    key, 
    defaultConfig.value, 
    defaultConfig.description, 
    req.user.id
  );
  
  const response = formatResponse(true, updatedConfig, 'Configuration reset to default value');
  res.status(response.statusCode).json(response);
});

// Get configuration categories for better organization
const getConfigCategories = asyncHandler(async (req, res) => {
  const configurations = await getAllConfigurations();
  
  // Group configurations by category (based on key prefix)
  const categories = configurations.reduce((acc, config) => {
    const category = config.key.split('_')[0]; // First part before underscore
    
    if (!acc[category]) {
      acc[category] = [];
    }
    
    acc[category].push(config);
    return acc;
  }, {});
  
  const response = formatResponse(true, categories);
  res.status(response.statusCode).json(response);
});

module.exports = {
  getAllConfigs,
  getConfigByKey,
  updateConfig,
  createConfig,
  deleteConfig,
  resetConfig,
  getConfigCategories
};