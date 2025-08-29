import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import Redis from "ioredis";
import { RateLimiterRedis } from "rate-limiter-flexible";
import identityRoutes from "./routes/identityRoutes.js";
import connectDB from "./utils/db.js";
import logger from "./utils/logger.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(helmet());

// connect to mongodb
connectDB();

// connect to redis
const redis = new Redis(process.env.REDIS_URL);

// request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} ${res.statusCode}`);
  next();
});

/* ========================
   GLOBAL RATE LIMITER
   ======================== */
const globalRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "global",
  points: 60, // allow 60 requests
  duration: 1, // per 1 second
});

app.use(async (req, res, next) => {
  try {
    const rlRes = await globalRateLimiter.consume(req.ip);

    res.setHeader("X-RateLimit-Limit", rlRes.remainingPoints + 1);
    res.setHeader("X-RateLimit-Remaining", rlRes.remainingPoints);
    res.setHeader("X-RateLimit-Reset", rlRes.msBeforeNext / 1000);

    next();
  } catch (rejRes) {
    logger.warn("Global rate limit exceeded", {
      ip: req.ip,
      remainingPoints: rejRes.remainingPoints,
    });

    res.status(429).json({
      error: "Too many requests",
      message: "Please try again later",
    });
  }
});

/* ========================
   SENSITIVE ENDPOINTS LIMITER
   ======================== */
const sensitiveRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "sensitive",
  points: 50, // max 50 requests
  duration: 15 * 60, // per 15 minutes
});

// middleware for sensitive routes
const sensitiveEndpointsRateLimit = async (req, res, next) => {
  try {
    await sensitiveRateLimiter.consume(req.ip);
    next();
  } catch {
    logger.warn("Sensitive rate limit exceeded", { ip: req.ip });
    res.status(429).json({
      error: "Too many requests",
      message: "Please try again later",
    });
  }
};

// main routes
app.use("/api/v1/identity", sensitiveEndpointsRateLimit, identityRoutes);

// start server
app.listen(process.env.PORT, () => {
  logger.info(`Identity service is running on port ${process.env.PORT}`);
});

export default app;
