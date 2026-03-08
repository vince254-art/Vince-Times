require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const multer = require('multer');
const { storage } = require('./cloudinary');
const upload = multer({ storage });
const Post = require('./models/Post');
const Comment = require('./models/Comment');
const { SitemapStream, streamToPromise } = require('sitemap');
const slugify = require('slugify');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
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
  try {
    const { search = '', category = '' } = req.query;
    const filter = {
      ...(search && { title: { $regex: search, $options: 'i' } }),
      ...(category && { category }),
    };
    const posts = await Post.find(filter).sort({ date: -1 }).lean();
    res.render('index', { posts, search, category, loggedIn: req.session.loggedIn, title: 'Vince Times' });
  } catch (err) {
    console.error('Error loading home page:', err);
    res.status(500).send('Server error');
  }
});

// ✅ View Single Post by Slug or ID
app.get('/post/:identifier', async (req, res) => {
  try {
    const idOrSlug = req.params.identifier;
    let post = await Post.findOne({ slug: idOrSlug }).lean();

    // fallback to ObjectId if no slug matches
    if (!post && mongoose.Types.ObjectId.isValid(idOrSlug)) {
      post = await Post.findById(idOrSlug).lean();
    }

    if (!post) return res.status(404).send('Post not found');

    const comments = await Comment.find({ postId: post._id }).lean();
    const relatedPosts = await Post.find({ _id: { $ne: post._id }, category: post.category }).limit(3).lean();

    post.formattedDate = new Date(post.date).toLocaleString('en-KE', {
      timeZone: 'Africa/Nairobi', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    res.render('post', { 
      post, 
      comments, 
      relatedPosts, 
      loggedIn: req.session.loggedIn, 
      title: post.title,
      requestUrl: req.protocol + '://' + req.get('host') + req.originalUrl
    });
  } catch (err) {
    console.error('Error fetching post:', err);
    res.status(500).send('Server error');
  }
});

// ✅ Add Comment
app.post('/post/:slug/comment', async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug });
    if (!post) return res.status(404).send('Post not found');

    const newComment = new Comment({
      postId: post._id,
      author: req.body.author || 'Anonymous',
      text: req.body.text || '',
      status: 'approved',
      upvotes: 0,
      flagged: false,
    });
    await newComment.save();
    res.redirect('/post/' + req.params.slug);
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).send('Server error');
  }
});

// ✅ Flag & Upvote Comment
app.post('/post/:slug/comment/:commentId/flag', async (req, res) => {
  try {
    await Comment.findByIdAndUpdate(req.params.commentId, { flagged: true });
    res.redirect('/post/' + req.params.slug);
  } catch (err) {
    console.error('Error flagging comment:', err);
    res.status(500).send('Server error');
  }
});

app.post('/post/:slug/comment/:commentId/upvote', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (comment) {
      comment.upvotes += 1;
      await comment.save();
      return res.json({ success: true, upvotes: comment.upvotes });
    }
    res.json({ success: false });
  } catch (err) {
    console.error('Error upvoting comment:', err);
    res.json({ success: false });
  }
});

// ✅ Admin Dashboard
app.get('/admin', requireLogin, async (req, res) => {
  const posts = await Post.find().sort({ date: -1 }).lean();
  res.render('admin', { posts, loggedIn: true, title: 'Admin – Vince Times' });
});

// ✅ New Post
app.get('/admin/new', requireLogin, (req, res) => res.render('new-post', { loggedIn: true, title: 'New Post – Vince Times' }));

app.post('/admin/new', requireLogin, upload.single('media'), async (req, res) => {
  try {
    const newPost = new Post({
      title: req.body.title,
      slug: slugify(req.body.title, { lower: true, strict: true }),
      category: req.body.category,
      videoUrl: req.body.videoUrl || '',
      content: req.body.content,
      date: new Date(),
      media: req.file ? req.file.path : '',
      author: req.body.author || 'Admin',
      caption: req.body.caption || '',
      photoCredit: req.body.photoCredit || '',
    });
    await newPost.save();
    res.redirect('/admin');
  } catch (err) {
    console.error('Error creating new post:', err);
    res.status(500).send('Server error');
  }
});

// ✅ Edit Post
app.get('/admin/edit/:id', requireLogin, async (req, res) => {
  const post = await Post.findById(req.params.id).lean();
  if (!post) return res.status(404).send('Post not found');
  res.render('edit-post', { post, loggedIn: true, title: 'Edit Post – Vince Times' });
});

app.post('/admin/edit/:id', requireLogin, upload.single('media'), async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).send('Post not found');

    post.title = req.body.title;
    post.slug = slugify(req.body.title, { lower: true, strict: true });
    post.category = req.body.category;
    post.videoUrl = req.body.videoUrl || '';
    post.content = req.body.content;
    post.author = req.body.author?.trim() || post.author;
    post.caption = req.body.caption || '';
    post.photoCredit = req.body.photoCredit || post.photoCredit;
    if (req.file) post.media = req.file.path;

    await post.save();
    res.redirect('/admin');
  } catch (err) {
    console.error('Error editing post:', err);
    res.status(500).send('Server error');
  }
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

app.post('/admin/comments/:id/delete', requireLogin, async (req, res) => {
  await Comment.findByIdAndDelete(req.params.id);
  res.redirect('/admin/comments');
});

app.post('/admin/comments/:id/flag', requireLogin, async (req, res) => {
  await Comment.findByIdAndUpdate(req.params.id, { flagged: true });
  res.redirect('/admin/comments');
});

// ✅ Login / Logout
app.get('/login', (req, res) => res.render('login', { loggedIn: req.session.loggedIn, title: 'Login – Vince Times' }));
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password') {
    req.session.loggedIn = true;
    res.redirect('/admin');
  } else res.send('Invalid credentials');
});
app.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

// ✅ Static Pages
app.get('/privacy', (req, res) => res.render('privacy', { loggedIn: req.session.loggedIn, title: 'Privacy Policy – Vince Times' }));
app.get('/terms', (req, res) => res.render('terms', { loggedIn: req.session.loggedIn, title: 'Terms & Conditions – Vince Times' }));
app.get('/affiliate', (req, res) => res.render('affiliate', { loggedIn: req.session.loggedIn, title: 'Affiliate Disclosure – Vince Times' }));

// ✅ Sitemap
app.get('/sitemap.xml', async (req, res) => {
  try {
    const smStream = new SitemapStream({ hostname: "https://vince-times.onrender.com" });

    // Static pages
    const staticPages = [
      { loc: "/", changefreq: "daily", priority: 1.0 },
      { loc: "/privacy", changefreq: "monthly", priority: 0.3 },
      { loc: "/terms", changefreq: "monthly", priority: 0.3 },
      { loc: "/affiliate", changefreq: "monthly", priority: 0.3 },
    ];
    staticPages.forEach(page => smStream.write(page));

    // Posts
    const posts = await Post.find({ slug: { $exists: true, $ne: "" } });
    posts.forEach(post => smStream.write({ url: `/post/${post.slug}`, changefreq: 'weekly', priority: 0.8 }));

    smStream.end();
    const sitemap = await streamToPromise(smStream);
    res.header('Content-Type', 'application/xml');
    res.send(sitemap.toString());
  } catch (err) {
    console.error('Error generating sitemap:', err);
    res.status(500).send('Server error generating sitemap');
  }
});

// ✅ 404 Fallback
app.use((_, res) => res.status(404).send('Page not found'));

// ✅ Start server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));