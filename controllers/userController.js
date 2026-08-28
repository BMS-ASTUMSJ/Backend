const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const User = require("../models/user");
const Batch = require("../models/batch");

const Attendance = require("../models/attendance");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const ProgressContent = require("../models/progressContent");
const StudentProgress = require("../models/studentProgress");
const Announcement = require("../models/announcement");
const ProjectTracking = require("../models/projectTracking");

let sendEmail;

try {
  const emailService = require("../services/emailService");
  sendEmail = emailService.sendEmail || emailService;
} catch (error) {
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

    if (batchId) {
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid batch ID",
        });
      }

      const batchDoc = await Batch.findById(batchId);

      if (!batchDoc) {
        return res.status(404).json({
          success: false,
          message: "Batch not found",
        });
      }

      batch = batchDoc._id;
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
      batchHistory: batch
        ? [
            {
              batch,
              role,
              joinedAt: new Date(),
            },
          ]
        : [],
      password: hashedPassword,
      status: "approved",
      role,
      mustChangePassword: true,
      atRisk: false,
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
        console.warn("Email service failed:", emailError.message);
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
        batch: user.batch,
        batchHistory: user.batchHistory,
        atRisk: user.atRisk,
        temporaryPassword,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error during creation",
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
        message: "Invalid status",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID",
      });
    }

    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (targetUser.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admins cannot be suspended",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { status },
      {
        new: true,
        runValidators: false,
      },
    ).select("-password");

    return res.status(200).json({
      success: true,
      message: `User status updated to ${status}`,
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error updating status",
    });
  }
};

const assignMentor = async (req, res) => {
  try {
    const { studentId, mentorIds } = req.body;

    if (!studentId || !Array.isArray(mentorIds) || mentorIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Student and mentors are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await User.findById(studentId);

    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const uniqueMentorIds = [...new Set(mentorIds.map(String))];

    const mentors = await User.find({
      _id: { $in: uniqueMentorIds },
      role: "mentor",
      status: "approved",
    });

    if (mentors.length !== uniqueMentorIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more mentors are invalid or suspended",
      });
    }

    for (const mentor of mentors) {
      if (mentor.gender !== student.gender) {
        return res.status(400).json({
          success: false,
          message: `Gender mismatch: ${student.gender} student cannot have ${mentor.gender} mentor`,
        });
      }

      if (
        student.batch &&
        mentor.batch &&
        student.batch.toString() !== mentor.batch.toString()
      ) {
        return res.status(400).json({
          success: false,
          message: `${mentor.firstName} is not in the same batch as the student`,
        });
      }
    }

    const oldMentorIds = (student.assignedMentors || []).map((id) =>
      id.toString(),
    );

    const removedMentorIds = oldMentorIds.filter(
      (oldId) => !uniqueMentorIds.includes(oldId),
    );

    if (removedMentorIds.length > 0) {
      await User.updateMany(
        {
          _id: { $in: removedMentorIds },
        },
        {
          $pull: {
            assignedStudents: student._id,
          },
        },
      );
    }

    student.assignedMentors = uniqueMentorIds;
    await student.save();

    await User.updateMany(
      {
        _id: { $in: uniqueMentorIds },
      },
      {
        $addToSet: {
          assignedStudents: student._id,
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Mentors assigned successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error assigning mentor",
    });
  }
};

const getStudents = async (req, res) => {
  try {
    const { gender, batchId, status, atRisk } = req.query;

    const filter = {
      role: "student",
    };

    if (gender) {
      filter.gender = gender;
    }

    if (batchId) {
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid batch ID",
        });
      }
      filter.batch = batchId;
    }

    if (status) {
      filter.status = status;
    }

    if (atRisk === "true") {
      filter.atRisk = true;
    }

    if (atRisk === "false") {
      filter.atRisk = false;
    }

    const students = await User.find(filter)
      .select("-password")
      .populate("assignedMentors", "firstName lastName email gender phone")
      .populate("batch", "name status startDate endDate")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching students",
    });
  }
};

const getMentors = async (req, res) => {
  try {
    const { gender, batchId, status } = req.query;

    const filter = {
      role: "mentor",
    };

    if (gender) {
      filter.gender = gender;
    }

    if (batchId) {
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid batch ID",
        });
      }
      filter.batch = batchId;
    }

    if (status) {
      filter.status = status;
    }

    const mentors = await User.find(filter)
      .select("-password")
      .populate(
        "assignedStudents",
        "firstName lastName email gender phone atRisk batch",
      )
      .populate("batch", "name status startDate endDate")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: mentors.length,
      mentors,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching mentors",
    });
  }
};

