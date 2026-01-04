import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { Pool } from "pg";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

//Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

//Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

//health check route
app.get("/health", async (req: Request, res: Response) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      service: "origin",
      database: "connected",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      service: "origin",
      database: "disconnected",
    });
  }
});

app.get("/api/test", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM content LIMIT 3");
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`Origin server running on port ${PORT}`);
});
