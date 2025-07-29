const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: String,
  category: String,
  content: String,
  videoUrl: String,
  media: String,
  caption: String, // optional: caption for image/video
  author: {
    type: String,
    default: 'Admin'
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Post', postSchema);
