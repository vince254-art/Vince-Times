require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const multer = require('multer');
const { storage } = require('./cloudinary');
const upload = multer({ storage });
const Post = require('./models/Post');
const Comment = require('./models/Comment');
const app = express();
const PORT = process.env.PORT || 3000;

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ✅ Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// ✅ Sessions
app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// ✅ Auth Middleware
const requireLogin = (req, res, next) => {
  if (req.session.loggedIn) return next();
  res.redirect('/login');
};

// ✅ Home Page
app.get('/', async (req, res) => {
  const { search = '', category = '' } = req.query;
  const filter = {
    ...(search && { title: { $regex: search, $options: 'i' } }),
    ...(category && { category }),
  };
  const posts = await Post.find(filter).sort({ date: -1 });
  res.render('index', {
    posts,
    search,
    category,
    loggedIn: req.session.loggedIn,
    title: 'Vince Times',
  });
});

// ✅ Single Post Page
app.get('/post/:id', async (req, res) => {
  const post = await Post.findById(req.params.id).lean();
  if (!post) return res.status(404).send('Post not found');

  const comments = await Comment.find({
    postId: post._id,
    status: 'approved',
  }).sort({ _id: -1 }).lean();

  const relatedPosts = await Post.find({
    _id: { $ne: post._id },
    category: post.category,
  }).limit(3).lean();

  // ✅ Format date to Nairobi timezone
  const options = {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };
  post.formattedDate = new Date(post.date).toLocaleString('en-KE', options);

  res.render('post', {
    post,
    comments,
    relatedPosts,
    loggedIn: req.session.loggedIn,
    title: post.title,
    requestUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
  });
});

// ✅ Add Comment
app.post('/post/:postId/comment', async (req, res) => {
  const newComment = new Comment({
    postId: req.params.postId,
    author: req.body.author || 'Anonymous',
    text: req.body.text || '',
    status: 'approved',
    upvotes: 0,
    flagged: false,
  });
  await newComment.save();
  res.redirect('/post/' + req.params.postId);
});

// ✅ Flag Comment
app.post('/post/:postId/comment/:commentId/flag', async (req, res) => {
  await Comment.findByIdAndUpdate(req.params.commentId, { flagged: true });
  res.redirect('/post/' + req.params.postId);
});

// ✅ Upvote Comment (AJAX)
app.post('/post/:postId/comment/:commentId/upvote', async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (comment) {
    comment.upvotes += 1;
    await comment.save();
    return res.json({ success: true, upvotes: comment.upvotes });
  }
  res.json({ success: false });
});

// ✅ Admin Dashboard
app.get('/admin', requireLogin, async (req, res) => {
  const posts = await Post.find().sort({ date: -1 });
  res.render('admin', { posts, loggedIn: true, title: 'Admin – Vince Times' });
});

// ✅ New Post Page
app.get('/admin/new', requireLogin, (req, res) => {
  res.render('new-post', { loggedIn: true, title: 'New Post – Vince Times' });
});

// ✅ Create Post
app.post('/admin/new', requireLogin, upload.single('media'), async (req, res) => {
  const newPost = new Post({
    title: req.body.title,
    category: req.body.category,
    videoUrl: req.body.videoUrl || '',
    content: req.body.content,
    date: new Date(),
    media: req.file ? req.file.path : '',
    author: req.body.author || 'Admin',
    caption: req.body.caption || '',
    photoCredit: req.body.photoCredit || '', // ✅ added
  });
  await newPost.save();
  res.redirect('/admin');
});


// ✅ Edit Post Page
app.get('/admin/edit/:id', requireLogin, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).send('Post not found');
  res.render('edit-post', { post, loggedIn: true, title: 'Edit Post – Vince Times' });
});

// ✅ Update Post
app.post('/admin/edit/:id', requireLogin, upload.single('media'), async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).send('Post not found');

  post.title = req.body.title;
  post.category = req.body.category;
  post.videoUrl = req.body.videoUrl || '';
  post.content = req.body.content;
  post.author = req.body.author?.trim() || post.author;
  post.caption = req.body.caption || '';
  post.photoCredit = req.body.photoCredit || post.photoCredit; // ✅ added
  if (req.file) post.media = req.file.path;

  await post.save();
  res.redirect('/admin');
});

// ✅ Delete Post
app.post('/admin/delete/:id', requireLogin, async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  res.redirect('/admin');
});

// ✅ Moderate Comments
app.get('/admin/comments', requireLogin, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const total = await Comment.countDocuments();
  const comments = await Comment.find()
    .sort({ _id: -1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .lean();

  res.render('admin-comments', {
    comments,
    currentPage: page,
    totalPages: Math.ceil(total / perPage),
    loggedIn: true,
    title: 'Moderate Comments – Vince Times',
  });
});

// ✅ Delete Comment
app.post('/admin/comments/:id/delete', requireLogin, async (req, res) => {
  await Comment.findByIdAndDelete(req.params.id);
  res.redirect('/admin/comments');
});

// ✅ Flag Comment (admin side)
app.post('/admin/comments/:id/flag', requireLogin, async (req, res) => {
  await Comment.findByIdAndUpdate(req.params.id, { flagged: true });
  res.redirect('/admin/comments');
});

// ✅ Login
app.get('/login', (req, res) => {
  res.render('login', { loggedIn: req.session.loggedIn, title: 'Login – Vince Times' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password') {
    req.session.loggedIn = true;
    res.redirect('/admin');
  } else {
    res.send('Invalid credentials');
  }
});

// ✅ Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ✅ 404 Fallback
app.use((_, res) => res.status(404).send('Page not found'));

// ✅ Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
