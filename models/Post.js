const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: String,
  category: String,
  content: { type: String, required: true },
  media: String, // Cloudinary image URL
  caption: String, // optional: caption for image/video
  photoCredit: String, // optional: credit for photographer
  videoUrl: String,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);
