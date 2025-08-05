// seeders/configSeeder.js
const Configuration = require('../models/Configuration');

const defaultConfigurations = [
  {
    key: 'csv_max_records',
    value: 1000,
    type: 'number',
    description: 'Maximum number of records allowed in CSV files'
  },
  {
    key: 'csv_max_file_size_mb',
    value: 10,
    type: 'number',
    description: 'Maximum CSV file size in megabytes'
  },
  {
    key: 'api_request_delay_ms',
    value: 200,
    type: 'number',
    description: 'Delay between API requests in milliseconds to avoid rate limiting'
  },
  {
    key: 'max_concurrent_csv_processing',
    value: 3,
    type: 'number',
    description: 'Maximum number of CSV files that can be processed simultaneously'
  },
  {
    key: 'csv_processing_batch_size',
    value: 10,
    type: 'number',
    description: 'Number of records to process in each batch'
  },
  {
    key: 'file_retention_days',
    value: 30,
    type: 'number',
    description: 'Number of days to keep result files before deletion'
  },
  {
    key: 'default_user_balance',
    value: 0,
    type: 'number',
    description: 'Default balance for new users'
  },
  {
    key: 'enable_email_notifications',
    value: true,
    type: 'boolean',
    description: 'Enable email notifications for completed CSV processing'
  },
  {
    key: 'forest_api_timeout_ms',
    value: 30000,
    type: 'number',
    description: 'Timeout for Forest API requests in milliseconds'
  },
  {
    key: 'csv_allowed_extensions',
    value: ['.csv'],
    type: 'object',
    description: 'Allowed file extensions for CSV uploads'
  }
];

const seedConfigurations = async () => {
  try {
    console.log('Seeding configurations...');
    
    for (const configData of defaultConfigurations) {
      const existingConfig = await Configuration.findOne({ key: configData.key });
      
      if (!existingConfig) {
        await Configuration.create(configData);
        console.log(`✓ Configuration ${configData.key} seeded successfully`);
      } else {
        console.log(`- Configuration ${configData.key} already exists, skipping`);
      }
    }
    
    console.log('Configuration seeding completed!');
  } catch (error) {
    console.error('Error seeding configurations:', error);
    throw error;
  }
};

// Function to update configuration values
const updateConfiguration = async (key, value, description = null, updatedBy = null) => {
  try {
    const config = await Configuration.findOne({ key });
    
    if (!config) {
      throw new Error(`Configuration with key '${key}' not found`);
    }
    
    config.value = value;
    if (description) config.description = description;
    if (updatedBy) config.updatedBy = updatedBy;
    
    await config.save();
    console.log(`✓ Configuration ${key} updated successfully`);
    
    return config;
  } catch (error) {
    console.error(`Error updating configuration ${key}:`, error);
    throw error;
  }
};

// Function to get all configurations for admin panel
const getAllConfigurations = async () => {
  try {
    return await Configuration.find({}).sort({ key: 1 });
  } catch (error) {
    console.error('Error fetching configurations:', error);
    throw error;
  }
};

// Function to validate configuration value based on type
const validateConfigValue = (value, type) => {
  switch (type) {
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object';
    default:
      return false;
  }
};

// Function to get configuration with fallback
const getConfigWithFallback = async (key, fallback = null) => {
  try {
    const value = await Configuration.getValue(key, fallback);
    return value;
  } catch (error) {
    console.warn(`Error getting configuration ${key}, using fallback:`, error);
    return fallback;
  }
};

module.exports = {
  seedConfigurations,
  updateConfiguration,
  getAllConfigurations,
  validateConfigValue,
  getConfigWithFallback,
  defaultConfigurations
};