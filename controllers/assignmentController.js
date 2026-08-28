const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const Assignment = require("../models/assignment");
const Batch = require("../models/batch");
const User = require("../models/user");
const Team = require("../models/team");

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
    console.error("File deletion error:", error.message);
  }
};

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

const getActiveBatch = async () => {
  let batch = await Batch.findOne({
    status: "active",
  });

  if (!batch) {
    batch = await Batch.findOne({
      isRegistrationOpen: true,
    });
  }

  return batch;
};

const getUserWithBatch = async (userId) => {
  return User.findById(userId)
    .select("_id role batch batchHistory firstName lastName email")
    .lean();
};

const getUserAccessibleBatchIds = async (userId) => {
  const user = await getUserWithBatch(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  const batchIds = new Set();
  if (user.batch) {
    batchIds.add(user.batch.toString());
  }

  if (Array.isArray(user.batchHistory)) {
    user.batchHistory.forEach((history) => {
      if (history?.batch) {
        const id = history.batch._id
          ? history.batch._id.toString()
          : history.batch.toString();

        batchIds.add(id);
      }
    });
  }

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

const getUserCurrentBatchId = async (userId) => {
  const user = await getUserWithBatch(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.batch) {
    return user.batch.toString();
  }

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

const createAssignment = async (req, res) => {
  try {
    console.log("CREATE ASSIGNMENT BODY:", req.body);
    console.log(
      "CREATE ASSIGNMENT FILES:",
      req.files?.map((file) => file.originalname),
    );

    const {
      title,
      description,
      instructorName,
      deadline,
      maxScore = 100,
      link = "",
    } = req.body;

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

    const score = Number(maxScore);

    if (Number.isNaN(score) || score <= 0) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "Maximum score must be greater than 0.",
      });
    }
    // ACTIVE BATCH
    // --------------------------------------------------

    const activeBatch = await getActiveBatch();

    if (!activeBatch) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message:
          "No active batch was found. Please activate a batch before publishing an assignment.",
      });
    }

    const uploadedFiles = formatUploadedFiles(req.files || []);

    const assignment = await Assignment.create({
      title: String(title).trim(),
      description: String(description).trim(),
      instructorName: String(instructorName).trim(),
      batch: activeBatch._id,
      deadline: parsedDeadline,
      maxScore: score,
      link: link ? String(link).trim() : "",
      files: uploadedFiles,
    });

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate("batch", "name status startDate endDate")
      .lean();

    console.log("ASSIGNMENT CREATED:", assignment._id);

    return res.status(201).json({
      success: true,
      message: `Assignment created successfully for ${activeBatch.name}.`,
      assignment: populatedAssignment,
    });
  } catch (error) {
    console.error("CREATE ASSIGNMENT ERROR:", error);

    deleteUploadedFiles(req.files);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create assignment.",
    });
  }
};

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

    if (!["student", "mentor"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    const batchIds = await getUserAccessibleBatchIds(req.user._id);

    const validBatchIds = batchIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );

    if (validBatchIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        assignments: [],
        message: "You are not assigned to a batch.",
      });
    }

    const assignments = await Assignment.find({
      batch: {
        $in: validBatchIds,
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
    console.error("GET ASSIGNMENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assignments.",
    });
  }
};

const getAssignment = async (req, res) => {
  try {
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

    if (role === "admin") {
      return res.status(200).json({
        success: true,
        assignment,
      });
    }

    const accessibleBatchIds = await getUserAccessibleBatchIds(req.user._id);

    const assignmentBatchId = assignment.batch?._id
      ? assignment.batch._id.toString()
      : assignment.batch?.toString();

    if (!accessibleBatchIds.includes(assignmentBatchId)) {
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
    console.error("GET ASSIGNMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assignment.",
    });
  }
};

const getAssignmentHistory = async (req, res) => {
  try {
    const user = await getUserWithBatch(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const role = String(user.role || "").toLowerCase();

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

    const accessibleBatchIds = await getUserAccessibleBatchIds(req.user._id);
    const currentBatchId = await getUserCurrentBatchId(req.user._id);

    const previousBatchIds = accessibleBatchIds.filter(
      (batchId) => batchId !== currentBatchId,
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
        $in: previousBatchIds,
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
    console.error("GET ASSIGNMENT HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assignment history.",
    });
  }
};

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

    if (title !== undefined) {
      if (!String(title).trim()) {
        deleteUploadedFiles(req.files);

        return res.status(400).json({
          success: false,
          message: "Assignment title cannot be empty.",
        });
      }

      assignment.title = String(title).trim();
    }

    if (description !== undefined) {
      if (!String(description).trim()) {
        deleteUploadedFiles(req.files);

        return res.status(400).json({
          success: false,
          message: "Assignment description cannot be empty.",
        });
      }

      assignment.description = String(description).trim();
    }

    if (instructorName !== undefined) {
      if (!String(instructorName).trim()) {
        deleteUploadedFiles(req.files);

        return res.status(400).json({
          success: false,
          message: "Instructor name cannot be empty.",
        });
      }

      assignment.instructorName = String(instructorName).trim();
    }

    if (deadline !== undefined && deadline !== "") {
      const parsedDeadline = new Date(deadline);

      if (Number.isNaN(parsedDeadline.getTime())) {
        deleteUploadedFiles(req.files);

        return res.status(400).json({
          success: false,
          message: "Invalid deadline.",
        });
      }

      assignment.deadline = parsedDeadline;
    }

    if (maxScore !== undefined && maxScore !== "") {
      const score = Number(maxScore);

      if (Number.isNaN(score) || score <= 0) {
        deleteUploadedFiles(req.files);

        return res.status(400).json({
          success: false,
          message: "Maximum score must be greater than 0.",
        });
      }

      assignment.maxScore = score;
    }

    if (link !== undefined) {
      assignment.link = link ? String(link).trim() : "";
    }

    const newFiles = formatUploadedFiles(req.files || []);

    const shouldReplaceFiles = replaceFiles === true || replaceFiles === "true";

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
    console.error("UPDATE ASSIGNMENT ERROR:", error);

    deleteUploadedFiles(req.files);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update assignment.",
    });
  }
};

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
    console.error("DELETE ASSIGNMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete assignment.",
    });
  }
};

module.exports = {
  createAssignment,
  getAssignments,
  getAssignment,
  getAssignmentHistory,
  updateAssignment,
  deleteAssignment,
};
