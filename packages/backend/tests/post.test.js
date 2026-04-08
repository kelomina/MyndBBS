const http = require('http');

http.get('http://localhost:3001/api/posts', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error('Failed to get posts: ' + res.statusCode);
      process.exit(1);
    }
    
    try {
      const posts = JSON.parse(data);
      if (!Array.isArray(posts)) {
        console.error('Failed: Expected array of posts');
        process.exit(1);
      }
      console.log('Posts fetched successfully, count: ' + posts.length);
      console.log('Pass');
    } catch (e) {
      console.error('Failed to parse JSON response');
      process.exit(1);
    }
  });
});
