// seeders/taskSeeder.js
const Task = require('../models/Task');

const defaultTasks = [
  {
    name: 'SSN-DOB-1',
    endpoint: '/createTask1',
    pricePerRequest: 1.0,
    description: 'SSN-DOB lookup type 1',
    fields: [
      { name: 'firstname', type: 'string', required: true, description: 'First name' },
      { name: 'lastname', type: 'string', required: true, description: 'Last name' },
      { name: 'address', type: 'string', required: true, description: 'Address' },
      { name: 'city', type: 'string', required: true, description: 'City' },
      { name: 'state', type: 'string', required: true, description: 'State' },
      { name: 'zip', type: 'string', required: true, description: 'ZIP code' }
    ],
    csvTemplate: {
      headers: ['firstname', 'lastname', 'address', 'city', 'state', 'zip'],
      exampleData: 'John,Doe,123 Main St,Anytown,CA,12345'
    }
  },
  {
    name: 'SSN-DOB-2',
    endpoint: '/createTask2',
    pricePerRequest: 1.0,
    description: 'SSN-DOB lookup type 2',
    fields: [
      { name: 'firstname', type: 'string', required: true, description: 'First name' },
      { name: 'lastname', type: 'string', required: true, description: 'Last name' },
      { name: 'address', type: 'string', required: true, description: 'Address' },
      { name: 'city', type: 'string', required: true, description: 'City' },
      { name: 'state', type: 'string', required: true, description: 'State' },
      { name: 'zip', type: 'string', required: true, description: 'ZIP code' }
    ],
    csvTemplate: {
      headers: ['firstname', 'lastname', 'address', 'city', 'state', 'zip'],
      exampleData: 'John,Doe,123 Main St,Anytown,CA,12345'
    }
  },
  {
    name: 'DL-Lookup',
    endpoint: '/createTaskDL',
    pricePerRequest: 1.5,
    description: 'Driver License lookup',
    fields: [
      { name: 'firstname', type: 'string', required: true, description: 'First name' },
      { name: 'lastname', type: 'string', required: true, description: 'Last name' },
      { name: 'address', type: 'string', required: true, description: 'Address' },
      { name: 'city', type: 'string', required: true, description: 'City' },
      { name: 'state', type: 'string', required: true, description: 'State' },
      { name: 'zip', type: 'string', required: true, description: 'ZIP code' },
      { name: 'dob', type: 'string', required: true, description: 'Date of birth (MM/DD/YYYY)' }
    ],
    csvTemplate: {
      headers: ['firstname', 'lastname', 'address', 'city', 'state', 'zip', 'dob'],
      exampleData: 'John,Doe,123 Main St,Anytown,CA,12345,01/15/1990'
    }
  },
  {
    name: 'SSN-DOB-DL',
    endpoint: '/createTask_SSN_DL',
    pricePerRequest: 2.0,
    description: 'Combined SSN-DOB and DL lookup (special pricing if DL not found)',
    fields: [
      { name: 'firstname', type: 'string', required: true, description: 'First name' },
      { name: 'lastname', type: 'string', required: true, description: 'Last name' },
      { name: 'address', type: 'string', required: true, description: 'Address' },
      { name: 'city', type: 'string', required: true, description: 'City' },
      { name: 'state', type: 'string', required: true, description: 'State' },
      { name: 'zip', type: 'string', required: true, description: 'ZIP code' }
    ],
    csvTemplate: {
      headers: ['firstname', 'lastname', 'address', 'city', 'state', 'zip'],
      exampleData: 'John,Doe,123 Main St,Anytown,CA,12345'
    }
  },
  {
    name: 'NAME-DOB',
    endpoint: '/createTask_NAME_DOB',
    pricePerRequest: 0.8,
    description: 'Name and DOB lookup',
    fields: [
      { name: 'name', type: 'string', required: true, description: 'First name' },
      { name: 'lastname', type: 'string', required: true, description: 'Last name' },
      { name: 'state', type: 'string', required: true, description: 'State' },
      { name: 'dob', type: 'string', required: true, description: 'Date of birth' }
    ],
    csvTemplate: {
      headers: ['name', 'lastname', 'state', 'dob'],
      exampleData: 'John,Doe,CA,01/15/1990'
    }
  },
  {
    name: 'CS',
    endpoint: '/createTask_CS',
    pricePerRequest: 1.2,
    description: 'Credit Score',
    fields: [
      { name: 'firstname', type: 'string', required: true, description: 'First name' },
      { name: 'lastname', type: 'string', required: true, description: 'Last name' },
      { name: 'address', type: 'string', required: true, description: 'Address' },
      { name: 'city', type: 'string', required: true, description: 'City' },
      { name: 'state', type: 'string', required: true, description: 'State' },
      { name: 'zip', type: 'string', required: true, description: 'ZIP code' },
      { name: 'dob', type: 'string', required: true, description: 'Date of birth (MM/DD/YYYY)' }
    ],
    csvTemplate: {
      headers: ['firstname', 'lastname', 'address', 'city', 'state', 'zip', 'dob'],
      exampleData: 'John,Doe,123 Main St,Anytown,CA,12345,01/15/1990'
    }
  }
];

const seedTasks = async () => {
  try {
    console.log('Seeding tasks...');
    
    // First, let's clean up any malformed task data
    try {
      await Task.deleteMany({});
      console.log('✓ Cleaned up existing task data');
    } catch (cleanupError) {
      console.log('- No existing tasks to clean up');
    }
    
    // Now insert fresh data
    for (const taskData of defaultTasks) {
      try {
        const task = new Task(taskData);
        await task.save();
        console.log(`✓ Task ${taskData.name} seeded successfully`);
      } catch (error) {
        console.error(`✗ Error seeding task ${taskData.name}:`, error.message);
        // Continue with other tasks even if one fails
      }
    }
    
    console.log('All tasks seeded successfully!');
  } catch (error) {
    console.error('Error seeding tasks:', error);
    throw error;
  }
};

module.exports = { seedTasks, defaultTasks };