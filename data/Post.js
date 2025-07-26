const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: String,
  category: String,
  content: String,
  videoUrl: String,
  media: {
    url: String,
    public_id: String, // Important for managing deletion in Cloudinary
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Post', postSchema);
