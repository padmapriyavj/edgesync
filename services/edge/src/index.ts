import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { CacheClient } from './cache/redis.client';

dotenv.config();

const app = express();
const PORT = process.env.EDGE_PORT || 5001;
const REGION_NAME = process.env.REGION_NAME || 'us-east';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Initialize cache client
const cache = new CacheClient(REDIS_URL);

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'edge',
    region: REGION_NAME,
    cache: cache.isConnected() ? 'connected' : 'disconnected'
  });
});

// Test cache endpoint
app.get('/test-cache', async (req: Request, res: Response) => {
  try {
    // Set a test value
    await cache.set('test-key', { message: 'Hello from cache!' }, 60);
    
    // Get it back
    const value = await cache.get('test-key');
    
    res.json({
      success: true,
      region: REGION_NAME,
      cached: value
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Start server
async function start() {
  try {
    // Connect to Redis
    await cache.connect();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`Edge service [${REGION_NAME}] running on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log(`Test: http://localhost:${PORT}/test-cache`);
    });
  } catch (error) {
    console.error('Failed to start edge service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n Shutting down gracefully...');
  await cache.disconnect();
  process.exit(0);
});

start();