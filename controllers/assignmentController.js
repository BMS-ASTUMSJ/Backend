const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const Assignment = require("../models/Assignment");
const Batch = require("../models/batch");
const User = require("../models/user");

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
    console.error("FILE DELETE ERROR:", error.message);
  }
};

const deleteUploadedFiles = (files = []) => {
  if (!Array.isArray(files)) return;

  files.forEach((file) => {
    if (file?.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (error) {
        console.error("UPLOAD CLEANUP ERROR:", error.message);
      }
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
  return await Batch.findOne({
    status: "active",
  });
};

const getUserWithBatch = async (userId) => {
  return await User.findById(userId)
    .select("_id role batch batchHistory")
    .lean();
};

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

    const activeBatch = await getActiveBatch();

    if (!activeBatch) {
      deleteUploadedFiles(req.files);

      return res.status(400).json({
        success: false,
        message: "There is no active batch. Activate a batch first.",
      });
    }

    const uploadedFiles = formatUploadedFiles(req.files || []);

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

    console.log("GET ASSIGNMENTS");
    console.log("User ID:", user._id.toString());
    console.log("User role:", role);
    console.log("User batch:", user.batch);

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

    if (role !== "student" && role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    if (!user.batch) {
      return res.status(200).json({
        success: true,
        count: 0,
        assignments: [],
        message: "You are not assigned to a batch.",
      });
    }

    const batchId = user.batch._id
      ? user.batch._id.toString()
      : user.batch.toString();

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Your assigned batch ID is invalid.",
      });
    }

    const assignments = await Assignment.find({
      batch: new mongoose.Types.ObjectId(batchId),
    })
      .populate("batch", "name status startDate endDate")
      .sort({ createdAt: -1 })
      .lean();

    console.log("Batch ID:", batchId);
    console.log("Assignments found:", assignments.length);

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

    if (role === "admin") {
      return res.status(200).json({
        success: true,
        assignment,
      });
    }

    if (role !== "student" && role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    const assignmentBatchId = assignment.batch?._id?.toString();

    const currentBatchId = user.batch
      ? user.batch._id
        ? user.batch._id.toString()
        : user.batch.toString()
      : null;

    const belongsToCurrentBatch =
      currentBatchId &&
      assignmentBatchId &&
      currentBatchId === assignmentBatchId;

    const belongsToHistoricalBatch = (user.batchHistory || []).some(
      (history) => {
        if (!history.batch) return false;

        const historyBatchId = history.batch._id
          ? history.batch._id.toString()
          : history.batch.toString();

        return historyBatchId === assignmentBatchId;
      },
    );

    if (!belongsToCurrentBatch && !belongsToHistoricalBatch) {
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
    console.error("GET SINGLE ASSIGNMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch assignment.",
    });
  }
};

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

    if (role !== "student" && role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    const historicalBatchIds = (user.batchHistory || [])
      .filter((history) => history.batch)
      .map((history) => {
        return history.batch._id ? history.batch._id : history.batch;
      });

    const uniqueHistoricalBatchIds = [
      ...new Set(historicalBatchIds.map((id) => id.toString())),
    ];

    if (uniqueHistoricalBatchIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        assignments: [],
      });
    }

    const currentBatchId = user.batch
      ? user.batch._id
        ? user.batch._id.toString()
        : user.batch.toString()
      : null;

    const previousBatchIds = currentBatchId
      ? uniqueHistoricalBatchIds.filter((id) => id !== currentBatchId)
      : uniqueHistoricalBatchIds;

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
    console.error("GET ASSIGNMENT HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch assignment history.",
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
      if (!title.trim()) {
        deleteUploadedFiles(req.files);

        return res.status(400).json({
          success: false,
          message: "Assignment title cannot be empty.",
        });
      }

      assignment.title = title.trim();
    }

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

    if (deadline !== undefined && deadline) {
      assignment.deadline = deadline;
    }

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

    if (link !== undefined) {
      assignment.link = link ? link.trim() : "";
    }

    const newFiles = formatUploadedFiles(req.files || []);

    const shouldReplaceFiles = replaceFiles === "true" || replaceFiles === true;

    if (shouldReplaceFiles) {
      assignment.files.forEach((file) => {
        deleteLocalFile(file.fileUrl);
      });

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

    assignment.files.forEach((file) => {
      deleteLocalFile(file.fileUrl);
    });

    await Assignment.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Assignment deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE ASSIGNMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete assignment.",
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
