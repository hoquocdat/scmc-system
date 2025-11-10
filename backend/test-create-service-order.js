const http = require('http');

const data = JSON.stringify({
  motorcycle_id: "33333333-3333-3333-3333-333333333333",
  customer_id: "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  priority: "normal",
  description: "Test service order"
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
