const express = require("express");

const {
  login,
  refreshAccessToken,
  getMe,
  changePassword,
  logout,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", login);

router.post("/forgot-password", forgotPassword);

router.post("/verify-reset-otp", verifyResetOtp);

router.post("/reset-password", resetPassword);

router.get("/me", protect, getMe);

router.put("/change-password", protect, changePassword);

router.post("/logout", protect, logout);

router.post("/refresh-token", refreshAccessToken);

module.exports = router;