const getMyStudents = async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Only mentors can access assigned students",
      });
    }

    const mentor = await User.findById(req.user._id).select("assignedStudents");

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor not found",
      });
    }

    const studentIds = mentor.assignedStudents || [];

    const students = await User.find({
      _id: { $in: studentIds },
      role: "student",
    })
      .select("-password")
      .populate("batch", "name status startDate endDate")
      .populate("assignedMentors", "firstName lastName email gender phone")
      .sort({
        firstName: 1,
        lastName: 1,
      });

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching assigned students",
    });
  }
};

const getMyRiskStatus = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their own risk status",
      });
    }

    const student = await User.findById(req.user._id).select(
      "_id firstName lastName email role atRisk",
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      atRisk: Boolean(student.atRisk),
      student: {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        role: student.role,
        atRisk: Boolean(student.atRisk),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching risk status",
    });
  }
};

const getStudentDashboard = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access dashboard",
      });
    }

    const student = await User.findById(req.user._id)
      .select("-password")
      .populate("batch", "name status")
      .populate("assignedMentors", "firstName lastName email");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const attendanceRecords = await Attendance.find({
      studentId: student._id,
    });

    const attendanceStatusList = attendanceRecords.map((record) => {
      return (
        record.secondCheck?.status || record.firstCheck?.status || "Absent"
      );
    });

    const presentCount = attendanceStatusList.filter(
      (status) => status === "Present" || status === "Late",
    ).length;

    const absentCount = attendanceStatusList.filter(
      (status) => status === "Absent",
    ).length;

    const excusedCount = attendanceStatusList.filter(
      (status) => status === "Excused",
    ).length;

    const totalAttendanceSessions = attendanceStatusList.length;

    const attendancePercentage =
      totalAttendanceSessions === 0
        ? 0
        : Math.round((presentCount / totalAttendanceSessions) * 100);

    const assignments = await Assignment.find({
      batch: student.batch?._id,
    });

    const submissions = await Submission.find({
      student: student._id,
    });

    const submittedAssignments = submissions.length;

    const missedAssignments = assignments.length - submittedAssignments;

    const gradedSubmissions = submissions.filter(
      (item) => item.status === "Graded" && item.score !== null,
    );

    const averageGrade =
      gradedSubmissions.length === 0
        ? 0
        : Math.round(
            gradedSubmissions.reduce((sum, item) => sum + item.score, 0) /
              gradedSubmissions.length,
          );

    const progressContents = await ProgressContent.find({
      batch: student.batch?._id,
      isPublished: true,
    });

    const studentProgress = await StudentProgress.find({
      student: student._id,
      batch: student.batch?._id,
    });

    const totalCP = progressContents.filter(
      (item) => item.type === "cp",
    ).length;

    const totalDev = progressContents.filter(
      (item) => item.type === "dev",
    ).length;

    const completedCP = studentProgress.filter(
      (item) => item.type === "cp" && item.status === "done",
    ).length;

    const completedDev = studentProgress.filter(
      (item) => item.type === "dev" && item.status === "done",
    ).length;

    const completedProjects = await ProjectTracking.find({
      "students.student": student._id,
    });

    const completedProjectCount = completedProjects.reduce(
      (total, project) =>
        total +
        project.students.filter(
          (s) => s.student.toString() === student._id.toString(),
        ).length,
      0,
    );

    const totalProgress = assignments.length + totalCP + totalDev;

    const completedProgress = submittedAssignments + completedCP + completedDev;

    const announcements = await Announcement.find({
      audience: "all",
    })
      .sort({
        createdAt: -1,
      })
      .limit(5);

    return res.status(200).json({
      success: true,

      dashboard: {
        student,

        attendance: {
          percentage: attendancePercentage,
          present: presentCount,
          absent: absentCount,
        },

        progress: {
          completed: completedProgress,
          total: totalProgress,
          percentage:
            totalProgress === 0
              ? 0
              : Math.round((completedProgress / totalProgress) * 100),
        },

        assignments: {
          total: assignments.length,
          submitted: submittedAssignments,
          missed: missedAssignments < 0 ? 0 : missedAssignments,
        },

        grades: {
          average: averageGrade,
        },

        announcements,

        risk: {
          isAtRisk: Boolean(student.atRisk),

          reasons: student.atRisk
            ? ["Your performance requires attention"]
            : [],
        },
      },
    });
  } catch (error) {
    console.error("STUDENT DASHBOARD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Error loading dashboard",
    });
  }
};
const updateStudentRiskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { atRisk } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    if (typeof atRisk !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "atRisk must be true or false",
      });
    }

    const student = await User.findOne({
      _id: id,
      role: "student",
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    student.atRisk = atRisk;
    await student.save();

    return res.status(200).json({
      success: true,
      message: atRisk
        ? "Student marked as at-risk"
        : "Student removed from at-risk status",
      student: {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        atRisk: student.atRisk,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error updating student risk status",
    });
  }
};

const getAtRiskStudents = async (req, res) => {
  try {
    const { batchId } = req.query;

    const filter = {
      role: "student",
      atRisk: true,
    };

    if (batchId) {
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid batch ID",
        });
      }
      filter.batch = batchId;
    }

    const students = await User.find(filter)
      .select("-password")
      .populate("batch", "name status startDate endDate")
      .populate("assignedMentors", "firstName lastName email phone")
      .sort({
        firstName: 1,
        lastName: 1,
      });

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching at-risk students",
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
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
        message: "Admin cannot be deleted",
      });
    }

    if (user.role === "student") {
      await User.updateMany(
        {},
        {
          $pull: {
            assignedStudents: user._id,
          },
        },
      );
    }

    if (user.role === "mentor") {
      await User.updateMany(
        {},
        {
          $pull: {
            assignedMentors: user._id,
          },
        },
      );
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error deleting user",
    });
  }
};

