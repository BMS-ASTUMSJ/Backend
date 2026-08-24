const mongoose = require("mongoose");

const Batch = require("../models/batch");
const User = require("../models/user");
const Team = require("../models/team");
const Applicant = require("../models/applicant");

// ============================================================
// HELPERS
// ============================================================

const isValidObjectId = (id) => {
  return id && mongoose.Types.ObjectId.isValid(id);
};

const uniqueIds = (ids = []) => {
  const result = [];

  for (const id of ids) {
    if (!id) continue;

    const value = id.toString();

    if (!result.includes(value)) {
      result.push(value);
    }
  }

  return result;
};

// ============================================================
// CREATE BATCH
// ============================================================

const createBatch = async (req, res) => {
  try {
    const { name, startDate, endDate, status = "upcoming" } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Batch name is required.",
      });
    }

    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: "Start date is required.",
      });
    }

    if (!["upcoming", "active", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'upcoming', 'active', or 'completed'.",
      });
    }

    const existingBatch = await Batch.findOne({
      name: name.trim(),
    });

    if (existingBatch) {
      return res.status(409).json({
        success: false,
        message: "A batch with this name already exists.",
      });
    }

    // Only one active batch
    if (status === "active") {
      await Batch.updateMany(
        { status: "active" },
        {
          $set: {
            status: "completed",
            isRegistrationOpen: false,
          },
        },
      );
    }

    const batch = await Batch.create({
      name: name.trim(),
      startDate,
      endDate: endDate || null,
      status,
    });

    return res.status(201).json({
      success: true,
      message: "Batch created successfully.",
      batch,
    });
  } catch (error) {
    console.error("Create batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while creating batch.",
      error: error.message,
    });
  }
};

// ============================================================
// GET ALL BATCHES
// ============================================================

const getBatches = async (req, res) => {
  try {
    const batches = await Batch.find().sort({
      startDate: -1,
    });

    return res.status(200).json({
      success: true,
      batches,
    });
  } catch (error) {
    console.error("Get batches error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batches.",
      error: error.message,
    });
  }
};

// ============================================================
// GET MY BATCHES
//
// IMPORTANT:
// Mentors can get their batch from:
// 1. user.batch
// 2. user.batchHistory
// 3. Team.mentors -> Team.batch
//
// This fixes the BatchHistory.jsx problem.
// ============================================================

