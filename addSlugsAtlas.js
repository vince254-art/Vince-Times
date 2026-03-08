// addSlugsAtlas.js
require('dotenv').config();
const mongoose = require("mongoose");
const slugify = require("slugify");
const Post = require("./models/Post");

mongoose.connect(process.env.MONGODB_URI);

mongoose.connection.once("open", async () => {
  console.log("Connected to MongoDB");

  const posts = await Post.find();
  let count = 0;

  for (let post of posts) {
    if (!post.slug) {
      post.slug = slugify(post.title, { lower: true, strict: true });
      await post.save();
      console.log(`Added slug for: ${post.title}`);
      count++;
    }
  }

  console.log(`Slugs updated: ${count}`);
  mongoose.disconnect();
});