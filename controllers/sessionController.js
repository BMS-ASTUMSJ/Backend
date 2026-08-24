const mongoose = require("mongoose");
const Session = require("../models/session");
const Batch = require("../models/batch");
const Team = require("../models/team");

const VALID_TYPES = [
  "Lecture",
  "Experience Sharing",
  "Contest",
  "Daily Standup",
  "Sunday Meeting",
];

const getStartOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const createSession = async (req, res) => {
  try {
    const { batchId, week, type, date, name, order, teamId } = req.body;
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
        message: "Invalid session type",
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

    const today = getStartOfDay(new Date());
    if (getStartOfDay(sessionDate) < today) {
      return res.status(400).json({
        success: false,
        message: "Session date cannot be in the past. Must be today or a future date.",
      });
    }

    let sessionOrder = Number(order) || 1;
    let sessionName = name && name.trim();

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
      sessionName = sessionName || type;
      sessionOrder = sessionOrder || 1;
    }

    const session = await Session.create({
      batch: batchId,
      team: teamId && mongoose.Types.ObjectId.isValid(teamId) ? teamId : null,
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

    return res.status(500).json({
      success: false,
      message: "Server error while creating session",
      error: error.message,
    });
  }
};

const generateWeekSessions = async (req, res) => {
  try {
    const { batchId, week, lectureCount, weekStartDate, dates } = req.body;
    const adminId = req.user?._id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!batchId || !week) {
      return res.status(400).json({
        success: false,
        message: "batchId and week are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID",
      });
    }

    const weekNumber = Number(week);
    const lectures = Math.min(Math.max(Number(lectureCount) || 2, 1), 5);

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

    const baseDate = weekStartDate
      ? new Date(weekStartDate)
      : dates?.default
      ? new Date(dates.default)
      : new Date();

    if (Number.isNaN(baseDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start date",
      });
    }

    const today = getStartOfDay(new Date());
    if (getStartOfDay(baseDate) < today) {
      return res.status(400).json({
        success: false,
        message: "Week start date cannot be in the past. Must be today or a future date.",
      });
    }

    const addDays = (d, days) => {
      const result = new Date(d);
      result.setDate(result.getDate() + days);
      return result;
    };

    const providedDates = dates || {};
    const sessionsToCreate = [];
    const lectureDayOffsets = [0, 1, 2, 3, 4];

    for (let i = 1; i <= lectures; i++) {
      const specificDate = providedDates[`lecture${i}`];
      const assignedDate = specificDate
        ? new Date(specificDate)
        : addDays(baseDate, lectureDayOffsets[i - 1] || i - 1);

      if (getStartOfDay(assignedDate) < today) {
        return res.status(400).json({
          success: false,
          message: `Lecture ${i} date cannot be in the past.`,
        });
      }

      sessionsToCreate.push({
        batch: batchId,
        week: weekNumber,
        type: "Lecture",
        name: `Lecture ${i}`,
        order: i,
        date: assignedDate,
        createdBy: adminId,
      });
    }

    const expDate = providedDates.experienceSharing
      ? new Date(providedDates.experienceSharing)
      : addDays(baseDate, 3);

    if (getStartOfDay(expDate) < today) {
      return res.status(400).json({
        success: false,
        message: "Experience Sharing date cannot be in the past.",
      });
    }

    sessionsToCreate.push({
      batch: batchId,
      week: weekNumber,
      type: "Experience Sharing",
      name: "Experience Sharing",
      order: 1,
      date: expDate,
      createdBy: adminId,
    });

    const contestDate = providedDates.contest
      ? new Date(providedDates.contest)
      : addDays(baseDate, 5);

    if (getStartOfDay(contestDate) < today) {
      return res.status(400).json({
        success: false,
        message: "Contest date cannot be in the past.",
      });
    }

    sessionsToCreate.push({
      batch: batchId,
      week: weekNumber,
      type: "Contest",
      name: "Contest",
      order: 1,
      date: contestDate,
      createdBy: adminId,
    });

    await Session.deleteMany({ batch: batchId, week: weekNumber });

    const created = await Session.insertMany(sessionsToCreate);

    return res.status(201).json({
      success: true,
      message: `Week ${weekNumber} sessions generated successfully across future days.`,
      sessions: created,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while generating week sessions",
      error: error.message,
    });
  }
};

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
      date: 1,
      order: 1,
    });

    return res.status(200).json({
      success: true,
      sessions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while listing sessions",
      error: error.message,
    });
  }
};

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
      date: 1,
      order: 1,
    });

    return res.status(200).json({
      success: true,
      sessions,
      batchId: team.batch,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error while listing sessions",
      error: error.message,
    });
  }
};

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
      { new: true }
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