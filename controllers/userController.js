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

const getBlacklistedUsers = async (req, res) => {
  try {
    const users = await User.find({
      role: { $in: ["student", "mentor"] },
      status: "suspended",
    }).select(
      "firstName lastName email role status createdAt updatedAt"
    );

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get blacklisted users error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting blacklisted users",
    });
  }
};

const assignMentor = async (req, res) => {
  try {
    const { studentId, mentorId } = req.body;

    if (!studentId || !mentorId) {
      return res.status(400).json({
        success: false,
        message: "Student ID and mentor ID are required",
      });
    }

    const student = await User.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (student.role !== "student") {
      return res.status(400).json({
        success: false,
        message: "The selected user is not a student",
      });
    }


    const mentor = await User.findById(mentorId);

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor not found",
      });
    }

    if (mentor.role !== "mentor") {
      return res.status(400).json({
        success: false,
        message: "The selected user is not a mentor",
      });
    }


    if (mentor.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Cannot assign a suspended mentor",
      });
    }

    
    student.assignedMentor = mentor._id;

    await student.save();

    return res.status(200).json({
      success: true,
      message: "Mentor assigned to student successfully",
      student: {
        id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        role: student.role,
        assignedMentor: {
          id: mentor._id,
          firstName: mentor.firstName,
          lastName: mentor.lastName,
          email: mentor.email,
        },
      },
    });
  } catch (error) {
    console.error("Assign mentor error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while assigning mentor",
    });
  }
};

const getStudents = async (req, res) => {
  try {
    const students = await User.find({
      role: "student",
    })
      .select("firstName lastName email role status mustChangePassword assignedMentor")
      .populate(
        "assignedMentor",
        "firstName lastName email role status"
      );

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error("Get students error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting students",
    });
  }
};

const getMentors = async (req, res) => {
  try {
    const mentors = await User.find({
      role: "mentor",
    }).select(
      "firstName lastName email role status createdAt updatedAt"
    );

    return res.status(200).json({
      success: true,
      count: mentors.length,
      mentors,
    });
  } catch (error) {
    console.error("Get mentors error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting mentors",
    });
  }
};


const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select(
        "firstName lastName email role status phone bio profileImage mustChangePassword assignedMentor createdAt updatedAt"
      )
      .populate(
        "assignedMentor",
        "firstName lastName email role status"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting profile",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { phone, bio } = req.body;

    if (bio && bio.length > 300) {
      return res.status(400).json({
        success: false,
        message: "Bio cannot exceed 300 characters",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (phone !== undefined) {
      user.phone = phone.trim();
    }

    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone,
        bio: user.bio,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating profile",
    });
  }
};

module.exports = {
  createUser,
  updateUserStatus,
  getBlacklistedUsers,
  assignMentor,
  getStudents,
  getMentors,
  getProfile,
  updateProfile,
};