const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: String,
  category: String,
  content: String,
  videoUrl: String,
  media: String,
  date: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('Post', postSchema);
