const fs = require('fs');
const path = require('path');

// Path to your posts file
const postsPath = path.join(__dirname, 'data', 'posts.json');

// Load posts
let posts;
try {
  const data = fs.readFileSync(postsPath, 'utf-8');
  posts = JSON.parse(data);
} catch (err) {
  console.error('❌ Failed to read posts.json:', err.message);
  process.exit(1);
}

// Patch missing dates
let patched = 0;
posts.forEach(post => {
  if (!post.date) {
    post.date = new Date().toISOString();
    patched++;
  }
});

// Save updated posts
try {
  fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2));
  console.log(`✅ Patched ${patched} post(s) with missing date.`);
} catch (err) {
  console.error('❌ Failed to write patched posts.json:', err.message);
}