const getMyBatches = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "role batch batchHistory firstName lastName email",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // --------------------------------------------------------
    // ADMIN
    // --------------------------------------------------------

    if (user.role === "admin") {
      const batches = await Batch.find().sort({
        createdAt: -1,
      });

      const result = batches.map((batch) => ({
        batch,
        role: "admin",
      }));

      return res.status(200).json({
        success: true,

        currentBatch: null,
        currentRole: "admin",

        batchHistory: result,

        batches: result,
      });
    }

    // --------------------------------------------------------
    // COLLECT BATCH IDS
    // --------------------------------------------------------

    const batchIds = [];

    // Current user.batch
    if (user.batch) {
      batchIds.push(user.batch);
    }

    // Historical batches
    for (const history of user.batchHistory || []) {
      if (history?.batch) {
        batchIds.push(history.batch);
      }
    }

    // --------------------------------------------------------
    // IMPORTANT MENTOR FIX
    //
    // If mentor.batch is null, find batches from teams
    // where this mentor is assigned.
    // --------------------------------------------------------

    if (user.role === "mentor") {
      const mentorTeams = await Team.find({
        mentors: user._id,
      }).select("batch");

      for (const team of mentorTeams) {
        if (team.batch) {
          batchIds.push(team.batch);
        }
      }
    }

    const uniqueBatchIds = uniqueIds(batchIds);

    // --------------------------------------------------------
    // NO BATCH
    // --------------------------------------------------------

    if (!uniqueBatchIds.length) {
      return res.status(200).json({
        success: true,

        currentBatch: null,
        currentRole: user.role,

        batchHistory: [],

        batches: [],
      });
    }

    // --------------------------------------------------------
    // GET BATCH DOCUMENTS
    // --------------------------------------------------------

    const batches = await Batch.find({
      _id: {
        $in: uniqueBatchIds,
      },
    }).sort({
      startDate: -1,
      createdAt: -1,
    });

    // --------------------------------------------------------
    // BUILD RESULT
    // --------------------------------------------------------

    const result = batches.map((batch) => {
      const batchId = batch._id.toString();

      // Check batchHistory first
      const historyItem = (user.batchHistory || []).find(
        (item) => item?.batch && item.batch.toString() === batchId,
      );

      let role = historyItem?.role || null;

      // Current user batch
      if (!role && user.batch) {
        if (user.batch.toString() === batchId) {
          role = user.role;
        }
      }

      // Mentor team membership
      if (!role && user.role === "mentor") {
        role = "mentor";
      }

      return {
        batch,
        role,
      };
    });

    // --------------------------------------------------------
    // DETERMINE CURRENT BATCH
    //
    // Priority:
    // 1. user.batch
    // 2. active batch assigned through mentor team
    // 3. first active batch in result
    // --------------------------------------------------------

    let currentBatch = null;
    let currentRole = user.role;

    // 1. user.batch
    if (user.batch) {
      currentBatch =
        result.find(
          (item) => item.batch._id.toString() === user.batch.toString(),
        ) || null;

      if (currentBatch?.role) {
        currentRole = currentBatch.role;
      }
    }

    // 2. Mentor team active batch
    if (!currentBatch && user.role === "mentor") {
      const activeResult = result.find(
        (item) => item.batch.status === "active",
      );

      if (activeResult) {
        currentBatch = activeResult;
        currentRole = "mentor";
      }
    }

    // 3. First available
    if (!currentBatch && result.length) {
      currentBatch = result[0];

      if (currentBatch.role) {
        currentRole = currentBatch.role;
      }
    }

    // --------------------------------------------------------
    // HISTORY
    // Exclude current batch from history
    // --------------------------------------------------------

    const batchHistory = result.filter((item) => {
      if (!currentBatch) return true;

      return item.batch._id.toString() !== currentBatch.batch._id.toString();
    });

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      currentBatch,

      currentRole,

      batchHistory,

      // Keep this for existing frontend code
      batches: result,
    });
  } catch (error) {
    console.error("Get my batches error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching your batches.",
      error: error.message,
    });
  }
};

// ============================================================
// GET MY BATCH
// ============================================================

const getMyBatch = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    const user = await User.findById(req.user._id).select(
      "role batch batchHistory",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const batch = await Batch.findById(id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    // --------------------------------------------------------
    // ADMIN
    // --------------------------------------------------------

    if (user.role === "admin") {
      return res.status(200).json({
        success: true,
        batch,
        role: "admin",
      });
    }

    // --------------------------------------------------------
    // BATCH HISTORY
    // --------------------------------------------------------

    const membership = (user.batchHistory || []).find(
      (item) => item?.batch && item.batch.toString() === id.toString(),
    );

    if (membership) {
      return res.status(200).json({
        success: true,
        batch,
        role: membership.role,
      });
    }

    // --------------------------------------------------------
    // CURRENT USER BATCH
    // --------------------------------------------------------

    if (user.batch && user.batch.toString() === id.toString()) {
      return res.status(200).json({
        success: true,
        batch,
        role: user.role,
      });
    }

    // --------------------------------------------------------
    // MENTOR TEAM ACCESS
    //
    // IMPORTANT FIX
    // --------------------------------------------------------

    if (user.role === "mentor") {
      const team = await Team.findOne({
        batch: id,
        mentors: user._id,
      }).select("_id name batch mentors");

      if (team) {
        return res.status(200).json({
          success: true,
          batch,
          role: "mentor",
          team,
        });
      }
    }

    return res.status(403).json({
      success: false,
      message: "You do not have access to this batch.",
    });
  } catch (error) {
    console.error("Get my batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batch.",
      error: error.message,
    });
  }
};

// ============================================================
// ACTIVE REGISTRATION BATCH
// ============================================================

const getActiveRegistrationBatch = async (req, res) => {
  try {
    const activeBatch = await Batch.findOne({
      status: "active",
      isRegistrationOpen: true,
    });

    return res.status(200).json({
      success: true,
      isRegistrationOpen: !!activeBatch,
      activeBatch: activeBatch || null,
    });
  } catch (error) {
    console.error("Get active registration batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while checking registration status.",
      error: error.message,
    });
  }
};

