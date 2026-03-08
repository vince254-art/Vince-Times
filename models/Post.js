const mongoose = require('mongoose');
const slugify = require('slugify');

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: String,
  category: String,
  content: { type: String, required: true },
  media: String,       // Cloudinary URL or other media
  caption: String,     // optional caption
  photoCredit: String, // optional photographer credit
  videoUrl: String,
  slug: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now }
});

// ✅ Auto-generate slug before validation if missing
postSchema.pre('validate', function(next) {
  if (this.title && !this.slug) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model('Post', postSchema);