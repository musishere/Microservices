import cors from "cors";
import express from "express";
import helmet from "helmet";

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

// global rate limiter
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
app.listen(3000, () => {
  console.log("API Gateway is running on port 3000");
});
