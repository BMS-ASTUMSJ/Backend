const mongoose = require("mongoose");

const Session = require("../models/session");
const Batch = require("../models/batch");
const Team = require("../models/team");

// ============================================================
// CONSTANTS
// ============================================================

const VALID_TYPES = ["Lecture", "Experience Sharing", "Contest"];

// ============================================================
// CREATE A SINGLE SESSION
// ============================================================
//
// Mostly used for one-off additions (e.g. an extra makeup
// lecture). For normal weekly setup, prefer generateWeekSessions.
// ============================================================

const createSession = async (req, res) => {
  try {
    const { batchId, week, type, date, name, order } = req.body;
    const adminId = req.user?._id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!batchId || !week || !type || !date) {
      return res.status(400).json({
        success: false,
        message: "batchId, week, type and date are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID",
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid session type. Must be Lecture, Experience Sharing or Contest",
      });
    }

    const weekNumber = Number(week);

    if (!Number.isInteger(weekNumber) || weekNumber < 1) {
      return res.status(400).json({
        success: false,
        message: "Week must be a positive integer",
      });
    }

    const batch = await Batch.findById(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    const sessionDate = new Date(date);

    if (Number.isNaN(sessionDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid session date",
      });
    }

    let sessionOrder = Number(order) || 1;
    let sessionName = name && name.trim();

    // ========================================================
    // AUTO-NAMING FOR LECTURES
    // ========================================================
    //
    // Lecture count per week is dynamic. If no name is given,
    // figure out the next lecture number for this batch/week.
    // ========================================================

    if (type === "Lecture") {
      if (!sessionName) {
        const existingLectures = await Session.countDocuments({
          batch: batchId,
          week: weekNumber,
          type: "Lecture",
          isActive: true,
        });

        sessionOrder = existingLectures + 1;
        sessionName = `Lecture ${sessionOrder}`;
      }
    } else {
      // Contest / Experience Sharing are singular per week by convention,
      // but an explicit name still overrides this.
      sessionName = sessionName || type;
      sessionOrder = sessionOrder || 1;
    }

    const session = await Session.create({
      batch: batchId,
      week: weekNumber,
      type,
      name: sessionName,
      order: sessionOrder,
      date: sessionDate,
      createdBy: adminId,
    });

    return res.status(201).json({
      success: true,
      message: "Session created successfully",
      session,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A session with this name already exists for this batch/week",
      });
    }

    console.error("createSession error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while creating session",
      error: error.message,
    });
  }
};

// ============================================================
// GENERATE A FULL WEEK OF SESSIONS
// ============================================================
//
// This is the main tool Admins use week to week. They specify
// how many lectures that week has (2, 4, or any number) and the
// system automatically creates that many Lecture sessions plus
// one Contest and one Experience Sharing session.
//
// Body:
// {
//   batchId, week, lectureCount,
//   dates: {
//     lecture1: "2026-08-24", lecture2: "2026-08-26",
//     lecture3: "2026-08-28", lecture4: "2026-08-30",
//     contest: "2026-08-29", experienceSharing: "2026-08-31",
//     default: "2026-08-24"   // fallback if a specific one is omitted
//   }
// }
// ============================================================

