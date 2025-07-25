const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
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
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);
