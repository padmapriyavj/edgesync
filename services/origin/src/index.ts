import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ContentService } from './services/content.service';
import { createContentRouter } from './routes/content.routes';
import { InvalidationProducer } from './messaging/kafka.producer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Kafka producer
const kafkaBrokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const invalidationProducer = new InvalidationProducer(kafkaBrokers);

// Services
const contentService = new ContentService(pool);

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes - pass producer to routes
app.use('/api/content', createContentRouter(contentService, invalidationProducer));

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'origin', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', service: 'origin', database: 'disconnected' });
  }
});

// Start server
async function start() {
  try {
    // Connect to Kafka
    await invalidationProducer.connect();
    
    app.listen(PORT, () => {
      console.log(` Origin server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start origin server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n Shutting down gracefully...');
  await invalidationProducer.disconnect();
  await pool.end();
  process.exit(0);
});

start();