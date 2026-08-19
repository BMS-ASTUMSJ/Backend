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

// ============================================================
// LOGIN
// ============================================================

router.post("/login", login);

// ============================================================
// GOOGLE LOGIN
// ============================================================

router.post("/google", googleLogin);

// ============================================================
// REFRESH ACCESS TOKEN
// ============================================================

router.post("/refresh", refreshAccessToken);

// ============================================================
// CURRENT USER
// ============================================================

router.get("/me", protect, getMe);

// ============================================================
// CHANGE PASSWORD
// ============================================================

router.patch("/change-password", protect, changePassword);

// ============================================================
// SKIP PASSWORD CHANGE
// ============================================================

router.patch("/skip-password-change", protect, skipPasswordChange);

// ============================================================
// LOGOUT
// ============================================================

router.post("/logout", protect, logout);

// ============================================================
// FORGOT PASSWORD
// ============================================================

router.post("/forgot-password", forgotPassword);

// ============================================================
// VERIFY RESET OTP
// ============================================================

router.post("/verify-reset-otp", verifyResetOtp);

// ============================================================
// RESET PASSWORD
// ============================================================

router.post("/reset-password", resetPassword);

module.exports = router;
