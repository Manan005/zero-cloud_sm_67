import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import apiRoutes from './routes/api.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for Vite frontend (typically http://localhost:5173 or other local dev origins)
app.use(cors({
  origin: '*', // Allow all origins for local hackathon development comfort
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parsers
app.use(express.json({ limit: '10mb' })); // Higher limit for potential large payloads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'supermemory-onboarding-backend' });
});

// API Routes
app.use('/api', apiRoutes);

// Ping Supermemory Local Binary on boot to verify status
function checkSupermemoryAvailability() {
  const url = process.env.SUPERMEMORY_BASE_URL || 'http://localhost:8000';
  console.log(`Checking Supermemory Local instance at ${url}...`);

  http.get(url, (res) => {
    console.log(`[STATUS] Supermemory Local binary is reachable. (HTTP ${res.statusCode})`);
  }).on('error', (err) => {
    console.warn(`[WARNING] Supermemory Local binary is NOT reachable at ${url}.`);
    console.warn(`Please ensure you started the engine locally via: 'npx supermemory local' or direct binary. Code searches will fail until it is running.`);
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Local Express Server running on http://localhost:${PORT}`);
  console.log(`CORS enabled for Vite frontend clients`);
  console.log(`==================================================`);
  checkSupermemoryAvailability();
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Shutting down Express server gracefully.');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT (Ctrl+C) received. Shutting down Express server gracefully.');
  process.exit(0);
});
