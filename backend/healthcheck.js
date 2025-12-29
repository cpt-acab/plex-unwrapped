#!/usr/bin/env node

const http = require('http');

const options = {
  host: 'localhost',
  port: 3001,
  path: '/api/health',
  timeout: 2000,
};

const request = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', (err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});

request.on('timeout', () => {
  console.error('TIMEOUT');
  request.destroy();
  process.exit(1);
});

request.end();
