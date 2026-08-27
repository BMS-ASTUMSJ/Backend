const mongoose = require("mongoose");
const fs = require("fs");

const MentorAssignment = require("../models/mentorAssignment");
const User = require("../models/user");

const deleteUploadedFiles = (files = []) => {
  if (!Array.isArray(files)) return;

  files.forEach((file) => {
    try {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (error) {
      console.error("Uploaded file cleanup error:", error.message);
    }
  });
};

const formatUploadedFiles = (files = []) => {
  if (!Array.isArray(files)) return [];

  return files.map((file) => ({
    originalName: file.originalname,
    fileName: file.filename,
    fileUrl: `/uploads/assignments/${file.filename}`,
    mimetype: file.mimetype,
    size: file.size,
  }));
};

const createMentorAssignment = async (req, res) => {
  try {
    const {
      title,
      description,
      instructorName,
      deadline,
      link = "",
    } = req.body;

    const mentor = await User.findById(req.user._id).select(
      "_id firstName lastName email role assignedStudents",
    );

    if (!mentor) {
      deleteUploadedFiles(req.files);

      return res.status(404).json({
        success: false,
        message: "Mentor not found.",
      });
    }

    if (mentor.role !== "mentor") {
      deleteUploadedFiles(req.files);

      return res.status(403).json({
        success: false,
        message: "Only mentors can create assignments.",
      });
    }

    if (!title || !String(title).trim()) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "Assignment title is required.",
      });
    }

    if (!description || !String(description).trim()) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "Assignment description is required.",
      });
    }

    if (!instructorName || !String(instructorName).trim()) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "Instructor name is required.",
      });
    }

    if (!deadline) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "Deadline is required.",
      });
    }

    const parsedDeadline = new Date(deadline);

    if (Number.isNaN(parsedDeadline.getTime())) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "Invalid deadline.",
      });
    }

    if (parsedDeadline <= new Date()) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "Deadline must be in the future.",
      });
    }

    const studentIds = Array.isArray(mentor.assignedStudents)
      ? mentor.assignedStudents
      : [];

    if (studentIds.length === 0) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "You do not have any assigned students.",
      });
    }

    const students = await User.find({
      _id: {
        $in: studentIds,
      },
      role: "student",
    }).select("_id firstName lastName email");

    if (students.length === 0) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "No valid assigned students were found.",
      });
    }

    const files = formatUploadedFiles(req.files || []);

    const assignment = await MentorAssignment.create({
      title: String(title).trim(),

      description: String(description).trim(),

      instructorName: String(instructorName).trim(),

      mentor: mentor._id,

      assignedStudents: students.map((student) => student._id),

      deadline: parsedDeadline,

      link: link ? String(link).trim() : "",

      files,
    });

    const result = await MentorAssignment.findById(assignment._id)
      .populate("mentor", "firstName lastName email")
      .populate("assignedStudents", "firstName lastName email")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Assignment created successfully.",
      assignment: result,
    });
  } catch (error) {
    console.error("CREATE MENTOR ASSIGNMENT ERROR:", error);

    deleteUploadedFiles(req.files);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create mentor assignment.",
    });
  }
};

const getMentorAssignments = async (req, res) => {
  try {
    const assignments = await MentorAssignment.find({
      mentor: req.user._id,
    })
      .populate("assignedStudents", "firstName lastName email")
      .sort({
        createdAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error("GET MENTOR ASSIGNMENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch mentor assignments.",
    });
  }
};

const getStudentMentorAssignments = async (req, res) => {
  try {
    console.log("====================================");
    console.log("STUDENT MENTOR ASSIGNMENTS HIT");
    console.log("USER:", req.user);
    console.log("USER ID:", req.user?._id);
    console.log("USER ROLE:", req.user?.role);
    console.log("====================================");

    const assignments = await MentorAssignment.find({
      assignedStudents: req.user._id,
    })
      .populate("mentor", "firstName lastName email")
      .sort({
        createdAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error("GET STUDENT MENTOR ASSIGNMENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch mentor assignments.",
    });
  }
};

const getMentorAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignment ID.",
      });
    }

    const assignment = await MentorAssignment.findById(id)
      .populate("mentor", "firstName lastName email")
      .populate("assignedStudents", "firstName lastName email")
      .lean();

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    if (req.user.role === "mentor") {
      if (
        !assignment.mentor ||
        assignment.mentor._id.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view this assignment.",
        });
      }
    }

    if (req.user.role === "student") {
      const assigned = assignment.assignedStudents.some(
        (student) => student._id.toString() === req.user._id.toString(),
      );

      if (!assigned) {
        return res.status(403).json({
          success: false,
          message: "This assignment is not assigned to you.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      assignment,
    });
  } catch (error) {
    console.error("GET MENTOR ASSIGNMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch mentor assignment.",
    });
  }
};

module.exports = {
  createMentorAssignment,
  getMentorAssignments,
  getStudentMentorAssignments,
  getMentorAssignment,
};
