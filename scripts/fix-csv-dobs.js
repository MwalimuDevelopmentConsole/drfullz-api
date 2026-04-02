require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/dbConn');
const SsnDob = require('../models/SsnDob');

// Connect to MongoDB
connectDB();

// Convert a JS Date to MM/DD/YYYY using LOCAL date parts.
// The stored Date.toString() string includes the timezone offset (GMT+0300),
// so new Date(str) always restores the exact original local date — even though
// the UTC timestamp is one day behind (midnight EAT = 21:00 UTC previous day).
const toMMDDYYYY = (d) => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

// Fix records in DB whose DOB was stored in a malformed format:
//   - BSON Date object    → ISODate('1994-03-17T21:00:00.000Z')  (most common)
//   - JS Date.toString()  → "Fri Mar 18 1994 00:00:00 GMT+0300 (East Africa Time)"
//   - ISO 8601 string     → "1990-03-22T00:00:00.000Z"
const fixMalformedDbDobs = async () => {
  console.log('\nScanning DB for malformed DOB values...');

  const records = await SsnDob.find({
    $or: [
      // Still stored as a native BSON Date type
      { DOB: { $type: 'date' } },
      // JS Date.toString() format: starts with "Fri Mar 18 1994..."
      { DOB: { $regex: /^\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}/, $options: '' } },
      // ISO 8601 string format: starts with "1990-03-22T"
      { DOB: { $regex: /^\d{4}-\d{2}-\d{2}T/, $options: '' } },
    ]
  }).lean();

  console.log(`  Found ${records.length} malformed DOB record(s).`);

  let fixed = 0;
  for (const record of records) {
    const d = new Date(record.DOB);
    if (isNaN(d.getTime())) {
      console.warn(`  ⚠ Could not parse DOB for SSN=${record.SSN}: "${record.DOB}"`);
      continue;
    }
    const dobStr = toMMDDYYYY(d);
    const dobYear = d.getFullYear();
    // Preserve the original value as a string (record.DOB may be a Date object or a string)
    const oldDate = record.DOB instanceof Date
      ? record.DOB.toISOString()
      : String(record.DOB);
    await SsnDob.updateOne(
      { _id: record._id },
      { $set: { DOB: dobStr, dobYear, oldDate } }
    );
    fixed++;
    console.log(`  → Fixed SSN=${record.SSN} | "${record.DOB}" → "${dobStr}" | dobYear: ${dobYear}`);
  }

  console.log(`\nDone. Fixed ${fixed} malformed DOB record(s).`);
};

const runFix = async () => {
  try {
    await fixMalformedDbDobs();
  } catch (err) {
    console.error('General error:', err);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
};

mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB.');
  runFix();
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB Connection Error: ', err);
});
