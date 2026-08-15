const express = require("express");

const {
  login,
  googleLogin,
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

router.post("/google", googleLogin);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password", resetPassword);

router.get("/me", protect, getMe);

router.patch("/change-password", protect, changePassword);

router.post("/logout", protect, logout);

router.post("/refresh-token", refreshAccessToken);

module.exports = router;
