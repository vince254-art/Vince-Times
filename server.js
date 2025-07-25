const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.set('view engine', 'ejs');

// Session setup
app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Paths
const uploadsDir = path.join(__dirname, 'uploads');
const postsFile = path.join(__dirname, 'data/posts.json');
const commentsFile = path.join(__dirname, 'data/comments.json');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, 'uploads'),
  filename: (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// JSON read/write helpers
const readJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
};
const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Auth middleware
const requireLogin = (req, res, next) => {
  if (req.session.loggedIn) return next();
  res.redirect('/login');
};

// === ROUTES ===

// Homepage
app.get('/', (req, res) => {
  const posts = readJson(postsFile);
  const search = req.query.search || '';
  const category = req.query.category || '';
  const filtered = posts.filter(p =>
    (!category || p.category === category) &&
    (!search || p.title.toLowerCase().includes(search.toLowerCase()))
  );
  res.render('index', {
    posts: filtered,
    search,
    category,
    loggedIn: req.session.loggedIn,
    title: 'Vince Times'
  });
});

// View a single post
app.get('/post/:id', (req, res) => {
  const posts = readJson(postsFile);
  const comments = readJson(commentsFile);
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).send('Post not found');

  const postComments = comments.filter(c => c.postId === post.id && c.status === 'approved');
  res.render('post', {
    post: { ...post, comments: postComments },
    loggedIn: req.session.loggedIn,
    title: post.title || 'Post'
  });
});

// Submit a comment
app.post('/post/:postId/comment', (req, res) => {
  const comments = readJson(commentsFile);
  const newComment = {
    id: Date.now().toString(),
    postId: req.params.postId,
    name: req.body.author || 'Anonymous',
    comment: req.body.text || '',
    status: 'approved',
    upvotes: 0,
    flagged: false
  };
  comments.push(newComment);
  writeJson(commentsFile, comments);
  res.redirect('/post/' + req.params.postId);
});

// Flag a comment
app.post('/post/:postId/comment/:commentId/flag', (req, res) => {
  const comments = readJson(commentsFile);
  const comment = comments.find(c => c.id === req.params.commentId && c.postId === req.params.postId);
  if (comment) {
    comment.flagged = true;
    writeJson(commentsFile, comments);
  }
  res.redirect('/post/' + req.params.postId);
});

// Upvote a comment
app.post('/post/:postId/comment/:commentId/upvote', (req, res) => {
  const comments = readJson(commentsFile);
  const comment = comments.find(c => c.id === req.params.commentId && c.postId === req.params.postId);
  if (comment) {
    comment.upvotes = (comment.upvotes || 0) + 1;
    writeJson(commentsFile, comments);
    return res.json({ success: true, upvotes: comment.upvotes });
  }
  res.json({ success: false });
});

// Admin dashboard
app.get('/admin', requireLogin, (req, res) => {
  const posts = readJson(postsFile);
  res.render('admin', { posts, loggedIn: true, title: 'Admin – Vince Times' });
});

// New post form
app.get('/admin/new', requireLogin, (req, res) => {
  res.render('new-post', { loggedIn: true, title: 'New Post – Vince Times' });
});

// Create post
app.post('/admin/new', requireLogin, upload.single('media'), (req, res) => {
  const posts = readJson(postsFile);
  const newPost = {
    id: Date.now().toString(),
    title: req.body.title,
    category: req.body.category,
    videoUrl: req.body.videoUrl || '',
    content: req.body.content,
    date: new Date().toISOString(),
    media: req.file ? '/uploads/' + req.file.filename : ''
  };
  posts.unshift(newPost);
  writeJson(postsFile, posts);
  res.redirect('/admin');
});

// Edit post
app.get('/admin/edit/:id', requireLogin, (req, res) => {
  const posts = readJson(postsFile);
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).send('Post not found');

  res.render('edit-post', {
    post,
    loggedIn: true,
    title: 'Edit Post – Vince Times'
  });
});

// Save edited post
app.post('/admin/edit/:id', requireLogin, upload.single('media'), (req, res) => {
  const posts = readJson(postsFile);
  const index = posts.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).send('Post not found');

  posts[index] = {
    ...posts[index],
    title: req.body.title,
    category: req.body.category,
    videoUrl: req.body.videoUrl || '',
    content: req.body.content,
    media: req.file ? '/uploads/' + req.file.filename : posts[index].media
  };
  writeJson(postsFile, posts);
  res.redirect('/admin');
});

// Delete post
app.post('/admin/delete/:id', requireLogin, (req, res) => {
  let posts = readJson(postsFile);
  posts = posts.filter(p => p.id !== req.params.id);
  writeJson(postsFile, posts);
  res.redirect('/admin');
});

// Admin comment moderation
app.get('/admin/comments', requireLogin, (req, res) => {
  const comments = readJson(commentsFile);
  const page = parseInt(req.query.page) || 1;
  const perPage = 10;
  const totalPages = Math.ceil(comments.length / perPage);
  const paginated = comments.slice((page - 1) * perPage, page * perPage);
  res.render('admin-comments', {
    comments: paginated,
    currentPage: page,
    totalPages,
    loggedIn: true,
    title: 'Moderate Comments – Vince Times'
  });
});

// Delete comment
app.post('/admin/comments/:id/delete', requireLogin, (req, res) => {
  let comments = readJson(commentsFile);
  comments = comments.filter(c => c.id !== req.params.id);
  writeJson(commentsFile, comments);
  res.redirect('/admin/comments');
});

// Flag comment
app.post('/admin/comments/:id/flag', requireLogin, (req, res) => {
  const comments = readJson(commentsFile);
  const comment = comments.find(c => c.id === req.params.id);
  if (comment) {
    comment.flagged = true;
    writeJson(commentsFile, comments);
  }
  res.redirect('/admin/comments');
});

// Login
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

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// 404 fallback
app.use((_, res) => res.status(404).send('Page not found'));

// Server start
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
