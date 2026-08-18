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
    const { firstName, lastName, email, role, gender, batchId, phone } =
      req.body;

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

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

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
              <p>Please change your password after logging in.</p>
              <p>Regards,<br>ASTU MSJ Bootcamp Team</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.warn("⚠️ Email service failed:", emailError.message);
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
        role: user.role,
        temporaryPassword,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error during creation" });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "suspended"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid User ID" });
    }

    const targetUser = await User.findById(id);
    if (!targetUser)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    if (targetUser.role === "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Admins cannot be suspended" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { status: status },
      { new: true, runValidators: false },
    ).select("-password");

    return res.status(200).json({
      success: true,
      message: `User status updated to ${status}`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update status error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error updating status" });
  }
};

const assignMentor = async (req, res) => {
  try {
    const { studentId, mentorIds } = req.body;

    if (!studentId || !Array.isArray(mentorIds) || mentorIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Student and Mentors are required" });
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== "student") {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    const mentors = await User.find({
      _id: { $in: mentorIds },
      role: "mentor",
      status: "approved",
    });
    if (mentors.length !== mentorIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more mentors are invalid or suspended",
      });
    }

    for (const m of mentors) {
      if (m.gender !== student.gender) {
        return res.status(400).json({
          success: false,
          message: `Gender mismatch: ${student.gender} student cannot have ${m.gender} mentor`,
        });
      }
    }

    await User.findByIdAndUpdate(studentId, { assignedMentors: mentorIds });

    await User.updateMany(
      { _id: { $in: mentorIds } },
      { $addToSet: { assignedStudents: studentId } },
    );

    return res
      .status(200)
      .json({ success: true, message: "Mentors assigned successfully" });
  } catch (error) {
    console.error("Assign mentor error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error assigning mentor" });
  }
};

const getStudents = async (req, res) => {
  try {
    const { gender, batchId, status } = req.query;
    const filter = { role: "student" };
    if (gender) filter.gender = gender;
    if (batchId && mongoose.Types.ObjectId.isValid(batchId))
      filter.batch = batchId;
    if (status) filter.status = status;

    const students = await User.find(filter)
      .select("-password")
      .populate("assignedMentors", "firstName lastName email gender phone")
      .populate("batch", "name")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json({ success: true, count: students.length, students });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Error fetching students" });
  }
};

const getMentors = async (req, res) => {
  try {
    const { gender, batchId, status } = req.query;
    const filter = { role: "mentor" };
    if (gender) filter.gender = gender;
    if (batchId && mongoose.Types.ObjectId.isValid(batchId))
      filter.batch = batchId;
    if (status) filter.status = status;

    const mentors = await User.find(filter)
      .select("-password")
      .populate("assignedStudents", "firstName lastName email gender phone")
      .populate("batch", "name")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json({ success: true, count: mentors.length, mentors });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Error fetching mentors" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    if (user.role === "admin")
      return res
        .status(403)
        .json({ success: false, message: "Admin cannot be deleted" });

    await User.findByIdAndDelete(id);
    return res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Error deleting user" });
  }
};

const getBlacklistedUsers = async (req, res) => {
  try {
    const users = await User.find({ status: "suspended" }).select("-password");
    return res.status(200).json({ success: true, count: users.length, users });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Error fetching blacklist" });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("assignedMentors assignedStudents batch");
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching profile" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { phone, bio } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { phone, bio },
      { new: true, runValidators: true },
    ).select("-password");
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating profile" });
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
