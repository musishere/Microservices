import jwt from "jsonwebtoken";

const generateTokens = (userId) => {
  const generateAccessToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: "10m",
    });
  };

  const generateRefreshToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
  };

  return { generateAccessToken, generateRefreshToken };
};

export default generateTokens;
