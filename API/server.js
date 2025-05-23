const express = require('express');
const cors = require('cors');
const { captureResponseBody, logApiRequest } = require('./routes/utils/apiRequest');
const middleware = require('./routes/utils/middleware');
const authRoutes = require('./routes/auth/auth.route');
const userRoutes = require('./routes/user/user.route');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('API Server Running'));

app.use('/api', authRoutes);
app.use(middleware);
app.use('/api/user', userRoutes);


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});