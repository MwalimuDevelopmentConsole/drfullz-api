require('dotenv').config()
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const SsnDob = require('./models/SsnDob');

const MONGO_URI = process.env.MONGO_URI;
const BATCH_SIZE = 500; 
const UPLOADS_DIR = path.join(__dirname, 'uploads'); 
const TARGET_PREFIX = '2026-03-09';

mongoose.set('strictQuery', true);


async function runMigration() {
  try {
  // 1. Check if the uploads folder even exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      console.error(`Error: Folder "${UPLOADS_DIR}" not found.`);
      return;
    }

    await mongoose.connect(MONGO_URI);
    console.log('--- Connected to MongoDB ---');

    // 2. Filter files inside the /uploads/ directory
    const files = fs.readdirSync(UPLOADS_DIR).filter(f => 
      f.startsWith(TARGET_PREFIX) && f.endsWith('.csv')
    );

    if (files.length === 0) {
      console.log(`No CSV files starting with ${TARGET_PREFIX} found in /uploads.`);
    }

    for (const file of files) {
      const fullPath = path.join(UPLOADS_DIR, file);
      console.log(`Starting: ${file}`);
      await processLargeCsv(fullPath);
      console.log(`Completed: ${file}`);
    }

  } catch (err) {
    console.error('Critical Error:', err);
  } finally {
    await mongoose.connection.close();
    console.log('--- Migration Finished & Connection Closed ---');
  }
}

async function processLargeCsv(filePath) {
  const stream = fs.createReadStream(filePath).pipe(csv());
  let batch = [];
  let totalProcessed = 0;

  for await (const row of stream) {
    const ssn = row['SSN'];
    const secret = row['2FA_Secret']; 

    if (ssn && secret) {
      // Add a "updateOne" operation to our bulk array
      batch.push({
        updateOne: {
          filter: { SSN: ssn },
          update: { $set: { twoFA: secret } }
        }
      });
    }

    // When batch is full, commit to DB
    if (batch.length >= BATCH_SIZE) {
      await SsnDob.bulkWrite(batch);
      totalProcessed += batch.length;
      console.log(`Processed ${totalProcessed} records...`);
      batch = []; // Clear batch
    }
  }

  // Catch any remaining records in the last batch
  if (batch.length > 0) {
    await SsnDob.bulkWrite(batch);
    totalProcessed += batch.length;
  }
  
  console.log(`Total records updated in ${filePath}: ${totalProcessed}`);
}

runMigration();