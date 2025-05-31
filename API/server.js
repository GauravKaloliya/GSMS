const express = require('express');
const cors = require('cors');
const path = require('path');

const { captureResponseBody, logApiRequest } = require('./routes/utils/apiRequest');
const middleware = require('./routes/utils/middleware');
const authRoutes = require('./routes/auth/auth.route');
const userRoutes = require('./routes/user/user.route');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(captureResponseBody);
app.use(logApiRequest);

// API Routes — put these first
app.use('/api', authRoutes);
app.use(middleware);
app.use('/api/user', userRoutes);

// Serve React static files
app.use(express.static(path.join(__dirname, 'client', 'dist')));

// React catch-all (for SPA routing) — handle all non-API routes
app.get('*', (req, res) => {
  // if request starts with /api, skip sending React index.html
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// 404 handler for anything else (should rarely reach here)
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});