const generateWeekSessions = async (req, res) => {
  try {
    const { batchId, week, lectureCount, dates } = req.body;
    const adminId = req.user?._id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!batchId || !week || !lectureCount) {
      return res.status(400).json({
        success: false,
        message: "batchId, week and lectureCount are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID",
      });
    }

    const weekNumber = Number(week);
    const lectures = Number(lectureCount);

    if (!Number.isInteger(weekNumber) || weekNumber < 1) {
      return res.status(400).json({
        success: false,
        message: "Week must be a positive integer",
      });
    }

    if (!Number.isInteger(lectures) || lectures < 1 || lectures > 10) {
      return res.status(400).json({
        success: false,
        message: "lectureCount must be a positive integer (max 10)",
      });
    }

    const batch = await Batch.findById(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    const providedDates = dates || {};
    const fallbackDate = providedDates.default
      ? new Date(providedDates.default)
      : new Date();

    if (Number.isNaN(fallbackDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid default date",
      });
    }

    const resolveDate = (value) => {
      const parsed = value ? new Date(value) : fallbackDate;
      return Number.isNaN(parsed.getTime()) ? fallbackDate : parsed;
    };

    const sessionsToCreate = [];

    for (let i = 1; i <= lectures; i++) {
      sessionsToCreate.push({
        batch: batchId,
        week: weekNumber,
        type: "Lecture",
        name: `Lecture ${i}`,
        order: i,
        date: resolveDate(providedDates[`lecture${i}`]),
        createdBy: adminId,
      });
    }

    sessionsToCreate.push({
      batch: batchId,
      week: weekNumber,
      type: "Contest",
      name: "Contest",
      order: 1,
      date: resolveDate(providedDates.contest),
      createdBy: adminId,
    });

    sessionsToCreate.push({
      batch: batchId,
      week: weekNumber,
      type: "Experience Sharing",
      name: "Experience Sharing",
      order: 1,
      date: resolveDate(providedDates.experienceSharing),
      createdBy: adminId,
    });

    // Replace any existing sessions for this batch/week so
    // regenerating a week (e.g. changing 2 lectures -> 4) is safe
    // and doesn't create duplicates/orphans.
    //
    // NOTE: if attendance has already been marked against a
    // session being removed here, that attendance history stays
    // in the Attendance collection (it is not deleted) but will
    // no longer be reachable through an active Session. Regenerate
    // a week's sessions BEFORE attendance has been marked for it.
    await Session.deleteMany({ batch: batchId, week: weekNumber });

    const created = await Session.insertMany(sessionsToCreate);

    return res.status(201).json({
      success: true,
      message: `Week ${weekNumber} sessions generated (${lectures} lecture(s) + Contest + Experience Sharing)`,
      sessions: created,
    });
  } catch (error) {
    console.error("generateWeekSessions error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while generating week sessions",
      error: error.message,
    });
  }
};

// ============================================================
// LIST SESSIONS FOR A BATCH (ADMIN)
// ============================================================

const listSessionsForBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { week } = req.query;

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID",
      });
    }

    const query = {
      batch: batchId,
      isActive: true,
    };

    if (week) {
      query.week = Number(week);
    }

    const sessions = await Session.find(query).sort({
      week: 1,
      type: 1,
      order: 1,
    });

    return res.status(200).json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error("listSessionsForBatch error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while listing sessions",
      error: error.message,
    });
  }
};

// ============================================================
// LIST SESSIONS FOR THE LOGGED-IN MENTOR'S TEAM BATCH
// ============================================================
//
// Mentors never create sessions — they just see whatever the
// admin has configured for their team's batch and mark attendance
// against it.
// ============================================================

const listSessionsForMentor = async (req, res) => {
  try {
    const team = await Team.findOne({ mentors: req.user._id });

    if (!team || !team.batch) {
      return res.status(200).json({
        success: true,
        sessions: [],
        batchId: null,
      });
    }

    const { week } = req.query;

    const query = {
      batch: team.batch,
      isActive: true,
    };

    if (week) {
      query.week = Number(week);
    }

    const sessions = await Session.find(query).sort({
      week: 1,
      type: 1,
      order: 1,
    });

    return res.status(200).json({
      success: true,
      sessions,
      batchId: team.batch,
    });
  } catch (error) {
    console.error("listSessionsForMentor error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while listing sessions",
      error: error.message,
    });
  }
};

// ============================================================
// DEACTIVATE (SOFT-DELETE) A SESSION
// ============================================================

const deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
    }

    const session = await Session.findByIdAndUpdate(
      sessionId,
      { isActive: false },
      { new: true },
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Session removed",
    });
  } catch (error) {
    console.error("deleteSession error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while deleting session",
      error: error.message,
    });
  }
};

module.exports = {
  createSession,
  generateWeekSessions,
  listSessionsForBatch,
  listSessionsForMentor,
  deleteSession,
};
