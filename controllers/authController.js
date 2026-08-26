const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const User = require("../models/user");
const { sendEmail } = require("../services/emailService");

const allowedRoles = ["student", "mentor", "admin"];

const isAllowedRole = (role) => {
  return allowedRoles.includes(String(role || "").toLowerCase());
};

const isApprovedUser = (user) => {
  return user && String(user.status || "").toLowerCase() === "approved";
};

const getUserBatchHistory = async (user) => {
  await user.populate({
    path: "batchHistory.batch",
    select: "name status startDate endDate description",
  });

  return user.batchHistory || [];
};

const createAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    },
  );
};

const createRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "7d",
    },
  );
};

const setRefreshCookie = (res, refreshToken) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const getSafeUser = async (user) => {
  const batchHistory = await getUserBatchHistory(user);

  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    batch: user.batch,
    batchHistory,
  };
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!isApprovedUser(user)) {
      return res.status(403).json({
        success: false,
        message: "Your account is not approved.",
      });
    }

    if (!isAllowedRole(user.role)) {
      return res.status(403).json({
        success: false,
        message: "This account type is not allowed to log in.",
      });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: "Password authentication is not available for this account.",
      });
    }

    // Existing passwords are NOT affected by the new password rules.
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    setRefreshCookie(res, refreshToken);

    const safeUser = await getSafeUser(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      user: safeUser,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!isApprovedUser(user)) {
      return res.status(403).json({
        success: false,
        message: "Your account is not approved.",
      });
    }

    if (!isAllowedRole(user.role)) {
      return res.status(403).json({
        success: false,
        message: "This account type is not allowed.",
      });
    }

    const newAccessToken = createAccessToken(user);

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);

    return res.status(401).json({
      success: false,
      message: "Refresh token is invalid or expired",
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!isApprovedUser(user)) {
      return res.status(403).json({
        success: false,
        message: "Your account is not approved.",
      });
    }

    if (!isAllowedRole(user.role)) {
      return res.status(403).json({
        success: false,
        message: "This account type is not allowed.",
      });
    }

    const safeUser = await getSafeUser(user);

    return res.status(200).json({
      success: true,
      user: safeUser,
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| CHANGE PASSWORD
|--------------------------------------------------------------------------
| Password requirements apply ONLY here.
|
| Requirements:
| - At least 8 characters
| - At least 1 uppercase letter
| - At least 1 lowercase letter
| - At least 1 number
| - At least 1 special character
|
| Existing passwords are NOT checked against these requirements during
| login, so old passwords continue to work.
|--------------------------------------------------------------------------
*/

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    // Minimum 8 characters
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // At least one uppercase letter
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one uppercase letter",
      });
    }

    // At least one lowercase letter
    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one lowercase letter",
      });
    }

    // At least one number
    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one number",
      });
    }

    // At least one special character
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least one special character",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!isApprovedUser(user)) {
      return res.status(403).json({
        success: false,
        message: "Your account is not approved.",
      });
    }

    if (!isAllowedRole(user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to change your password.",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "Current password is not available for this account.",
      });
    }

    // Check current password.
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Prevent using the same password.
    const samePassword = await bcrypt.compare(newPassword, user.password);

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // Hash the new password.
    user.password = await bcrypt.hash(newPassword, 12);

    // User has successfully changed the temporary password.
    user.mustChangePassword = false;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        mustChangePassword: false,
      },
    });
  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const skipPasswordChange = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!isApprovedUser(user)) {
      return res.status(403).json({
        success: false,
        message: "Your account is not approved.",
      });
    }

    if (!isAllowedRole(user.role)) {
      return res.status(403).json({
        success: false,
        message: "This action is not available for your account.",
      });
    }

    user.mustChangePassword = false;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password change skipped successfully.",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        mustChangePassword: false,
      },
    });
  } catch (error) {
    console.error("Skip password change error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const skipChangePassword = skipPasswordChange;

const logout = async (req, res) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
      status: "approved",
      role: {
        $in: ["student", "mentor", "admin"],
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No approved account was found with this email.",
      });
    }

    if (!isApprovedUser(user) || !isAllowedRole(user.role)) {
      return res.status(404).json({
        success: false,
        message: "No approved account was found with this email.",
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    user.passwordResetOtp = hashedOtp;
    user.passwordResetOtpExpires = Date.now() + 10 * 60 * 1000;
    user.passwordResetVerified = false;

    await user.save();

    await sendEmail({
      to: user.email,
      subject: "ASTU MSJ Password Reset OTP",
      html: `
        <h2>Password Reset Request</h2>
        <p>Hello ${user.firstName},</p>
        <p>We received a request to reset your ASTU MSJ Bootcamp Management System password.</p>
        <p>Your password reset OTP is:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:5px;">${otp}</p>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you did not request this password reset, you can safely ignore this email.</p>
        <p>ASTU MSJ Bootcamp Management System</p>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Password reset OTP has been sent to your email.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    if (!/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({
        success: false,
        message: "OTP must be a 6-digit number",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const hashedOtp = crypto
      .createHash("sha256")
      .update(String(otp))
      .digest("hex");

    const user = await User.findOne({
      email: normalizedEmail,
      status: "approved",
      role: {
        $in: ["student", "mentor", "admin"],
      },
      passwordResetOtp: hashedOtp,
      passwordResetOtpExpires: {
        $gt: Date.now(),
      },
    });

    if (!user || !isApprovedUser(user) || !isAllowedRole(user.role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    user.passwordResetVerified = true;
    user.passwordResetOtp = null;
    user.passwordResetOtpExpires = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email and new password are required",
      });
    }

    // Original reset-password logic remains unchanged.
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
      status: "approved",
      role: {
        $in: ["student", "mentor", "admin"],
      },
      passwordResetVerified: true,
    }).select("+password");

    if (!user || !isApprovedUser(user) || !isAllowedRole(user.role)) {
      return res.status(400).json({
        success: false,
        message: "OTP verification is required before resetting your password",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "Password reset is not available for this account.",
      });
    }

    const samePassword = await bcrypt.compare(newPassword, user.password);

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from your current password",
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordResetVerified = false;
    user.passwordResetOtp = null;
    user.passwordResetOtpExpires = null;
    user.mustChangePassword = false;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const { email, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Google account email not available",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "No account exists with this Google email. Please contact the administrator.",
      });
    }

    if (!isApprovedUser(user)) {
      return res.status(403).json({
        success: false,
        message: "Your account is not approved.",
      });
    }

    if (!isAllowedRole(user.role)) {
      return res.status(403).json({
        success: false,
        message: "This account type is not allowed to log in.",
      });
    }

    if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    setRefreshCookie(res, refreshToken);

    const safeUser = await getSafeUser(user);

    return res.status(200).json({
      success: true,
      message: "Google login successful",
      accessToken,
      user: safeUser,
    });
  } catch (error) {
    console.error("Google login error:", error);

    return res.status(401).json({
      success: false,
      message: "Invalid Google credential",
    });
  }
};

module.exports = {
  login,
  refreshAccessToken,
  getMe,
  changePassword,
  skipChangePassword,
  skipPasswordChange,
  logout,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  googleLogin,
};
