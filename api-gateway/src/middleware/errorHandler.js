import logger from "../utils/logger.js ";

export const errorHandler = (error, req, res, next) => {
  logger.error(error.message, {
    stack: error.stack,
    status: res.statusCode,
  });

  res.status(res.statusCode || 500).json({
    message: error.message || "Interval server error",
  });
};
