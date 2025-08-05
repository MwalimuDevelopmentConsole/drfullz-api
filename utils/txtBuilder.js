// Core functional utilities
const pipe = (...fns) => (value) => fns.reduce((acc, fn) => fn(acc), value);
const compose = (...fns) => (value) => fns.reduceRight((acc, fn) => fn(acc), value);
const curry = (fn) => (...args) => args.length >= fn.length ? fn(...args) : curry(fn.bind(null, ...args));

// Data analysis functions
const getAllKeys = (data) => 
  data.reduce((keys, item) => 
    new Set([...keys, ...Object.keys(flattenObject(item))]), new Set());

const flattenObject = (obj, prefix = '') => 
  Object.keys(obj).reduce((acc, key) => {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      return { ...acc, ...flattenObject(value, newKey) };
    }
    return { ...acc, [newKey]: value };
  }, {});

const getNestedValue = curry((path, obj) => 
  path.split('.').reduce((current, key) => current?.[key], obj));

const inferDataType = (value) => {
  if (value instanceof Date) return 'date';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string' && /^\d+$/.test(value)) return 'id';
  if (typeof value === 'string' && value.includes('@')) return 'email';
  if (typeof value === 'string' && /^\$\d+/.test(value)) return 'currency';
  return 'string';
};

// Formatting functions
const formatValue = curry((type, value) => {
  if (value === null || value === undefined) return '';
  
  const formatters = {
    date: (val) => val instanceof Date ? val.toLocaleDateString() : new Date(val).toLocaleDateString(),
    number: (val) => typeof val === 'number' ? val.toLocaleString() : val,
    currency: (val) => typeof val === 'number' ? `$${val.toFixed(2)}` : val,
    boolean: (val) => val ? 'Yes' : 'No',
    email: (val) => val.toLowerCase(),
    id: (val) => val,
    string: (val) => String(val)
  };
  
  return (formatters[type] || formatters.string)(value);
});

const createColumnSchema = (data) => {
  const keys = [...getAllKeys(data)];
  const sampleSize = Math.min(10, data.length);
  const samples = data.slice(0, sampleSize);
  
  return keys.map(key => {
    const values = samples.map(getNestedValue(key)).filter(v => v !== null && v !== undefined);
    const inferredType = values.length > 0 ? inferDataType(values[0]) : 'string';
    const maxLength = Math.max(
      key.split('.').pop().length, // Header length
      ...values.map(v => String(formatValue(inferredType, v)).length),
      8 // Minimum width
    );
    
    return {
      key,
      header: key.split('.').pop().replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      type: inferredType,
      width: Math.min(maxLength + 2, 30), // Max width of 30
      getValue: getNestedValue(key),
      format: formatValue(inferredType)
    };
  });
};

// Table generation functions
const padString = curry((width, alignment, str) => {
  const cleanStr = String(str || '').slice(0, width);
  if (alignment === 'right') return cleanStr.padStart(width);
  if (alignment === 'center') {
    const padding = width - cleanStr.length;
    const leftPad = Math.floor(padding / 2);
    return cleanStr.padStart(cleanStr.length + leftPad).padEnd(width);
  }
  return cleanStr.padEnd(width);
});

const createTableRow = curry((schema, rowData) => 
  schema
    .map(col => padString(col.width, 'left', col.format(col.getValue(rowData))))
    .join(' | '));

const createHeaderRow = (schema) => 
  schema
    .map(col => padString(col.width, 'left', col.header))
    .join(' | ');

const createSeparatorRow = (schema) => 
  schema
    .map(col => '-'.repeat(col.width))
    .join('-+-');

const generateTable = (data, schema) => {
  if (!data.length) return 'No data available\n';
  
  const header = createHeaderRow(schema);
  const separator = createSeparatorRow(schema);
  const rows = data.map(createTableRow(schema));
  
  return [header, separator, ...rows].join('\n') + '\n';
};

