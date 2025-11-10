const http = require('http');
const crypto = require('crypto');

// Generate a proper UUID v4
const uuid = crypto.randomUUID();
console.log('Using generated UUID:', uuid);

const data = JSON.stringify({
  motorcycle_id: "33333333-3333-3333-3333-333333333333",
  customer_id: uuid,
  priority: "normal",
  description: "Test service order with generated UUID"
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/service-orders',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
