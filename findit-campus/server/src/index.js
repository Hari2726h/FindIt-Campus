require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const claimRoutes = require('./routes/claims');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

// In production, serve the built React app from the same Express server —
// one process, one port, no separate static host needed. `npm run build`
// in client/ must have been run first. In development, Vite's own dev
// server handles the frontend instead (see client/vite.config.js).
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Every route is wrapped with wrapAsync (see utils/wrapAsync.js), so any
// rejected promise — a bad Prisma query, a thrown validation error, anything
// — lands here instead of crashing the process. Multer errors land here too.
app.use((err, req, res, next) => {
  if (err) {
    console.error(err);
    const status = typeof err.status === 'number' ? err.status : (err.name === 'MulterError' ? 400 : 500);
    return res.status(status).json({ error: err.message || 'Something went wrong' });
  }
  next();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`FindIt Campus API listening on http://localhost:${PORT}`));
