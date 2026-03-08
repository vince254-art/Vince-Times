const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  postSlug: String,
  author: { type: String, default: 'Anonymous' },
  text: { type: String, required: true },
  status: { type: String, default: 'approved' },
  upvotes: { type: Number, default: 0 },
  flagged: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Comment', commentSchema);