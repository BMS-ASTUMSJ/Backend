const express = require("express");

const {
  login,
  refreshAccessToken,
  getMe,
  changePassword,
  skipPasswordChange,
  logout,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  googleLogin,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", login);

router.post("/google", googleLogin);

router.post("/refresh", refreshAccessToken);

router.get("/me", protect, getMe);

router.patch("/change-password", protect, changePassword);

router.patch("/skip-password-change", protect, skipPasswordChange);

router.post("/logout", protect, logout);

router.post("/forgot-password", forgotPassword);

router.post("/verify-reset-otp", verifyResetOtp);

router.post("/reset-password", resetPassword);

module.exports = router;
