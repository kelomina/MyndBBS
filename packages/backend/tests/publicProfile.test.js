const http = require('http');

http.get('http://localhost:3001/api/v1/user/public/testuser', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode !== 404 && res.statusCode !== 200) {
      console.error('Failed: ' + res.statusCode);
      process.exit(1);
    }
    if (!data.includes('error') && !data.includes('user')) {
      console.error('Failed: No valid JSON response');
      process.exit(1);
    }
    console.log('Pass');
  });
});
