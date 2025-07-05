#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'configs', 'raw.json');

try {
  // Read the raw.json file
  const rawData = fs.readFileSync(configPath, 'utf8');
  const data = JSON.parse(rawData);
  
  console.log('Original data structure:');
  console.log(`- Base URL: ${data.base_url}`);
  console.log(`- Number of results: ${data.results?.length || 0}`);
  
  // Check if results exist and process them
  if (data.results && Array.isArray(data.results)) {
    let removedCount = 0;
    
    data.results.forEach((result, index) => {
      if (result.hasOwnProperty('raw_content')) {
        delete result.raw_content;
        removedCount++;
        console.log(`Removed raw_content from result ${index + 1}`);
      }
    });
    
    console.log(`\nProcessed ${data.results.length} results`);
    console.log(`Removed raw_content from ${removedCount} results`);
    
    // Write the modified data back to the file
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
    console.log('\nSuccessfully updated raw.json file');
    
  } else {
    console.log('No results array found in the data');
  }
  
} catch (error) {
  console.error('Error processing raw.json:', error.message);
  process.exit(1);
} 