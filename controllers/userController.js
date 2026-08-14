const bcrypt = require("bcryptjs");
const User = require("../models/User");
const crypto = require("crypto");


const createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, role } = req.body;

    if (!firstName || !lastName || !email || !role) {
      return res.status(400).json({
        success: false,
        message:
          "First name, last name, email, role, are required",
      });
    }

    if (!["student", "mentor"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Only student or mentor accounts can be created",
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

     const temporaryPassword = crypto.randomBytes(6).toString("hex");
     
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
 
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      status: "approved",
      role,
      mustChangePassword: true,
    });

    res.status(201).json({
      success: true,
      message: `${role} account created successfully`,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
     
        status: user.status,
        mustChangePassword: user.mustChangePassword,
      },
      temporaryPassword,
    });
  } catch (error) {
    console.error("Create user error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or suspended",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Admin cannot suspend another admin
    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be suspended",
      });
    }

    user.status = status;

    await user.save();

    return res.status(200).json({
      success: true,
      message: `User status updated to ${status}`,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Update user status error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getBlacklistedStudents = async (req, res) => {
  try {
    const students = await User.find({
      role: "student",
      status: "suspended",
    }).select(
      "firstName lastName email role status createdAt updatedAt"
    );

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("Get blacklisted students error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  createUser,
  updateUserStatus,
  getBlacklistedStudents,
};
