const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const Assignment = require("../models/Assignment");
const Batch = require("../models/batch");
const User = require("../models/user");
const Team = require("../models/team");

// ======================================================
// DELETE LOCAL FILE
// ======================================================

const deleteLocalFile = (fileUrl) => {
  if (!fileUrl) return;

  try {
    const fileName = path.basename(fileUrl);

    const filePath = path.join(
      __dirname,
      "..",
      "uploads",
      "assignments",
      fileName,
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    // File deletion failure should not break the request
  }
};

// ======================================================
// DELETE UPLOADED FILES
// ======================================================

const deleteUploadedFiles = (files = []) => {
  if (!Array.isArray(files)) return;

  files.forEach((file) => {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
};

// ======================================================
// FORMAT UPLOADED FILES
// ======================================================

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

// ======================================================
// GET ACTIVE BATCH
// ======================================================

const getActiveBatch = async () => {
  return Batch.findOne({
    status: "active",
  });
};

// ======================================================
// GET USER
// ======================================================

const getUserWithBatch = async (userId) => {
  return User.findById(userId)
    .select("_id role batch batchHistory firstName lastName email")
    .lean();
};

// ======================================================
// GET USER ACCESSIBLE BATCH IDS
//
// STUDENT:
//   User.batch + batchHistory
//
// MENTOR:
//   Team.batch through Team.mentors
//   + batchHistory
//
// ADMIN:
//   handled separately
// ======================================================

const getUserAccessibleBatchIds = async (userId) => {
  const user = await getUserWithBatch(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  const batchIds = new Set();

  // ----------------------------------------------------
  // USER CURRENT BATCH
  // ----------------------------------------------------

  if (user.batch) {
    batchIds.add(user.batch.toString());
  }

  // ----------------------------------------------------
  // USER BATCH HISTORY
  // ----------------------------------------------------

  if (Array.isArray(user.batchHistory)) {
    user.batchHistory.forEach((history) => {
      if (history?.batch) {
        const batchId = history.batch._id
          ? history.batch._id.toString()
          : history.batch.toString();

        batchIds.add(batchId);
      }
    });
  }

  // ----------------------------------------------------
  // MENTOR TEAM BATCHES
  // ----------------------------------------------------

  if (user.role === "mentor") {
    const teams = await Team.find({
      mentors: userId,
    })
      .select("batch")
      .lean();

    teams.forEach((team) => {
      if (team.batch) {
        batchIds.add(team.batch.toString());
      }
    });
  }

  return [...batchIds];
};

// ======================================================
// GET CURRENT BATCH FOR USER
//
// STUDENT:
//   user.batch
//
// MENTOR:
//   first team batch
//
// If mentor.batch exists, it is preferred.
// ======================================================

const getUserCurrentBatchId = async (userId) => {
  const user = await getUserWithBatch(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  // ----------------------------------------------------
  // USER BATCH
  // ----------------------------------------------------

  if (user.batch) {
    return user.batch.toString();
  }

  // ----------------------------------------------------
  // MENTOR TEAM BATCH
  // ----------------------------------------------------

  if (user.role === "mentor") {
    const team = await Team.findOne({
      mentors: userId,
    })
      .select("batch")
      .sort({ createdAt: -1 })
      .lean();

    if (team?.batch) {
      return team.batch.toString();
    }
  }

  return null;
};

// ======================================================
// CREATE ASSIGNMENT
// ======================================================

const createAssignment = async (req, res) => {
  try {
    const {
      title,
      description,
      instructorName,
      deadline,
      maxScore = 100,
      link = "",
    } = req.body;

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (!title || !title.trim()) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "Assignment title is required.",
      });
    }

    if (!description || !description.trim()) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "Assignment description is required.",
      });
    }

    if (!instructorName || !instructorName.trim()) {
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

    if (Number(maxScore) <= 0) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "Maximum score must be greater than 0.",
      });
    }

    // --------------------------------------------------
    // ACTIVE BATCH
    // --------------------------------------------------

    const activeBatch = await getActiveBatch();

    if (!activeBatch) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "There is no active batch. Activate a batch first.",
      });
    }

    // --------------------------------------------------
    // FILES
    // --------------------------------------------------

    const uploadedFiles = formatUploadedFiles(req.files || []);

    // --------------------------------------------------
    // CREATE
    // --------------------------------------------------

    const assignment = await Assignment.create({
      title: title.trim(),
      description: description.trim(),
      instructorName: instructorName.trim(),
      batch: activeBatch._id,
      deadline,
      maxScore: Number(maxScore),
      link: link ? link.trim() : "",
      files: uploadedFiles,
    });

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate("batch", "name status startDate endDate")
      .lean();

    return res.status(201).json({
      success: true,
      message: `Assignment created successfully for ${activeBatch.name}.`,
      assignment: populatedAssignment,
    });
  } catch (error) {
    deleteUploadedFiles(req.files);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create assignment.",
    });
  }
};

// ======================================================
// GET ASSIGNMENTS
// ======================================================

const getAssignments = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated.",
      });
    }

    const user = await getUserWithBatch(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const role = String(user.role || "").toLowerCase();

    // --------------------------------------------------
    // ADMIN
    // --------------------------------------------------

    if (role === "admin") {
      const assignments = await Assignment.find({})
        .populate("batch", "name status startDate endDate")
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        count: assignments.length,
        assignments,
      });
    }

    // --------------------------------------------------
    // STUDENT / MENTOR
    // --------------------------------------------------

    if (role !== "student" && role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    const batchIds = await getUserAccessibleBatchIds(req.user._id);

    if (batchIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        assignments: [],
        message: "You are not assigned to a batch.",
      });
    }

    const validBatchIds = batchIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );

    if (validBatchIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your assigned batch ID is invalid.",
      });
    }

    const assignments = await Assignment.find({
      batch: {
        $in: validBatchIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    })
      .populate("batch", "name status startDate endDate")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assignments.",
    });
  }
};

