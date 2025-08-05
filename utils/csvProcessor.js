// utils/csvProcessor.js
const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

// Pure function to validate CSV headers
const validateCsvHeaders = (headers, expectedHeaders) => {
  const missingHeaders = expectedHeaders.filter(header => !headers.includes(header));
  const extraHeaders = headers.filter(header => !expectedHeaders.includes(header));
  
  return {
    isValid: missingHeaders.length === 0,
    missingHeaders,
    extraHeaders
  };
};

// Pure function to validate record data
const validateRecord = (record, requiredFields) => {
  const errors = [];
  
  requiredFields.forEach(field => {
    if (!record[field] || record[field].toString().trim() === '') {
      errors.push(`Missing or empty field: ${field}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Function to read and parse CSV
const parseCsvFile = async (filePath) => {
  const results = [];
  let headers = [];
  
  await pipeline(
    Readable.from(await fs.readFile(filePath)),
    csv({
      skipEmptyLines: true,
      skipLinesWithError: false
    })
      .on('headers', (headerList) => {
        headers = headerList;
      })
      .on('data', (data) => results.push(data))
  );
  
  return { headers, data: results };
};

// Function to write results to CSV
const writeResultsToCsv = async (filePath, data, headers) => {
  if (data.length === 0) {
    await fs.writeFile(filePath, '');
    return;
  }
  
  const csvWriter = createCsvWriter({
    path: filePath,
    header: headers.map(h => ({ id: h, title: h }))
  });
  
  await csvWriter.writeRecords(data);
};

// Function to write results to TXT file
const writeResultsToTxt = async (filePath, data, headers) => {
  if (data.length === 0) {
    await fs.writeFile(filePath, '');
    return;
  }
  
  let txtContent = '';
  
  // Add header
  // txtContent += headers;
  txtContent += '='.repeat(headers.join('\t').length) + '\n\n';
  
  // Add data rows
  data.forEach((row, index) => {
    txtContent += `Record ${index + 1}:\n`;
    txtContent += '-'.repeat(20) + '\n';
    
    headers.forEach(header => {
      const value = row[header] || '';
      txtContent += `${header}: ${value}\n`;
    });
    
    txtContent += '\n';
  });
  
  // Add summary
  txtContent += '\n' + '='.repeat(50) + '\n';
  txtContent += `SUMMARY\n`;
  txtContent += '='.repeat(50) + '\n';
  txtContent += `Total Records: ${data.length}\n`;
  txtContent += `Generated: ${new Date().toISOString()}\n`;
  
  await fs.writeFile(filePath, txtContent, 'utf8');
};

// Function to generate file paths
const generateFilePaths = (baseDir, historyId, prefix) => {
  const timestamp = Date.now();
  return {
    successFile: path.join(baseDir, `${prefix}_success_${historyId}_${timestamp}.csv`),
    failedFile: path.join(baseDir, `${prefix}_failed_${historyId}_${timestamp}.csv`)
  };
};

// Function to process records with rate limiting
const processRecordsWithDelay = async (records, processFn, delayMs = 100) => {
  const results = [];
  
  for (let i = 0; i < records.length; i++) {
    const result = await processFn(records[i], i);
    results.push(result);
    
    // Add delay between requests to avoid rate limiting
    if (i < records.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
};

// Function to chunk array for batch processing
const chunkArray = (array, chunkSize) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

// Function to calculate CSV processing cost
const calculateCsvCost = (recordCount, pricePerRecord) => {
  return recordCount * pricePerRecord;
};

// Function to ensure directory exists
const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

module.exports = {
  validateCsvHeaders,
  validateRecord,
  parseCsvFile,
  writeResultsToCsv,
  writeResultsToTxt,
  generateFilePaths,
  processRecordsWithDelay,
  chunkArray,
  calculateCsvCost,
  ensureDirectoryExists
};