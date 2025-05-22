const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const middleware = require('./routes/utils/middleware');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('API Server Running');
});

// Auth & Identity Management
const userIdentityRoutes = require('./routes/user/userIdentity');
app.use('/api/', userIdentityRoutes);

const userEmailRoutes = require('./routes/user/userEmail');
app.use('/api/email', userEmailRoutes);

const userPasswordRoutes = require('./routes/user/userPassword');
app.use('/api/password', userPasswordRoutes);

const userProfileRoutes = require('./routes/user/userProfile');
app.use('/api/profile', userProfileRoutes);

// Session Management
const sessionRoutes = require('./routes/session/session');
app.use('/api/sessions', sessionRoutes);

// Login Attempts
const loginAttemptRoutes = require('./routes/security/loginAttempts');
app.use('/api/login-attempts', loginAttemptRoutes);

// API Key Management
const apiKeyRoutes = require('./routes/apikey/apiKey');
app.use('/api/apikeys', apiKeyRoutes);

// Audit Log (read only)
const auditLogRoutes = require('./routes/audit/auditLogs');
app.use('/api/audit', auditLogRoutes);

// API Request Logs (read only)
const apiRequestRoutes = require('./routes/monitoring/apiRequests');
app.use('/api/requests', apiRequestRoutes);

// Apply middleware (auth, error handling, etc.)
app.use(middleware);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});