// ======================================================
// GET SINGLE ASSIGNMENT
// ======================================================

const getAssignment = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated.",
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignment ID.",
      });
    }

    const assignment = await Assignment.findById(id)
      .populate("batch", "name status startDate endDate")
      .lean();

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    const user = await getUserWithBatch(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const role = String(user.role || "").toLowerCase();

    // --------------------------------------------------
    // ADMIN
    // --------------------------------------------------

    if (role === "admin") {
      return res.status(200).json({
        success: true,
        assignment,
      });
    }

    // --------------------------------------------------
    // STUDENT / MENTOR
    // --------------------------------------------------

    if (role !== "student" && role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    const accessibleBatchIds = await getUserAccessibleBatchIds(req.user._id);

    const assignmentBatchId = assignment.batch?._id
      ? assignment.batch._id.toString()
      : assignment.batch?.toString();

    const authorized = accessibleBatchIds.some(
      (batchId) => batchId === assignmentBatchId,
    );

    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this assignment.",
      });
    }

    return res.status(200).json({
      success: true,
      assignment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assignment.",
    });
  }
};

// ======================================================
// GET ASSIGNMENT HISTORY
// ======================================================

const getAssignmentHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated.",
      });
    }

    const user = await getUserWithBatch(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const role = String(user.role || "").toLowerCase();

    // --------------------------------------------------
    // ADMIN
    // --------------------------------------------------

    if (role === "admin") {
      const assignments = await Assignment.find({})
        .populate("batch", "name status startDate endDate")
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        count: assignments.length,
        assignments,
      });
    }

    // --------------------------------------------------
    // STUDENT / MENTOR
    // --------------------------------------------------

    if (role !== "student" && role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    const accessibleBatchIds = await getUserAccessibleBatchIds(req.user._id);

    const currentBatchId = await getUserCurrentBatchId(req.user._id);

    const previousBatchIds = accessibleBatchIds.filter(
      (id) => id !== currentBatchId,
    );

    if (previousBatchIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        assignments: [],
      });
    }

    const assignments = await Assignment.find({
      batch: {
        $in: previousBatchIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    })
      .populate("batch", "name status startDate endDate")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assignment history.",
    });
  }
};

// ======================================================
// UPDATE ASSIGNMENT
// ======================================================

const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      description,
      instructorName,
      deadline,
      maxScore,
      link,
      replaceFiles,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "Invalid assignment ID.",
      });
    }

    const assignment = await Assignment.findById(id);

    if (!assignment) {
      deleteUploadedFiles(req.files);

      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    // --------------------------------------------------
    // TITLE
    // --------------------------------------------------

    if (title !== undefined) {
      if (!title.trim()) {
        deleteUploadedFiles(req.files);

        return res.status(400).json({
          success: false,
          message: "Assignment title cannot be empty.",
        });
      }

      assignment.title = title.trim();
    }

    // --------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------

    if (description !== undefined) {
      if (!description.trim()) {
        deleteUploadedFiles(req.files);

        return res.status(400).json({
          success: false,
          message: "Assignment description cannot be empty.",
        });
      }

      assignment.description = description.trim();
    }

    // --------------------------------------------------
    // INSTRUCTOR
    // --------------------------------------------------

    if (instructorName !== undefined) {
      if (!instructorName.trim()) {
        deleteUploadedFiles(req.files);

        return res.status(400).json({
          success: false,
          message: "Instructor name cannot be empty.",
        });
      }

      assignment.instructorName = instructorName.trim();
    }

    // --------------------------------------------------
    // DEADLINE
    // --------------------------------------------------

    if (deadline !== undefined && deadline) {
      assignment.deadline = deadline;
    }

    // --------------------------------------------------
    // MAX SCORE
    // --------------------------------------------------

    if (maxScore !== undefined) {
      if (Number(maxScore) <= 0) {
        deleteUploadedFiles(req.files);

        return res.status(400).json({
          success: false,
          message: "Maximum score must be greater than 0.",
        });
      }

      assignment.maxScore = Number(maxScore);
    }

    // --------------------------------------------------
    // LINK
    // --------------------------------------------------

    if (link !== undefined) {
      assignment.link = link ? link.trim() : "";
    }

    // --------------------------------------------------
    // FILES
    // --------------------------------------------------

    const newFiles = formatUploadedFiles(req.files || []);

    const shouldReplaceFiles = replaceFiles === "true" || replaceFiles === true;

    if (shouldReplaceFiles) {
      if (Array.isArray(assignment.files)) {
        assignment.files.forEach((file) => {
          deleteLocalFile(file.fileUrl);
        });
      }

      assignment.files = newFiles;
    } else if (newFiles.length > 0) {
      assignment.files.push(...newFiles);
    }

    await assignment.save();

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate("batch", "name status startDate endDate")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Assignment updated successfully.",
      assignment: populatedAssignment,
    });
  } catch (error) {
    deleteUploadedFiles(req.files);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update assignment.",
    });
  }
};

// ======================================================
// DELETE ASSIGNMENT
// ======================================================

const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignment ID.",
      });
    }

    const assignment = await Assignment.findById(id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    if (Array.isArray(assignment.files)) {
      assignment.files.forEach((file) => {
        deleteLocalFile(file.fileUrl);
      });
    }

    await Assignment.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Assignment deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete assignment.",
    });
  }
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  createAssignment,
  getAssignments,
  getAssignment,
  getAssignmentHistory,
  updateAssignment,
  deleteAssignment,
};
