const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  author: {
    type: String,
    default: 'Anonymous'
  },
  text: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['approved', 'pending', 'rejected'],
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
