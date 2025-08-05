// scripts/testDatabase.js
require('dotenv').config();
const mongoose = require('mongoose');

// Set mongoose options
mongoose.set('strictQuery', false);

const Task = require('../models/Task');
const User = require('../models/User');
const Transaction = require('../models/Payment');
const Configuration = require('../models/Configuration');

const testDatabase = async () => {
  try {
    console.log('🧪 Testing database connection and models...\n');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Test Task model
    console.log('\n📋 Testing Task model...');
    const taskCount = await Task.countDocuments();
    console.log(`✓ Found ${taskCount} tasks in database`);
    
    if (taskCount > 0) {
      const sampleTask = await Task.findOne();
      console.log(`✓ Sample task: ${sampleTask.name} - $${sampleTask.pricePerRequest}`);
      console.log(`✓ Fields structure: ${sampleTask.fields.length} fields defined`);
    }
    
    // Test User model
    console.log('\n👤 Testing User model...');
    const userCount = await User.countDocuments();
    console.log(`✓ Found ${userCount} users in database`);
    
    if (userCount > 0) {
      const adminUser = await User.findOne({ role: 'admin' });
      const clientUser = await User.findOne({ role: 'client' });
      
      if (adminUser) {
        console.log(`✓ Admin user: ${adminUser.email}`);
      }
      
      if (clientUser) {
        console.log(`✓ Client user: ${clientUser.email} - Balance: $${clientUser.balance}`);
      }
    }
    
    // Test Configuration model
    console.log('\n⚙️ Testing Configuration model...');
    const configCount = await Configuration.countDocuments();
    console.log(`✓ Found ${configCount} configurations in database`);
    
    if (configCount > 0) {
      const sampleConfig = await Configuration.findOne();
      console.log(`✓ Sample config: ${sampleConfig.key} = ${sampleConfig.value}`);
    }
    
    // Test Transaction model
    console.log('\n💳 Testing Transaction model...');
    const transactionCount = await Transaction.countDocuments();
    console.log(`✓ Found ${transactionCount} transactions in database`);
    
    // Test Transaction statistics method
    if (userCount > 0) {
      const clientUser = await User.findOne({ role: 'client' });
      if (clientUser) {
        const stats = await Transaction.getUserStatistics(clientUser._id);
        console.log(`✓ Transaction statistics for ${clientUser.email}:`);
        console.log(`  - Total transactions: ${stats.totalTransactions}`);
        console.log(`  - Total deposited: $${stats.totalDeposited}`);
        console.log(`  - Total spent: $${stats.totalSpent}`);
      }
    }
    
    console.log('\n🎉 All database tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔐 Database connection closed');
    process.exit(0);
  }
};

// Run if called directly
if (require.main === module) {
  testDatabase();
}

module.exports = { testDatabase };