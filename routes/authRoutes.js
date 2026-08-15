const express = require("express");

const {
  login,
  refreshAccessToken,
  getMe,
  changePassword,
  logout,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", login);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password/:token", resetPassword);

router.get("/me", protect, getMe);

router.post("/logout", protect, logout);

router.post("/refresh-token", refreshAccessToken);

module.exports = router;
