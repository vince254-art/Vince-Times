// addSlugsAtlas.js
const mongoose = require("mongoose");
const slugify = require("slugify");
const Post = require("./models/Post"); // make sure this path is correct

// Replace with your actual Atlas connection string
const atlasUri = "mongodb+srv://VinceTimes:%40Vinlee.ke4@vincetimes.jf7b5xc.mongodb.net/vincetimes";

// Connect to MongoDB Atlas
mongoose.connect(atlasUri);

// Connection events
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.once("open", async () => {
  console.log("✅ Connected to MongoDB Atlas successfully!");

  try {
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

    if (count === 0) {
      console.log("All posts already have slugs. No changes made.");
    } else {
      console.log(`✅ Finished! ${count} slug(s) added.`);
    }
  } catch (err) {
    console.error("Error updating posts:", err);
  } finally {
    mongoose.disconnect();
    console.log("Disconnected from MongoDB Atlas.");
  }
});