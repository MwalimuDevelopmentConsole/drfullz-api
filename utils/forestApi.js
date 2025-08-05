// utils/forestApi.js
const axios = require('axios');

// Functional approach for API utilities
const createApiClient = (baseURL, apiKey) => {
  const client = axios.create({
    baseURL,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  return client;
};

// Pure functions for API operations
const createTaskRequest = (client) => async (endpoint, requestData) => {
  try {
    const response = await client.post(endpoint, { request: requestData });
    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
};

const getTaskResult = (client) => async (taskId) => {
  try {
    const response = await client.get(`/getTask/${taskId}`);
    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
};

// Factory function to create API service
const createForestApiService = () => {
  const baseURL = process.env.FOREST_API_BASE_URL;
  const apiKey = process.env.FOREST_API_KEY;
  
  if (!baseURL || !apiKey) {
    throw new Error('Forest API configuration missing');
  }

  const client = createApiClient(baseURL, apiKey);
  
  return {
    createTask: createTaskRequest(client),
    getTask: getTaskResult(client)
  };
};

// Task-specific formatters
const formatters = {
  'SSN-DOB-1': (data) => `${data.firstname};${data.lastname};${data.address};${data.city};${data.state};${data.zip}`,
  'SSN-DOB-2': (data) => `${data.firstname};${data.lastname};${data.address};${data.city};${data.state};${data.zip}`,
  'DL-Lookup': (data) => `${data.firstname};${data.lastname};${data.address};${data.city};${data.state};${data.zip};${data.dob}`,
  'SSN-DOB-DL': (data) => `${data.firstname};${data.lastname};${data.address};${data.city};${data.state};${data.zip}`,
  'NAME-DOB': (data) => `${data.name} ${data.lastname} (${data.state}) ${data.dob}`,
  'CS': (data) => `${data.firstname};${data.lastname};${data.address};${data.city};${data.state};${data.zip};${data.dob}`
};

const formatRequestData = (taskName, data) => {
  const formatter = formatters[taskName];
  if (!formatter) {
    throw new Error(`No formatter found for task: ${taskName}`);
  }
  return formatter(data);
};

module.exports = {
  createForestApiService,
  formatRequestData
};