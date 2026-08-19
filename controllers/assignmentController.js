const mongoose = require("mongoose");
const Assignment = require("../models/Assignment");
const Batch = require("../models/Batch");



const createAssignment = async (req, res) => {
  try {
    const {
      title,
      description,
      deadline,
      maxScore = 100,
    } = req.body;

    

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Assignment title is required.",
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Assignment description is required.",
      });
    }

    if (!deadline) {
      return res.status(400).json({
        success: false,
        message: "Deadline is required.",
      });
    }

    if (Number(maxScore) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Maximum score must be greater than 0.",
      });
    }



    const activeBatch = await Batch.findOne({
      status: "active",
    });

    if (!activeBatch) {
      return res.status(400).json({
        success: false,
        message: "There is no active batch. Activate a batch first.",
      });
    }


    const assignment = await Assignment.create({
      title: title.trim(),
      description: description.trim(),
      batch: activeBatch._id,
      deadline,
      maxScore: Number(maxScore),
    });

    const populatedAssignment =
      await Assignment.findById(assignment._id)
        .populate("batch", "name status")
        .lean();

    return res.status(201).json({
      success: true,
      message: `Assignment created successfully for ${activeBatch.name}.`,
      assignment: populatedAssignment,
    });
  } catch (error) {
    console.error("CREATE ASSIGNMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create assignment.",
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

   
    if (req.user.role === "admin") {
      const assignments = await Assignment.find()
        .populate("batch", "name status")
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        count: assignments.length,
        assignments,
      });
    }

   

    if (
      req.user.role !== "student" &&
      req.user.role !== "mentor"
    ) {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    // User must have a current batch
    if (!req.user.batch) {
      return res.status(200).json({
        success: true,
        count: 0,
        assignments: [],
      });
    }

  

    const assignments = await Assignment.find({
      batch: req.user.batch,
    })
      .populate("batch", "name status")
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
      message: "Failed to fetch assignments.",
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
      .populate("batch", "name status")
      .lean();

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }


    if (req.user.role === "admin") {
      return res.status(200).json({
        success: true,
        assignment,
      });
    }


    if (
      req.user.role !== "student" &&
      req.user.role !== "mentor"
    ) {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

  
    const belongsToCurrentBatch =
      req.user.batch &&
      assignment.batch?._id.toString() ===
        req.user.batch.toString();

    const belongsToHistoricalBatch = (
      req.user.batchHistory || []
    ).some(
      (history) =>
        history.batch &&
        history.batch.toString() ===
          assignment.batch?._id.toString()
    );

    if (
      !belongsToCurrentBatch &&
      !belongsToHistoricalBatch
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to view this assignment.",
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

   

    if (req.user.role === "admin") {
      const assignments = await Assignment.find()
        .populate("batch", "name status")
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        count: assignments.length,
        assignments,
      });
    }

  

    if (
      req.user.role !== "student" &&
      req.user.role !== "mentor"
    ) {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    
    const historicalBatchIds = (
      req.user.batchHistory || []
    )
      .filter(
        (history) =>
          history.batch &&
          (history.role === "student" ||
            history.role === "mentor")
      )
      .map((history) => history.batch);

    if (historicalBatchIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        assignments: [],
      });
    }

    

    const previousBatchIds = req.user.batch
      ? historicalBatchIds.filter(
          (batchId) =>
            batchId.toString() !==
            req.user.batch.toString()
        )
      : historicalBatchIds;

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
      .populate("batch", "name status")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error(
      "GET ASSIGNMENT HISTORY ERROR:",
      error
    );

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
      deadline,
      maxScore,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignment ID.",
      });
    }

    
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Assignment title is required.",
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: "Assignment description is required.",
      });
    }

    if (!deadline) {
      return res.status(400).json({
        success: false,
        message: "Deadline is required.",
      });
    }

    if (Number(maxScore) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Maximum score must be greater than 0.",
      });
    }

    
    const assignment =
      await Assignment.findByIdAndUpdate(
        id,
        {
          title: title.trim(),
          description: description.trim(),
          deadline,
          maxScore: Number(maxScore),
        },
        {
          new: true,
          runValidators: true,
        }
      )
        .populate("batch", "name status");

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Assignment updated successfully.",
      assignment,
    });
  } catch (error) {
    console.error(
      "UPDATE ASSIGNMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update assignment.",
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

    const assignment =
      await Assignment.findByIdAndDelete(id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Assignment deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE ASSIGNMENT ERROR:",
      error
    );

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