// ============================================================
// TOGGLE REGISTRATION
// ============================================================

const toggleBatchRegistration = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    const batch = await Batch.findById(id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    if (batch.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Only an active batch can have registration open.",
      });
    }

    const newRegistrationStatus = !batch.isRegistrationOpen;

    if (newRegistrationStatus) {
      await Batch.updateMany(
        {
          _id: { $ne: id },
          isRegistrationOpen: true,
        },
        {
          $set: {
            isRegistrationOpen: false,
          },
        },
      );
    }

    batch.isRegistrationOpen = newRegistrationStatus;

    await batch.save();

    const batches = await Batch.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,

      message: `Registration for "${batch.name}" is now ${
        newRegistrationStatus ? "OPEN" : "CLOSED"
      }.`,

      batch,

      batches,
    });
  } catch (error) {
    console.error("Toggle registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating registration status.",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE BATCH STATUS
// ============================================================

const updateBatchStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    if (!["upcoming", "active", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Batch status must be 'upcoming', 'active', or 'completed'.",
      });
    }

    const batch = await Batch.findById(id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    if (status === "active") {
      await Batch.updateMany(
        {
          _id: { $ne: id },
          status: "active",
        },
        {
          $set: {
            status: "completed",
            isRegistrationOpen: false,
          },
        },
      );
    }

    if (status !== "active") {
      batch.isRegistrationOpen = false;
    }

    batch.status = status;

    await batch.save();

    const batches = await Batch.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,

      message: `Batch "${batch.name}" status updated to ${status}.`,

      batch,

      batches,
    });
  } catch (error) {
    console.error("Update batch status error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating batch status.",
      error: error.message,
    });
  }
};

// ============================================================
// BATCH DASHBOARD STATS
// ============================================================

const getBatchDashboardStats = async (req, res) => {
  try {
    const allBatches = await Batch.find().sort({
      createdAt: -1,
    });

    const activeBatch =
      allBatches.find((batch) => batch.status === "active") || null;

    let currentBatchStats = {
      batch: null,
      studentCount: 0,
      femaleStudents: 0,
      maleStudents: 0,
      mentorCount: 0,
      teamCount: 0,
      applicantCount: 0,
    };

    if (activeBatch) {
      const [students, mentors, teams, applicants] = await Promise.all([
        User.find({
          role: "student",
          batch: activeBatch._id,
        }),

        User.find({
          role: "mentor",
          batch: activeBatch._id,
        }),

        Team.find({
          batch: activeBatch._id,
        }),

        Applicant.find({
          batch: activeBatch._id,
        }),
      ]);

      currentBatchStats = {
        batch: activeBatch,

        studentCount: students.length,

        femaleStudents: students.filter(
          (student) => student.gender === "Female",
        ).length,

        maleStudents: students.filter((student) => student.gender === "Male")
          .length,

        mentorCount: mentors.length,

        teamCount: teams.length,

        applicantCount: applicants.length,
      };
    }

    const batchHistory = await Promise.all(
      allBatches.map(async (batch) => {
        const [students, teams] = await Promise.all([
          User.find({
            $or: [
              {
                role: "student",
                batch: batch._id,
              },
              {
                batchHistory: {
                  $elemMatch: {
                    batch: batch._id,
                    role: "student",
                  },
                },
              },
            ],
          }),

          Team.find({
            batch: batch._id,
          }),
        ]);

        return {
          _id: batch._id,

          name: batch.name,

          status: batch.status,

          isRegistrationOpen: batch.isRegistrationOpen,

          startDate: batch.startDate,

          endDate: batch.endDate,

          description: batch.description,

          totalStudents: students.length,

          femaleStudents: students.filter(
            (student) => student.gender === "Female",
          ).length,

          maleStudents: students.filter((student) => student.gender === "Male")
            .length,

          totalTeams: teams.length,
        };
      }),
    );

    const [totalStudentsAllTime, totalMentors, totalApplicants] =
      await Promise.all([
        User.countDocuments({
          role: "student",
        }),

        User.countDocuments({
          role: "mentor",
        }),

        Applicant.countDocuments(),
      ]);

    const previousBatches = batchHistory.filter(
      (batch) => batch._id.toString() !== activeBatch?._id?.toString(),
    );

    return res.status(200).json({
      success: true,

      currentBatch: currentBatchStats,

      previousBatches,

      allBatches: batchHistory,

      overallStats: {
        totalBatches: allBatches.length,

        totalStudentsAllTime,

        totalMentors,

        totalApplicants,
      },
    });
  } catch (error) {
    console.error("Get batch dashboard stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batch statistics.",
      error: error.message,
    });
  }
};

