const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const Batch = require("../models/batch");
const crypto = require("crypto");


let sendEmail;
try {
  const emailService = require("../services/emailService");
  sendEmail = emailService.sendEmail || emailService;
} catch (e) {
  sendEmail = null;
}


const createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, role, gender, batchId, phone } = req.body;

    if (!firstName || !lastName || !email || !role || !gender) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, email, role, and gender are required",
      });
    }

    if (!["student", "mentor"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Only student or mentor accounts can be created",
      });
    }

    if (!["Male", "Female"].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: "Gender must be either 'Male' or 'Female'",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    
    let batch = null;
    if (batchId && mongoose.Types.ObjectId.isValid(batchId)) {
      const batchDoc = await Batch.findById(batchId);
      if (batchDoc) batch = batchDoc._id;
    }

    
    const temporaryPassword = crypto.randomBytes(4).toString("hex") + "Aa1!";
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    
  const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: phone ? phone.trim() : "",
      gender,
      batch,
      password: hashedPassword,
      status: "approved",
      role,
      mustChangePassword: true,
    });

  
    if (sendEmail && typeof sendEmail === "function") {
      try {
        await sendEmail({
          to: normalizedEmail,
          subject: "Your ASTU MSJ Bootcamp Account",
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2>Welcome to ASTU MSJ Bootcamp</h2>
              <p>Hello ${firstName},</p>
              <p>An account has been created for you as a <strong>${role}</strong>.</p>
              <p>Your login credentials are:</p>
              <p>
                <strong>Email:</strong> ${normalizedEmail}<br>
                <strong>Temporary Password:</strong> ${temporaryPassword}
              </p>
              <p>Please use these credentials to log in. You will be required to change your password after logging in.</p>
              <p>Regards,<br>ASTU MSJ Bootcamp Team</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.warn("⚠️ Email sending skipped or failed:", emailError.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: `${role} account created successfully.`,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        gender: user.gender,
        batch: user.batch,
        role: user.role,
        status: user.status,
        temporaryPassword, 
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during user creation",
      error: error.message,
    });
  }
};


const assignMentor = async (req, res) => {
  try {
    const { studentId, mentorId, mentorIds } = req.body;

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "A valid Student ID is required",
      });
    }
    
    let selectedMentorIds = mentorIds || (mentorId ? [mentorId] : []);

    if (!Array.isArray(selectedMentorIds) || selectedMentorIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one mentor",
      });
    }

    if (selectedMentorIds.length > 2) {
      return res.status(400).json({
        success: false,
        message: "A student can be assigned to a maximum of 2 mentors",
      });
    }

    
    for (const mId of selectedMentorIds) {
      if (!mongoose.Types.ObjectId.isValid(mId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid Mentor ID format: ${mId}`,
        });
      }
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student not found with this ID",
      });
    }

    const mentors = await User.find({
      _id: { $in: selectedMentorIds },
      role: "mentor",
      status: "approved",
    });

    if (mentors.length !== selectedMentorIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more selected mentors were not found or are suspended",
      });
    }

    const studentGender = student.gender || "Female";
    
    for (const mentor of mentors) {
      const mentorGender = mentor.gender || "Female";
      if (mentorGender !== studentGender) {
        return res.status(400).json({
          success: false,
          message: `Gender mismatch: ${studentGender} students can only be assigned to ${studentGender} mentors. Mentor ${mentor.firstName} ${mentor.lastName} is ${mentorGender}.`,
        });
      }
    }

    
    if (student.assignedMentors && student.assignedMentors.length > 0) {
      await User.updateMany(
        { _id: { $in: student.assignedMentors } },
        { $pull: { assignedStudents: student._id } }
      );
    }

    
    await User.findByIdAndUpdate(studentId, {
      assignedMentors: selectedMentorIds,
    });

    
    await User.updateMany(
      { _id: { $in: selectedMentorIds } },
      { $addToSet: { assignedStudents: student._id } }
    );

    const updatedStudent = await User.findById(studentId)
      .select("firstName lastName email gender role assignedMentors batch")
      .populate("assignedMentors", "firstName lastName email gender phone")
      .populate("batch", "name");

    return res.status(200).json({
      success: true,
      message: "Mentors assigned successfully",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Assign mentor error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while assigning mentors",
      error: error.message,
    });
  }
};


const getStudents = async (req, res) => {
  try {
    const { gender, batchId, status } = req.query;

    const filter = { role: "student" };
    if (gender) filter.gender = gender;
    if (batchId && mongoose.Types.ObjectId.isValid(batchId)) filter.batch = batchId;
    if (status) filter.status = status;

    const students = await User.find(filter)
      .select("firstName lastName email gender role status phone mustChangePassword assignedMentors batch createdAt")
      .populate("assignedMentors", "firstName lastName email gender phone")
      .populate("batch", "name")
      .sort({ createdAt: -1 });

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
      error: error.message,
    });
  }
};


const getMentors = async (req, res) => {
  try {
    const { gender, batchId, status } = req.query;

    const filter = { role: "mentor" };
    if (gender) filter.gender = gender;
    if (batchId && mongoose.Types.ObjectId.isValid(batchId)) filter.batch = batchId;
    if (status) filter.status = status;

    const mentors = await User.find(filter)
      .select("firstName lastName email gender role status phone assignedStudents batch createdAt updatedAt")
      .populate("assignedStudents", "firstName lastName email gender phone")
      .populate("batch", "name")
      .sort({ createdAt: -1 });

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
      error: error.message,
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID",
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
      message: "Server error while updating status",
      error: error.message,
    });
  }
};


const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID",
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
        message: "Admin accounts cannot be deleted",
      });
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting user",
      error: error.message,
    });
  }
};

const getBlacklistedUsers = async (req, res) => {
  try {
    const users = await User.find({
      role: { $in: ["student", "mentor"] },
      status: "suspended",
    }).select("firstName lastName email gender role status batch createdAt updatedAt");

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
      error: error.message,
    });
  }
};


const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("firstName lastName email gender role status phone bio profileImage mustChangePassword assignedMentors assignedStudents batch createdAt updatedAt")
      .populate("assignedMentors", "firstName lastName email gender phone")
      .populate("assignedStudents", "firstName lastName email gender phone")
      .populate("batch", "name");

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
      error: error.message,
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

    if (phone !== undefined) user.phone = phone.trim();
    if (bio !== undefined) user.bio = bio.trim();

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        gender: user.gender,
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
      error: error.message,
    });
  }
};

module.exports = {
  createUser,
  updateUserStatus,
  deleteUser,
  getBlacklistedUsers,
  assignMentor,
  getStudents,
  getMentors,
  getProfile,
  updateProfile,
};