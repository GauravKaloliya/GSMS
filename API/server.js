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

app.use(express.static(path.join(__dirname, 'client', 'dist'))); 

// Catch-all route to React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// API Routes
app.use('/api', authRoutes);
app.use(middleware);
app.use('/api/user', userRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});