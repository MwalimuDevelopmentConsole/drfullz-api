require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const connectDB = require('../config/dbConn');
const SsnDob = require('../models/SsnDob');

// Connect to MongoDB
connectDB();

// Extract the birth year from a DOB string (supports MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
const extractDobYear = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length >= 4) return parseInt(parts[0], 10);
    const y = parseInt(parts[2], 10);
    return isNaN(y) ? null : y;
  }
  return null;
};

// Case-insensitive field getter for CSV rows
const getField = (row, fieldName) => {
  const key = Object.keys(row).find(
    (k) => k.toLowerCase().trim() === fieldName.toLowerCase()
  );
  return key ? row[key] : undefined;
};

const processCsvFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(
        csv({
          mapHeaders: ({ header }) => {
            const lowerHeader = header.toLowerCase().trim();
            const targetFieldsMap = {
              dob: "DOB",
              ssn: "SSN",
            };
            return targetFieldsMap[lowerHeader] || header.trim();
          },
        })
      )
      .on('data', (data) => {
        if (data.SSN && data.DOB) {
          results.push(data);
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

const runFix = async () => {
  try {
    const uploadsDir = path.join(__dirname, '..', 'uploads');

    // Support basic deeply nested file search in uploads and uploads/csv-documents
    const allFiles = [];
    const dirs = [uploadsDir, path.join(uploadsDir, 'csv-documents')];

    for (const d of dirs) {
      if (fs.existsSync(d)) {
        const files = fs.readdirSync(d);
        for (const file of files) {
          if (file.toLowerCase().endsWith('.csv')) {
            allFiles.push(path.join(d, file));
          }
        }
      }
    }

    console.log(`Found ${allFiles.length} CSV file(s) to process.`);

    let totalUpdated = 0;

    for (const filePath of allFiles) {
      console.log(`Processing file: ${path.basename(filePath)}`);
      try {
        const rows = await processCsvFile(filePath);

        let fileUpdates = 0;
        for (const row of rows) {
          const ssn = (getField(row, 'ssn') || '').trim();
          const csvDobString = (getField(row, 'dob') || '').trim();

          if (!ssn || !csvDobString) continue;

          console.log(ssn, csvDobString);

          // Find the SsnDob record
          const record = await SsnDob.findOne({ SSN: ssn });
          if (record) {
            const dobStr = csvDobString;
            const dobYear = extractDobYear(csvDobString);

            await SsnDob.updateOne(
              { _id: record._id },
              { $set: { DOB: dobStr, dobYear } }
            );
            fileUpdates++;
            console.log(`  → Updated SSN=${record.SSN} | DOB: "${dobStr}" | dobYear: ${dobYear}`);
          } else {
            console.warn(`  ⚠ SSN not found in DB: ${ssn}`);
          }
        }
        console.log(`  Updated ${fileUpdates} records from ${path.basename(filePath)}.`);
        totalUpdated += fileUpdates;
      } catch (err) {
        console.error(`  Error processing ${path.basename(filePath)}:`, err.message);
      }
    }

    console.log(`\nFinished! Total records updated: ${totalUpdated}`);
  } catch (err) {
    console.error("General error:", err);
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
  console.error("MongoDB Connection Error: ", err);
});
