// server.js - Simple Express server for production
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Catch-all route for SPA - using a function instead of string
app.use((req, res, next) => {
  // If the request is for an API route or static file, skip
  if (req.path.startsWith('/api') || req.path.includes('.')) {
    return next();
  }
  // Otherwise send index.html
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});