require('dotenv').config();
const mongoose = require('mongoose');
const slugify = require('slugify');
const Post = require('./models/Post');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error(err));

async function addSlugs() {
  const posts = await Post.find({});
  let updated = 0;

  for (const post of posts) {
    if (!post.slug || post.slug === '') {
      post.slug = slugify(post.title, { lower: true, strict: true });
      await post.save();
      updated++;
    }
  }

  console.log(`Slugs updated: ${updated}`);
  mongoose.disconnect();
}

addSlugs();