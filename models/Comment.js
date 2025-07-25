const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  name: String,
  comment: String,
  status: {
    type: String,
    default: 'approved'
  },
  upvotes: {
    type: Number,
    default: 0
  },
  flagged: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Comment', commentSchema);
