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

const getStartOfDay = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);

  return date;
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
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

    if (!isValidObjectId(batchId)) {
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
    const selectedDate = getStartOfDay(sessionDate);

    if (!selectedDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid session date",
      });
    }

    if (selectedDate < today) {
      return res.status(400).json({
        success: false,
        message:
          "Session date cannot be in the past. Must be today or a future date.",
      });
    }

    let sessionOrder = Number(order) || 1;
    let sessionName = name?.trim() || "";

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
      team: teamId && isValidObjectId(teamId) ? teamId : null,
      week: weekNumber,
      type,
      name: sessionName,
      order: sessionOrder,
      date: sessionDate,
      createdBy: adminId,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Session created successfully",
      session,
    });
  } catch (error) {
    console.error("Create session error:", error);

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
    const { batchId, week, lectureCount, dates } = req.body;

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

    if (!isValidObjectId(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID",
      });
    }

    const weekNumber = Number(week);

    if (!Number.isInteger(weekNumber) || weekNumber < 1) {
      return res.status(400).json({
        success: false,
        message: "Week must be a positive integer",
      });
    }

    const requestedLectureCount = Number(lectureCount);

    const lectures =
      Number.isInteger(requestedLectureCount) && requestedLectureCount >= 1
        ? requestedLectureCount
        : 1;

    const batch = await Batch.findById(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    const today = getStartOfDay(new Date());

    const sessionsToCreate = [];

    for (let i = 0; i < lectures; i++) {
      const lectureNumber = i + 1;

      const rawDate = dates?.[`lecture${lectureNumber}`];

      if (
        rawDate === undefined ||
        rawDate === null ||
        String(rawDate).trim() === ""
      ) {
        continue;
      }

      const lectureDate = new Date(rawDate);

      if (Number.isNaN(lectureDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: `Invalid date for Lecture ${lectureNumber}.`,
        });
      }

      const lectureDay = getStartOfDay(lectureDate);

      if (!lectureDay) {
        return res.status(400).json({
          success: false,
          message: `Invalid date for Lecture ${lectureNumber}.`,
        });
      }

      if (lectureDay < today) {
        return res.status(400).json({
          success: false,
          message: `Lecture ${lectureNumber} date cannot be in the past.`,
        });
      }

      sessionsToCreate.push({
        batch: batchId,
        team: null,
        week: weekNumber,
        type: "Lecture",
        name: `Lecture ${lectureNumber}`,
        order: lectureNumber,
        date: lectureDate,
        createdBy: adminId,
        isActive: true,
      });
    }

    const experienceSharingDate = dates?.experienceSharing;

    if (
      experienceSharingDate !== undefined &&
      experienceSharingDate !== null &&
      String(experienceSharingDate).trim() !== ""
    ) {
      const expDate = new Date(experienceSharingDate);

      if (Number.isNaN(expDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid Experience Sharing date.",
        });
      }

      const expDay = getStartOfDay(expDate);

      if (!expDay) {
        return res.status(400).json({
          success: false,
          message: "Invalid Experience Sharing date.",
        });
      }

      if (expDay < today) {
        return res.status(400).json({
          success: false,
          message: "Experience Sharing date cannot be in the past.",
        });
      }

      sessionsToCreate.push({
        batch: batchId,
        team: null,
        week: weekNumber,
        type: "Experience Sharing",
        name: "Experience Sharing",
        order: lectures + 1,
        date: expDate,
        createdBy: adminId,
        isActive: true,
      });
    }

    const contestDate = dates?.contest;

    if (
      contestDate !== undefined &&
      contestDate !== null &&
      String(contestDate).trim() !== ""
    ) {
      const contest = new Date(contestDate);

      if (Number.isNaN(contest.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid Contest date.",
        });
      }

      const contestDay = getStartOfDay(contest);

      if (!contestDay) {
        return res.status(400).json({
          success: false,
          message: "Invalid Contest date.",
        });
      }

      if (contestDay < today) {
        return res.status(400).json({
          success: false,
          message: "Contest date cannot be in the past.",
        });
      }

      sessionsToCreate.push({
        batch: batchId,
        team: null,
        week: weekNumber,
        type: "Contest",
        name: "Contest",
        order: lectures + 2,
        date: contest,
        createdBy: adminId,
        isActive: true,
      });
    }

    await Session.deleteMany({
      batch: batchId,
      week: weekNumber,
    });

    let created = [];

    if (sessionsToCreate.length > 0) {
      created = await Session.insertMany(sessionsToCreate);
    }

    return res.status(201).json({
      success: true,

      message:
        created.length > 0
          ? `Week ${weekNumber} schedule generated successfully.`
          : `Week ${weekNumber} has no scheduled sessions.`,

      sessions: created,

      lectureCount: lectures,

      lecturesCreated: created.filter((session) => session.type === "Lecture")
        .length,

      experienceSharingCreated: created.some(
        (session) => session.type === "Experience Sharing",
      ),

      contestCreated: created.some((session) => session.type === "Contest"),
    });
  } catch (error) {
    console.error("Generate week sessions error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate session detected for this batch/week.",
      });
    }

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

    if (!isValidObjectId(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID",
      });
    }

    const query = {
      batch: batchId,
      isActive: true,
    };

    if (week !== undefined && week !== "") {
      const weekNumber = Number(week);

      if (!Number.isInteger(weekNumber) || weekNumber < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid week number",
        });
      }

      query.week = weekNumber;
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
    console.error("List batch sessions error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while listing sessions",
      error: error.message,
    });
  }
};
const listSessionsForMentor = async (req, res) => {
  try {
    const team = await Team.findOne({
      mentors: req.user._id,
    });

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

    if (week !== undefined && week !== "") {
      const weekNumber = Number(week);

      if (!Number.isInteger(weekNumber) || weekNumber < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid week number",
        });
      }

      query.week = weekNumber;
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
    console.error("List mentor sessions error:", error);

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

    if (!isValidObjectId(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
    }

    const session = await Session.findByIdAndUpdate(
      sessionId,
      {
        isActive: false,
      },
      {
        new: true,
      },
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
    console.error("Delete session error:", error);

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
