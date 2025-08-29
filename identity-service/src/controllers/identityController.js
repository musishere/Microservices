import { User } from "../models/UserModel.js";
import generateTokens from "../utils/generateToken.js";
import logger from "../utils/logger.js";
import { validateRegisterSchema } from "../utils/validation.js";

// user registration
export const registerUser = async (req, res, next) => {
  logger.info("Register User endpoint hit");
  try {
    // validate the schema
    const { error } = validateRegisterSchema(req.body);
    if (error) {
      logger.warn("Validation error", { error: error.details[0].message });
      return res.status(400).json({ message: error.details[0].message });
    }

    const alreadyExists = await User.findOne({
      $or: [{ username: req.body.username }, { email: req.body.email }],
    });

    if (alreadyExists) {
      logger.warn("User already exists", { username: req.body.username });
      return res.status(400).json({ message: "User already exists" });
    }

    const user = new User({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
    });

    const { generateAccessToken, generateRefreshToken } = generateTokens(
      user._id
    );

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    await user.save();

    logger.info("User registered successfully", {
      username: req.body.username,
      userId: user._id,
    });
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error("Error registering user", { error: error.message });
    next(error);
  }
};

// user login
export const loginUser = async (req, res, next) => {
  logger.info("Login User endpoint hit");
  try {
    const { error } = validateLoginSchema(req.body);

    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      logger.warn("User not found", { email: req.body.email });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(
      req.body.password,
      user.password
    );

    if (!isPasswordValid) {
      const { generateAccessToken, generateRefreshToken } = generateTokens(
        user._id
      );

      const accessToken = generateAccessToken(user._id);

      const refreshToken = generateRefreshToken(user._id);

      await RefreshToken.create({
        token: refreshToken,
        userId: user._id,
      });
    }

    logger.info("User logged in successfully", {
      username: user.username,
      userId: user._id,
    });
    return res
      .status(200)
      .json({ success: true, message: "User logged in successfully" });
  } catch (error) {
    logger.error("Error logging in user", { error: error.message });
    next(error);
  }
};

// refresh Token

// logout
