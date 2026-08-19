const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const User = require("../models/User");

const { sendEmail } = require("../services/emailService");


const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Your account is suspended",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

   
    const accessToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    const refreshToken = jwt.sign(
      {
        userId: user._id,
      },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

   
    return res.status(200).json({
      success: true,
      message: "Login successful",

      accessToken,

      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,

        // IMPORTANT
        mustChangePassword: user.mustChangePassword,
      },
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

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Your account is suspended",
      });
    }

    const newAccessToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
      }
    );

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
    const user = await User.findById(req.user._id).select(
      "-password"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,

      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,

        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


const changePassword = async (req, res) => {
  try {
    const {
      currentPassword,
      newPassword,
    } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be at least 8 characters",
      });
    }

    const user = await User.findById(req.user._id).select(
      "+password"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      user.password
    );

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be different from current password",
      });
    }

    user.password = await bcrypt.hash(
      newPassword,
      12
    );

    
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


const skipChangePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

   
    if (
      user.role !== "student" &&
      user.role !== "mentor"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Password change skip is only available for students and mentors.",
      });
    }

    user.mustChangePassword = false;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password change skipped successfully",

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
    console.error(
      "Skip password change error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


const logout = async (req, res) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
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

    const normalizedEmail = email
      .toLowerCase()
      .trim();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User with this email does not exist.",
      });
    }

    const otp = crypto
      .randomInt(100000, 1000000)
      .toString();

    const hashedOtp = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    user.passwordResetOtp = hashedOtp;

    user.passwordResetOtpExpires =
      Date.now() + 10 * 60 * 1000;

    user.passwordResetVerified = false;

    await user.save();

    await sendEmail({
      to: user.email,

      subject: "ASTU MSJ Password Reset OTP",

      html: `
        <h2>Password Reset Request</h2>

        <p>Hello ${user.firstName},</p>

        <p>
          We received a request to reset your
          ASTU MSJ Bootcamp Management System password.
        </p>

        <p>
          Your password reset OTP is:
        </p>

        <p style="
          font-size: 28px;
          font-weight: bold;
          letter-spacing: 5px;
        ">
          ${otp}
        </p>

        <p>
          This OTP will expire in 10 minutes.
        </p>

        <p>
          If you did not request this password reset,
          you can safely ignore this email.
        </p>

        <p>
          ASTU MSJ Bootcamp Management System
        </p>
      `,
    });

    return res.status(200).json({
      success: true,
      message:
        "Password reset OTP has been sent to your email.",
    });
  } catch (error) {
    console.error(
      "Forgot password error:",
      error
    );

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

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be a 6-digit number",
      });
    }

    const normalizedEmail = email
      .toLowerCase()
      .trim();

    const hashedOtp = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    const user = await User.findOne({
      email: normalizedEmail,

      passwordResetOtp: hashedOtp,

      passwordResetOtpExpires: {
        $gt: Date.now(),
      },
    });

    if (!user) {
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
    console.error(
      "Verify OTP error:",
      error
    );

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
        message:
          "Email and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be at least 8 characters",
      });
    }

    const normalizedEmail = email
      .toLowerCase()
      .trim();

    const user = await User.findOne({
      email: normalizedEmail,
      passwordResetVerified: true,
    }).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "OTP verification is required before resetting your password",
      });
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      user.password
    );

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be different from your current password",
      });
    }

    user.password = await bcrypt.hash(
      newPassword,
      12
    );

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
    console.error(
      "Reset password error:",
      error
    );

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

    const ticket =
      await googleClient.verifyIdToken({
        idToken: credential,
        audience:
          process.env.GOOGLE_CLIENT_ID,
      });

    const payload = ticket.getPayload();

    const {
      email,
      sub: googleId,
    } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        message:
          "Google account email not available",
      });
    }

    const normalizedEmail = email
      .toLowerCase()
      .trim();

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

    if (user.status !== "approved") {
      return res.status(403).json({
        success: false,
        message:
          "Your account is suspended",
      });
    }

    if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    const accessToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Google login successful",

      accessToken,

      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,

        mustChangePassword:
          user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error(
      "Google login error:",
      error
    );

    return res.status(401).json({
      success: false,
      message:
        "Invalid Google credential",
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

    // Only students and mentors should use this flow
    if (!["student", "mentor"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "This action is only available for students and mentors.",
      });
    }

    user.mustChangePassword = false;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password change skipped successfully.",
    });
  } catch (error) {
    console.error("Skip password change error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  login,
  refreshAccessToken,
  getMe,
  changePassword,
  skipChangePassword,
  logout,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  googleLogin,
  skipPasswordChange
};
