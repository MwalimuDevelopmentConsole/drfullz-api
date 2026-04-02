require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const connectDB = require('../config/dbConn');
const SsnDob = require('../models/SsnDob');

// Connect to MongoDB
connectDB();

const parseDOBStr = (dateStr) => {
  if (!dateStr) return new Date();
  
  const str = String(dateStr).trim();
  const parts = str.split(/[-/]/);
  
  let newDate;
  let expectedDay = null;

  if (parts.length === 3) {
    let year, month, day;
    // Format YYYY-MM-DD
    if (parts[0].length >= 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      // Format MM/DD/YYYY or DD/MM/YYYY
      month = parseInt(parts[0], 10) - 1;
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (month >= 12 && day <= 12) {
         let temp = month + 1;
         month = day - 1;
         day = temp;
      }
    }
    expectedDay = day;
    newDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
  } else {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      if (str.toUpperCase().includes("T") || str.toUpperCase().includes("Z")) {
        expectedDay = d.getUTCDate();
        newDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
      } else {
        expectedDay = d.getDate();
        newDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0));
      }
    } else {
      newDate = new Date();
    }
  }

  if (expectedDay !== null && newDate.getUTCDate() !== expectedDay) {
    throw new Error(`Invalid date encountered: parsing "${str}" shifted the day or the date is invalid (Expected day ${expectedDay}, parsed as ${newDate.getUTCDate()}).`);
  }

  return newDate;
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
          const ssn = row.SSN.trim();
          const csvDobString = row.DOB.trim();
          
          if (!ssn || !csvDobString) continue;

          // Find the SsnDob record
          const record = await SsnDob.findOne({ SSN: ssn });
          if (record) {
            const newDOB = parseDOBStr(csvDobString);
            
            // Format check simply outputs to terminal for logs
            if (record.DOB && record.DOB.getTime() !== newDOB.getTime()) {
              await SsnDob.updateOne({ _id: record._id }, { $set: { DOB: newDOB } });
              fileUpdates++;
            }
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