const getBlacklistedUsers = async (req, res) => {
  try {
    const users = await User.find({
      status: "suspended",
    })
      .select("-password")
      .populate("batch", "name");

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching blacklist",
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("assignedMentors", "firstName lastName email gender phone")
      .populate(
        "assignedStudents",
        "firstName lastName email gender phone atRisk",
      )
      .populate("batch", "name status startDate endDate description")
      .populate("batchHistory.batch", "name status startDate endDate");

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
    return res.status(500).json({
      success: false,
      message: "Error fetching profile",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      bio,
      profileImage,
      githubUrl,
      leetcodeUrl,
      codeforcesUrl,
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (bio !== undefined) {
      user.bio = bio.trim().slice(0, 300);
    }

    if (profileImage !== undefined) {
      user.profileImage = profileImage;
    }

    if (githubUrl !== undefined) {
      user.githubUrl = githubUrl.trim();
    }

    if (leetcodeUrl !== undefined) {
      user.leetcodeUrl = leetcodeUrl.trim();
    }

    if (codeforcesUrl !== undefined) {
      user.codeforcesUrl = codeforcesUrl.trim();
    }

    if (user.role !== "student") {
      if (firstName !== undefined) user.firstName = firstName.trim();
      if (lastName !== undefined) user.lastName = lastName.trim();
      if (phone !== undefined) user.phone = phone.trim();
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select("-password")
      .populate("assignedMentors", "firstName lastName email gender phone")
      .populate(
        "assignedStudents",
        "firstName lastName email gender phone atRisk",
      )
      .populate("batch", "name status startDate endDate")
      .populate("batchHistory.batch", "name status startDate endDate");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error updating profile",
    });
  }
};

const changeUserBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { batchId, role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID",
      });
    }

    if (!["student", "mentor"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be student or mentor",
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
        message: "Admin batch cannot be changed",
      });
    }

    const batch = await Batch.findById(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    const oldRole = user.role;

    user.batch = batch._id;
    user.role = role;

    if (!Array.isArray(user.batchHistory)) {
      user.batchHistory = [];
    }

    const existingHistoryIndex = user.batchHistory.findIndex(
      (item) => item.batch && item.batch.toString() === batch._id.toString(),
    );

    if (existingHistoryIndex === -1) {
      user.batchHistory.push({
        batch: batch._id,
        role,
        joinedAt: new Date(),
      });
    } else {
      user.batchHistory[existingHistoryIndex].role = role;
    }

    if (oldRole === "student" && role === "mentor") {
      await User.updateMany(
        {},
        {
          $pull: {
            assignedStudents: user._id,
          },
        },
      );
      user.assignedMentors = [];
    }

    if (oldRole === "mentor" && role === "student") {
      await User.updateMany(
        {},
        {
          $pull: {
            assignedMentors: user._id,
          },
        },
      );
      user.assignedStudents = [];
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select("-password")
      .populate("batch", "name status startDate endDate description")
      .populate(
        "batchHistory.batch",
        "name status startDate endDate description",
      );

    return res.status(200).json({
      success: true,
      message: `User moved to ${batch.name} as ${role}`,
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error changing user batch",
    });
  }
};

module.exports = {
  createUser,
  updateUserStatus,
  assignMentor,
  getStudents,
  getMentors,
  getMyStudents,
  getMyRiskStatus,
  getStudentDashboard,
  updateStudentRiskStatus,
  getAtRiskStudents,
  deleteUser,
  getBlacklistedUsers,
  getProfile,
  updateProfile,
  changeUserBatch,
};
