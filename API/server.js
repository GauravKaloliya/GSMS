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
const userIdentityRoutes = require('./routes/user/user.route');
app.use('/api/', userIdentityRoutes);

// Apply middleware (auth, error handling, etc.)
app.use(middleware);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});