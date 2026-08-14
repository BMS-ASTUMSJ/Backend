const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");
const Applicant = require("../models/Applicant");
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

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
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
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
        mustChangePassword: req.user.mustChangePassword,
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
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const samePassword = await bcrypt.compare(newPassword, user.password);

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const logout = async (req, res) => {
  try {
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
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User with this email does not exist.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000;

    await user.save();

    await sendEmail({
      to: user.email,

      subject: "ASTU MSJ Password Reset",

      html: `
        <h2>Password Reset Request</h2>

        <p>Hello ${user.firstName},</p>

        <p>
          We received a request to reset your
          ASTU MSJ Bootcamp Management System password.
        </p>

        <p>
          Your password reset token is:
        </p>

        <p>
          <strong>${resetToken}</strong>
        </p>

        <p>
          This token will expire in 15 minutes.
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
        "If an account with that email exists, a password reset email has been sent.",

      resetToken,
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: {
        $gt: Date.now(),
      },
    }).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Reset token is invalid or has expired",
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);

    user.passwordResetToken = null;
    user.passwordResetExpires = null;

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

const registerApplicant = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      gender,
      year,
      department,
      experienceLevel,
      about,
      agreedToRules,
    } = req.body;

    if (
      !fullName ||
      !email ||
      !phone ||
      !gender ||
      !year ||
      !department ||
      !experienceLevel ||
      !about
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields",
      });
 }

    if (!agreedToRules) {
      return res.status(400).json({
        success: false,
        message: "You must agree to the bootcamp rules",
      });
    }

    const existingApplicant = await Applicant.findOne({
      email: email.toLowerCase(),
    });

    if (existingApplicant) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered",
      });
    }

    const applicant = await Applicant.create({
      fullName,
      email: email.toLowerCase(),
      phone,
      gender,
      year,
      department,
      experienceLevel,
      about,
      agreedToRules,
    });
  return res.status(201).json({
      success: true,
      message:
        "Registration successful. Your application is pending interview.",
      applicant,
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};
module.exports = {
  login,
  getMe,
  changePassword,
  logout,
  forgotPassword,
  resetPassword,
  registerApplicant
};