// Document structure functions
const createDocumentHeader = (title, metadata = {}) => {
  const separator = '='.repeat(80);
  const timestamp = new Date().toLocaleString();
  
  const metadataLines = Object.entries(metadata)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}: ${value}`);
  
  return [
    separator,
    title.toUpperCase(),
    separator,
    `Generated: ${timestamp}`,
    ...metadataLines,
    separator,
    ''
  ].join('\n');
};

const createDocumentFooter = (summary = {}) => {
  const separator = '='.repeat(80);
  
  const summaryLines = Object.entries(summary)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${value}`);
  
  return [
    '',
    separator,
    ...summaryLines,
    'Document generated successfully',
    separator
  ].join('\n');
};

// Statistics functions
const generateStats = (data, schema) => {
  const totalRecords = data.length;
  const numericColumns = schema.filter(col => col.type === 'number');
  
  const stats = {
    'Total Records': totalRecords,
    'Columns': schema.length
  };
  
  // Add numeric summaries
  numericColumns.forEach(col => {
    const values = data.map(col.getValue).filter(v => typeof v === 'number');
    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      stats[`${col.header} Total`] = formatValue('currency', sum);
      stats[`${col.header} Average`] = formatValue('currency', avg);
    }
  });
  
  return stats;
};

// Main builder functions
const buildTextDocument = curry((config, data) => {
  const {
    title = 'Data Report',
    metadata = {},
    includeStats = true,
    customSchema = null
  } = config;
  
  if (!Array.isArray(data) || data.length === 0) {
    return createDocumentHeader(title, metadata) + 'No data provided\n' + createDocumentFooter();
  }
  
  const schema = customSchema || createColumnSchema(data);
  const stats = includeStats ? generateStats(data, schema) : {};
  
  return pipe(
    () => createDocumentHeader(title, { ...metadata, 'Total Records': data.length }),
    (header) => header + generateTable(data, schema),
    (content) => content + createDocumentFooter(stats)
  )();
});

// Convenience functions
const quickBuild = buildTextDocument({});
const buildWithTitle = curry((title, data) => buildTextDocument({ title }, data));
const buildWithMetadata = curry((metadata, data) => buildTextDocument({ metadata }, data));

// Filter and transform utilities
const filterData = curry((predicate, data) => data.filter(predicate));
const transformData = curry((transformer, data) => data.map(transformer));
const sortData = curry((compareFn, data) => [...data].sort(compareFn));

// Composition helpers
const withFilters = (...filters) => (data) => 
  filters.reduce((acc, filter) => filter(acc), data);

const buildReport = (title, transformations = []) => 
  pipe(
    ...transformations,
    buildWithTitle(title)
  );

// Export main utilities
const TxtBuilder = {
  // Core functions
  build: buildTextDocument,
  quickBuild,
  buildWithTitle,
  buildWithMetadata,
  
  // Data manipulation
  filter: filterData,
  transform: transformData,
  sort: sortData,
  withFilters,
  
  // Advanced builders
  buildReport,
  
  // Utilities
  pipe,
  compose,
  curry,
  
  // Schema creation for custom formatting
  createSchema: createColumnSchema,
  formatValue
};

module.exports = TxtBuilder;

// Usage Examples:
/*
// Basic usage
const data = [
  { id: 1, name: 'John Doe', email: 'john@example.com', balance: 1000.50, active: true },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', balance: 2500.75, active: false }
];

// Simple build
const txtContent = TxtBuilder.quickBuild(data);

// With title and metadata
const txtContent2 = TxtBuilder.build({
  title: 'User Report',
  metadata: { 
    department: 'Sales',
    generatedBy: 'Admin',
    filterApplied: 'Active users only'
  }
}, data);

// Using functional composition
const processedReport = TxtBuilder.buildReport(
  'Filtered User Report',
  [
    TxtBuilder.filter(user => user.active),
    TxtBuilder.sort((a, b) => b.balance - a.balance),
    TxtBuilder.transform(user => ({ ...user, balanceFormatted: `$${user.balance}` }))
  ]
)(data);

// Advanced pipeline
const advancedReport = pipe(
  TxtBuilder.filter(user => user.balance > 1000),
  TxtBuilder.sort((a, b) => a.name.localeCompare(b.name)),
  TxtBuilder.buildWithTitle('High Balance Users')
)(data);
*/