'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const itemsRouter = require('./routes/items');
const loansRouter = require('./routes/loans');
const dashboardRouter = require('./routes/dashboard');
const alertsRouter = require('./routes/alerts');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());

// CORS in dev, allow the Vite dev server
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173'];


app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);


if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(express.json());


app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/items', itemsRouter);
app.use('/api/loans', loansRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/alerts', alertsRouter);


app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
});


app.use(errorHandler);

module.exports = app;
