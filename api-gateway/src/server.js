import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import Redis from "ioredis";
import { RateLimiterRedis } from "rate-limiter-flexible";
dotenv.config();

const app = express();
const port = process.env.PORT;
const redisClient = new Redis(process.env.REDIS_URL);
const proxyOptions = {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace(/\/v1/, "api");
  },
  proxyErrorHandler: (err, res, next) => {
    if (err.code === "ECONNREFUSED") {
      logger.error("Service Unavailable", {
        service: err.host,
        error: err.message,
      });
      res.status(500).json({ error: "Service Unavailable" });
    } else {
      next(err);
    }
  },
};

app.use("v2/auth", proxy(process.env.IDENTITY_SERVICE_URL, ...proxyOptions), {
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers["Content-Type"] = "application/json";
    return proxyReqOpts;
  },
  userResDecorator: (proxyRes, srcReq, res) => {
    res.setHeader("X-RateLimit-Limit", proxyRes.headers["x-ratelimit-limit"]);
    res.setHeader(
      "X-RateLimit-Remaining",
      proxyRes.headers["x-ratelimit-remaining"]
    );
    res.setHeader("X-RateLimit-Reset", proxyRes.headers["x-ratelimit-reset"]);
    return proxyRes;
  },
});
app.use(cors());
app.use(express.json());
app.use(helmet());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} ${res.statusCode}`);
  next();
});

// Global Rate Limiter
const globalRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "global",
  points: 60,
  duration: 1,
});

// track the global rate limiter
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

// rate limiter for sensitive endpoints
const sensitiveRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "sensitive",
  points: 60,
  duration: 1,
});

// track the sensitive endpoints rate limiter
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

// start the server
app.listen(port, () => {
  logger.info(`API Gateway is running on port ${port}`);
});

export default app;