// ============================================================
// BATCH STATS
// ============================================================

const getBatchStats = async (req, res) => {
  try {
    const [totalBatches, upcomingBatches, activeBatches, completedBatches] =
      await Promise.all([
        Batch.countDocuments(),

        Batch.countDocuments({
          status: "upcoming",
        }),

        Batch.countDocuments({
          status: "active",
        }),

        Batch.countDocuments({
          status: "completed",
        }),
      ]);

    return res.status(200).json({
      success: true,

      stats: {
        totalBatches,
        upcomingBatches,
        activeBatches,
        completedBatches,
      },
    });
  } catch (error) {
    console.error("Get batch stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batch statistics.",
      error: error.message,
    });
  }
};

// ============================================================
// GET BATCH BY ID
// ============================================================

const getBatchById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    const batch = await Batch.findById(id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    const [students, mentors, teams, applicants] = await Promise.all([
      User.find({
        $or: [
          {
            role: "student",
            batch: id,
          },
          {
            batchHistory: {
              $elemMatch: {
                batch: id,
                role: "student",
              },
            },
          },
        ],
      })
        .select(
          "firstName lastName email role gender phone schoolId bio profileImage githubUrl leetcodeUrl codeforcesUrl batch batchHistory",
        )
        .populate("batch", "name startDate endDate status"),

      User.find({
        $or: [
          {
            role: "mentor",
            batch: id,
          },
          {
            batchHistory: {
              $elemMatch: {
                batch: id,
                role: "mentor",
              },
            },
          },
        ],
      })
        .select(
          "firstName lastName email role gender phone bio profileImage githubUrl leetcodeUrl codeforcesUrl batch batchHistory",
        )
        .populate("batch", "name startDate endDate status"),

      Team.find({
        batch: id,
      }),

      Applicant.find({
        batch: id,
      }),
    ]);

    return res.status(200).json({
      success: true,

      batch,

      students,

      mentors,

      teams,

      applicants,

      studentCount: students.length,

      mentorCount: mentors.length,

      teamCount: teams.length,

      applicantCount: applicants.length,
    });
  } catch (error) {
    console.error("Get batch details error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batch details.",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE BATCH
// ============================================================

const updateBatch = async (req, res) => {
  try {
    const { name, startDate, endDate, status } = req.body;

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    const batch = await Batch.findById(id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Batch name cannot be empty.",
        });
      }

      batch.name = name.trim();
    }

    if (startDate !== undefined) {
      batch.startDate = startDate;
    }

    if (endDate !== undefined) {
      batch.endDate = endDate || null;
    }

    if (status !== undefined) {
      if (!["upcoming", "active", "completed"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid batch status.",
        });
      }

      if (status === "active") {
        await Batch.updateMany(
          {
            _id: { $ne: id },
            status: "active",
          },
          {
            $set: {
              status: "completed",
              isRegistrationOpen: false,
            },
          },
        );
      }

      if (status !== "active") {
        batch.isRegistrationOpen = false;
      }

      batch.status = status;
    }

    await batch.save();

    return res.status(200).json({
      success: true,

      message: "Batch updated successfully.",

      batch,
    });
  } catch (error) {
    console.error("Update batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating batch.",
      error: error.message,
    });
  }
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  createBatch,
  getBatches,
  getMyBatches,
  getMyBatch,
  getActiveRegistrationBatch,
  toggleBatchRegistration,
  updateBatchStatus,
  getBatchDashboardStats,
  getBatchStats,
  getBatchById,
  updateBatch,
};
