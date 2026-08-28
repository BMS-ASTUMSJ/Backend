const mongoose = require("mongoose");

const Attendance = require("../models/attendance");
const Session = require("../models/session");
const Team = require("../models/team");
const User = require("../models/user");
const Batch = require("../models/batch");

// ================================================================
// RISK SERVICE
// ================================================================

let calculateStudentRisk = null;

try {
  const riskService = require("../services/atRiskService");

  calculateStudentRisk = riskService.calculateStudentRisk || riskService;
} catch (error) {
  console.warn("At-risk service could not be loaded:", error.message);

  calculateStudentRisk = null;
}

// ================================================================
// CONSTANTS
// ================================================================

const VALID_STATUSES = ["Present", "Absent", "Late", "Excused"];

const VALID_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const VALID_MEETING_TYPES = ["Daily Meeting", "Sunday Weekly Meeting"];

const VALID_CHECK_TYPES = ["first", "second"];

const GENERAL_SESSION_TYPES = ["Lecture", "Experience Sharing", "Contest"];

const TEAM_SESSION_TYPES = [
  "Daily Standup",
  "Daily Meeting",
  "Sunday Meeting",
  "Sunday Weekly Meeting",
  "Team Meeting",
];

// This is the value stored in the Session model for automatically
// created team-meeting sessions.
const TEAM_SESSION_MODEL_TYPE = "Daily Standup";

// ================================================================
// ATTENDANCE WEIGHT
// ================================================================

const getAttendanceWeight = (status) => {
  switch (status) {
    case "Present":
      return 1;

    case "Late":
      return 0.5;

    case "Absent":
      return 0;

    case "Excused":
      return null;

    default:
      return null;
  }
};

// ================================================================
// CALCULATE ATTENDANCE CHECKS
// ================================================================

const calculateChecks = (records = []) => {
  let earnedPoints = 0;
  let applicableChecks = 0;

  let presentChecks = 0;
  let absentChecks = 0;
  let lateChecks = 0;
  let excusedChecks = 0;

  records.forEach((record) => {
    const checks = [record?.firstCheck, record?.secondCheck];

    checks.forEach((check) => {
      if (!check?.status) {
        return;
      }

      const status = check.status;
      const weight = getAttendanceWeight(status);

      if (status === "Present") {
        presentChecks++;
      }

      if (status === "Absent") {
        absentChecks++;
      }

      if (status === "Late") {
        lateChecks++;
      }

      if (status === "Excused") {
        excusedChecks++;
      }

      // Excused attendance is excluded from the denominator.
      if (weight === null) {
        return;
      }

      earnedPoints += weight;
      applicableChecks++;
    });
  });

  const attendanceRate =
    applicableChecks > 0
      ? Number(((earnedPoints / applicableChecks) * 100).toFixed(1))
      : 0;

  return {
    earnedPoints: Number(earnedPoints.toFixed(2)),

    applicableChecks,

    presentChecks,

    absentChecks,

    lateChecks,

    excusedChecks,

    attendanceRate,
  };
};

// ================================================================
// OVERALL STATUS
// ================================================================

const calculateOverallStatus = (firstStatus, secondStatus) => {
  const statuses = [firstStatus, secondStatus].filter(Boolean);

  if (statuses.length === 0) {
    return "Not Marked";
  }

  if (statuses.includes("Absent")) {
    return "Absent";
  }

  if (statuses.includes("Late")) {
    return "Late";
  }

  if (statuses.includes("Excused")) {
    return "Excused";
  }

  if (statuses.includes("Present")) {
    return "Present";
  }

  return "Not Marked";
};

// ================================================================
// FIND MENTOR TEAM
// ================================================================

const findMentorTeam = async (mentorId) => {
  return Team.findOne({
    mentors: mentorId,
  });
};

// ================================================================
// CHECK STUDENT BELONGS TO TEAM
// ================================================================

const studentBelongsToTeam = (team, studentId) => {
  if (!team) {
    return false;
  }

  if (!Array.isArray(team.students)) {
    return false;
  }

  return team.students.some((student) => {
    const id = student?._id || student;

    return String(id) === String(studentId);
  });
};

// ================================================================
// NORMALIZE TEAM MEETING TYPE
// ================================================================

const normalizeMeetingType = (meetingType, dayName) => {
  let resolvedMeetingType =
    meetingType ||
    (dayName === "Sunday" ? "Sunday Weekly Meeting" : "Daily Meeting");

  // Backward compatibility
  if (resolvedMeetingType === "Sunday Meeting") {
    resolvedMeetingType = "Sunday Weekly Meeting";
  }

  if (resolvedMeetingType === "Daily Standup") {
    resolvedMeetingType = "Daily Meeting";
  }

  return resolvedMeetingType;
};

// ================================================================
// CREATE / GET TEAM MEETING SESSION
// ================================================================

const getOrCreateTeamMeetingSession = async ({
  team,
  mentorId,
  week,
  dayName,
  meetingType,
}) => {
  if (!team?.batch) {
    throw new Error("Team batch is required to create a team meeting session");
  }

  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const sessionName = `${meetingType} - ${dayName}`;

  // Automatically-created team sessions use
  // "Daily Standup" in the Session model for
  // backward compatibility.
  let session = await Session.findOne({
    batch: team.batch,
    week,
    type: TEAM_SESSION_MODEL_TYPE,
    name: sessionName,
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  });

  if (session) {
    return session;
  }

  session = await Session.create({
    batch: team.batch,

    week,

    type: TEAM_SESSION_MODEL_TYPE,

    name: sessionName,

    date: now,

    createdBy: mentorId,

    isActive: true,
  });

  return session;
};

// ================================================================
// MARK BULK ATTENDANCE
// ================================================================

const markBulkAttendance = async (req, res) => {
  try {
    const { sessionId, week, dayName, meetingType, attendanceList } = req.body;

    const mentorId = req.user?._id;
    const mentorGender = req.user?.gender;

    // ============================================================
    // AUTH
    // ============================================================

    if (!mentorId) {
      return res.status(401).json({
        success: false,
        message: "Mentor authentication required",
      });
    }

    // ============================================================
    // VALIDATE ATTENDANCE LIST
    // ============================================================

    if (!Array.isArray(attendanceList) || attendanceList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "attendanceList must contain at least one student",
      });
    }

    // ============================================================
    // FIND MENTOR TEAM
    // ============================================================

    const team = await findMentorTeam(mentorId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "You are not assigned to a team",
      });
    }

    if (!team.batch) {
      return res.status(400).json({
        success: false,
        message: "Your team does not have a batch assigned",
      });
    }

    if (!mentorGender) {
      return res.status(403).json({
        success: false,
        message: "Mentor gender information is required",
      });
    }

    // ============================================================
    // VALIDATE STUDENT IDS
    // ============================================================

    const studentIds = attendanceList.map((item) => item?.studentId);

    for (const studentId of studentIds) {
      if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid student ID: ${studentId}`,
        });
      }
    }

    // ============================================================
    // LOAD STUDENTS
    // ============================================================

    const students = await User.find({
      _id: {
        $in: studentIds,
      },
      role: "student",
    });

    const studentMap = new Map(
      students.map((student) => [String(student._id), student]),
    );

    const teamStudentIds = new Set(
      (team.students || []).map((student) => String(student?._id || student)),
    );

    // ============================================================
    // MAIN COHORT SESSION
    // ============================================================

    if (sessionId) {
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid session ID",
        });
      }

      const session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Session not found",
        });
      }

      if (session.isActive === false) {
        return res.status(400).json({
          success: false,
          message: "This session is no longer active",
        });
      }

      if (String(team.batch) !== String(session.batch)) {
        return res.status(403).json({
          success: false,
          message: "This session does not belong to your team's batch",
        });
      }

      const savedRecords = [];

      // ----------------------------------------------------------
      // PROCESS EACH STUDENT
      // ----------------------------------------------------------

      for (const item of attendanceList) {
        const currentStudentId = String(item.studentId);

        const student = studentMap.get(currentStudentId);

        if (!student) {
          return res.status(404).json({
            success: false,
            message: `Student not found: ${currentStudentId}`,
          });
        }

        // --------------------------------------------------------
        // TEAM SECURITY
        // --------------------------------------------------------

        if (!teamStudentIds.has(currentStudentId)) {
          return res.status(403).json({
            success: false,
            message: `${student.firstName} ${student.lastName} is not assigned to your team`,
          });
        }

        // --------------------------------------------------------
        // GENDER SECURITY
        // --------------------------------------------------------

        if (student.gender !== mentorGender) {
          return res.status(403).json({
            success: false,
            message: `You cannot mark attendance for ${student.firstName} ${student.lastName}`,
          });
        }

        // --------------------------------------------------------
        // BATCH SECURITY
        // --------------------------------------------------------

        if (String(student.batch) !== String(session.batch)) {
          return res.status(403).json({
            success: false,
            message: `Student ${student.firstName} does not belong to this session's batch`,
          });
        }

        // --------------------------------------------------------
        // STATUS
        // --------------------------------------------------------

        const firstStatus = item.firstCheck || "Present";

        const secondStatus = item.secondCheck || "Present";

        if (!VALID_STATUSES.includes(firstStatus)) {
          return res.status(400).json({
            success: false,
            message: `Invalid first check status for ${student.firstName} ${student.lastName}`,
          });
        }

        if (!VALID_STATUSES.includes(secondStatus)) {
          return res.status(400).json({
            success: false,
            message: `Invalid second check status for ${student.firstName} ${student.lastName}`,
          });
        }

        // --------------------------------------------------------
        // FIND EXISTING RECORD
        // --------------------------------------------------------

        const now = new Date();

        let record = await Attendance.findOne({
          studentId: student._id,

          teamId: team._id,

          sessionId: session._id,
        });

        // --------------------------------------------------------
        // UPDATE EXISTING
        // --------------------------------------------------------

        if (record) {
          record.studentId = student._id;

          record.batchId = session.batch;

          record.teamId = team._id;

          record.sessionId = session._id;

          record.week = session.week;

          record.sessionType = session.type;

          record.sessionName = session.name;

          record.date = session.date || now;

          record.gender = student.gender;

          record.status = calculateOverallStatus(firstStatus, secondStatus);

          record.firstCheck = {
            status: firstStatus,
            markedBy: mentorId,
            timestamp: now,
          };

          record.secondCheck = {
            status: secondStatus,
            markedBy: mentorId,
            timestamp: now,
          };

          await record.save();
        }

        // --------------------------------------------------------
        // CREATE NEW
        // --------------------------------------------------------
        else {
          record = await Attendance.create({
            studentId: student._id,

            batchId: session.batch,

            teamId: team._id,

            sessionId: session._id,

            week: session.week,

            sessionType: session.type,

            sessionName: session.name,

            date: session.date || now,

            gender: student.gender,

            status: calculateOverallStatus(firstStatus, secondStatus),

            firstCheck: {
              status: firstStatus,
              markedBy: mentorId,
              timestamp: now,
            },

            secondCheck: {
              status: secondStatus,
              markedBy: mentorId,
              timestamp: now,
            },
          });
        }

        savedRecords.push(record);
      }

      // ==========================================================
      // RISK CALCULATION
      // ==========================================================

      if (calculateStudentRisk && typeof calculateStudentRisk === "function") {
        await Promise.all(
          students.map((student) =>
            calculateStudentRisk(student._id, session.batch).catch(
              (riskError) => {
                console.error("Risk calculation failed:", riskError.message);
              },
            ),
          ),
        );
      }

      return res.status(200).json({
        success: true,

        message: "Attendance sheet submitted successfully!",

        count: savedRecords.length,

        sessionId: session._id,
      });
    }

    // ============================================================
    // TEAM MEETING
    // ============================================================

    if (week === undefined || week === null || !dayName) {
      return res.status(400).json({
        success: false,
        message: "For team meetings, week and dayName are required",
      });
    }

    const numericWeek = Number(week);

    if (!Number.isInteger(numericWeek) || numericWeek < 1) {
      return res.status(400).json({
        success: false,
        message: "week must be a positive integer",
      });
    }

    if (!VALID_DAYS.includes(dayName)) {
      return res.status(400).json({
        success: false,
        message: "Invalid meeting day",
      });
    }

    const resolvedMeetingType = normalizeMeetingType(meetingType, dayName);

    // Sunday must always use Sunday Weekly Meeting.
    if (
      dayName === "Sunday" &&
      resolvedMeetingType !== "Sunday Weekly Meeting"
    ) {
      return res.status(400).json({
        success: false,
        message: "Sunday must use Sunday Weekly Meeting",
      });
    }

    // Monday-Saturday must use Daily Meeting.
    if (dayName !== "Sunday" && resolvedMeetingType !== "Daily Meeting") {
      return res.status(400).json({
        success: false,
        message: "Monday-Saturday must use Daily Meeting",
      });
    }

    // ============================================================
    // GET / CREATE TEAM SESSION
    // ============================================================

    const teamMeetingSession = await getOrCreateTeamMeetingSession({
      team,

      mentorId,

      week: numericWeek,

      dayName,

      meetingType: resolvedMeetingType,
    });

    const savedRecords = [];

    // ============================================================
    // PROCESS STUDENTS
    // ============================================================

    for (const item of attendanceList) {
      const currentStudentId = String(item.studentId);

      const student = studentMap.get(currentStudentId);

      if (!student) {
        return res.status(404).json({
          success: false,
          message: `Student not found: ${currentStudentId}`,
        });
      }

      // ----------------------------------------------------------
      // TEAM SECURITY
      // ----------------------------------------------------------

      if (!teamStudentIds.has(currentStudentId)) {
        return res.status(403).json({
          success: false,
          message: `${student.firstName} ${student.lastName} is not assigned to your team`,
        });
      }

      // ----------------------------------------------------------
      // GENDER SECURITY
      // ----------------------------------------------------------

      if (student.gender !== mentorGender) {
        return res.status(403).json({
          success: false,
          message: `You cannot mark attendance for ${student.firstName} ${student.lastName}`,
        });
      }

      // ----------------------------------------------------------
      // BATCH SECURITY
      // ----------------------------------------------------------

      if (String(student.batch) !== String(team.batch)) {
        return res.status(403).json({
          success: false,
          message: `Student ${student.firstName} does not belong to your team's batch`,
        });
      }

      // ----------------------------------------------------------
      // STATUS
      // ----------------------------------------------------------

      const firstStatus = item.firstCheck || "Present";

      const secondStatus = item.secondCheck || "Present";

      if (!VALID_STATUSES.includes(firstStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid first check status for ${student.firstName} ${student.lastName}`,
        });
      }

      if (!VALID_STATUSES.includes(secondStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid second check status for ${student.firstName} ${student.lastName}`,
        });
      }

      const now = new Date();

      // ----------------------------------------------------------
      // FIND EXISTING RECORD
      // ----------------------------------------------------------

      let record = await Attendance.findOne({
        studentId: student._id,

        teamId: team._id,

        sessionId: teamMeetingSession._id,
      });

      // ----------------------------------------------------------
      // UPDATE
      // ----------------------------------------------------------

      if (record) {
        record.studentId = student._id;

        record.batchId = team.batch;

        record.teamId = team._id;

        record.sessionId = teamMeetingSession._id;

        record.week = numericWeek;

        record.dayName = dayName;

        record.meetingType = resolvedMeetingType;

        record.sessionType = "Team Meeting";

        record.sessionName = `${resolvedMeetingType} - ${dayName}`;

        record.date = teamMeetingSession.date || now;

        record.gender = student.gender;

        record.status = calculateOverallStatus(firstStatus, secondStatus);

        record.firstCheck = {
          status: firstStatus,
          markedBy: mentorId,
          timestamp: now,
        };

        record.secondCheck = {
          status: secondStatus,
          markedBy: mentorId,
          timestamp: now,
        };

        await record.save();
      }

      // ----------------------------------------------------------
      // CREATE
      // ----------------------------------------------------------
      else {
        record = await Attendance.create({
          studentId: student._id,

          batchId: team.batch,

          teamId: team._id,

          sessionId: teamMeetingSession._id,

          week: numericWeek,

          dayName,

          meetingType: resolvedMeetingType,

          sessionType: "Team Meeting",

          sessionName: `${resolvedMeetingType} - ${dayName}`,

          date: teamMeetingSession.date || now,

          gender: student.gender,

          status: calculateOverallStatus(firstStatus, secondStatus),

          firstCheck: {
            status: firstStatus,
            markedBy: mentorId,
            timestamp: now,
          },

          secondCheck: {
            status: secondStatus,
            markedBy: mentorId,
            timestamp: now,
          },
        });
      }

      savedRecords.push(record);
    }

    // ============================================================
    // RISK CALCULATION
    // ============================================================

    if (calculateStudentRisk && typeof calculateStudentRisk === "function") {
      await Promise.all(
        students.map((student) =>
          calculateStudentRisk(student._id, team.batch).catch((riskError) => {
            console.error("Risk calculation failed:", riskError.message);
          }),
        ),
      );
    }

    // ============================================================
    // SUCCESS
    // ============================================================

    return res.status(200).json({
      success: true,

      message: "Team attendance sheet submitted successfully!",

      count: savedRecords.length,

      sessionId: teamMeetingSession._id,

      week: numericWeek,

      dayName,

      meetingType: resolvedMeetingType,
    });
  } catch (error) {
    console.error("================================================");

    console.error("MARK BULK ATTENDANCE ERROR:");

    console.error(error);

    console.error("================================================");

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate attendance record detected",
        error: error.message,
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Attendance validation failed",
        error: error.message,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid value for ${error.path}`,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while submitting attendance sheet",
      error: error.message,
    });
  }
};

// ================================================================
// MARK SINGLE ATTENDANCE
// ================================================================

const markAttendance = async (req, res) => {
  try {
    const {
      studentId,
      sessionId,
      week,
      dayName,
      meetingType,
      checkType,
      status,
    } = req.body;

    const mentorId = req.user?._id;

    // ============================================================
    // AUTH
    // ============================================================

    if (!mentorId) {
      return res.status(401).json({
        success: false,
        message: "Mentor authentication required",
      });
    }

    // ============================================================
    // REQUIRED FIELDS
    // ============================================================

    if (!studentId || !checkType || !status) {
      return res.status(400).json({
        success: false,
        message: "studentId, checkType and status are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    if (!VALID_CHECK_TYPES.includes(checkType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid checkType",
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status",
      });
    }

    // ============================================================
    // FIND TEAM
    // ============================================================

    const team = await findMentorTeam(mentorId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "You are not assigned to a team",
      });
    }

    // ============================================================
    // FIND STUDENT
    // ============================================================

    const student = await User.findOne({
      _id: studentId,
      role: "student",
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // ============================================================
    // TEAM SECURITY
    // ============================================================

    if (!studentBelongsToTeam(team, studentId)) {
      return res.status(403).json({
        success: false,
        message:
          "You can only manage attendance for students in your assigned team",
      });
    }

    // ============================================================
    // GENDER SECURITY
    // ============================================================

    if (req.user?.gender && student.gender !== req.user.gender) {
      return res.status(403).json({
        success: false,
        message: "You cannot mark attendance for this student",
      });
    }

    // ============================================================
    // SESSION
    // ============================================================

    let session = null;

    if (sessionId) {
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid session ID",
        });
      }

      session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Session not found",
        });
      }

      if (session.isActive === false) {
        return res.status(400).json({
          success: false,
          message: "This session is no longer active",
        });
      }

      if (
        team.batch &&
        session.batch &&
        String(team.batch) !== String(session.batch)
      ) {
        return res.status(403).json({
          success: false,
          message: "This session does not belong to your team's batch",
        });
      }

      // Main cohort sessions only.
      if (!GENERAL_SESSION_TYPES.includes(session.type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid main session type: ${session.type}`,
        });
      }
    }

    // ============================================================
    // DETERMINE WHETHER MAIN OR TEAM SESSION
    // ============================================================

    const isMainSession = Boolean(session);

    // ============================================================
    // WEEK
    // ============================================================

    const targetWeek = isMainSession ? Number(session.week) : Number(week);

    if (!Number.isInteger(targetWeek) || targetWeek < 1) {
      return res.status(400).json({
        success: false,
        message: "week must be a positive integer",
      });
    }

    // ============================================================
    // DAY
    // ============================================================

    const targetDayName =
      dayName ||
      (session?.date
        ? new Date(session.date).toLocaleDateString("en-US", {
            weekday: "long",
          })
        : "Monday");

    if (!VALID_DAYS.includes(targetDayName)) {
      return res.status(400).json({
        success: false,
        message: "Invalid day name",
      });
    }

    // ============================================================
    // MEETING / SESSION TYPE
    // ============================================================

    let targetMeetingType;

    if (isMainSession) {
      targetMeetingType = session.type;
    } else {
      targetMeetingType = normalizeMeetingType(meetingType, targetDayName);

      if (
        targetDayName === "Sunday" &&
        targetMeetingType !== "Sunday Weekly Meeting"
      ) {
        return res.status(400).json({
          success: false,
          message: "Sunday must use Sunday Weekly Meeting",
        });
      }

      if (targetDayName !== "Sunday" && targetMeetingType !== "Daily Meeting") {
        return res.status(400).json({
          success: false,
          message: "Monday-Saturday must use Daily Meeting",
        });
      }
    }

    // ============================================================
    // TEAM MEETING SESSION
    // ============================================================

    let teamMeetingSession = null;

    if (!isMainSession) {
      teamMeetingSession = await getOrCreateTeamMeetingSession({
        team,

        mentorId,

        week: targetWeek,

        dayName: targetDayName,

        meetingType: targetMeetingType,
      });

      session = teamMeetingSession;
    }

    // ============================================================
    // BATCH
    // ============================================================

    const batchId = session?.batch || team.batch;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: "Unable to determine batch for attendance",
      });
    }

    // ============================================================
    // SESSION NAME
    // ============================================================

    const targetSessionName = isMainSession
      ? session.name || session.type
      : `${targetMeetingType} - ${targetDayName}`;

    // ============================================================
    // EXISTING RECORD
    // ============================================================

    const filter = {
      studentId: student._id,

      teamId: team._id,

      sessionId: session._id,
    };

    const existingRecord = await Attendance.findOne(filter);

    // ============================================================
    // PRESERVE OTHER CHECK
    // ============================================================

    const firstStatus =
      checkType === "first"
        ? status
        : existingRecord?.firstCheck?.status || null;

    const secondStatus =
      checkType === "second"
        ? status
        : existingRecord?.secondCheck?.status || null;

    // ============================================================
    // CHECK FIELD
    // ============================================================

    const checkField = checkType === "first" ? "firstCheck" : "secondCheck";

    const now = new Date();

    // ============================================================
    // CHECK DATA
    // ============================================================

    const checkData = {
      status,

      markedBy: mentorId,

      timestamp: now,
    };

    // ============================================================
    // UPDATE DATA
    // ============================================================

    const updateData = {
      studentId: student._id,

      mentorId,

      batchId,

      teamId: team._id,

      sessionId: session._id,

      week: targetWeek,

      dayName: targetDayName,

      meetingType: targetMeetingType,

      sessionType: isMainSession ? session.type : "Team Meeting",

      sessionName: targetSessionName,

      date: session.date || now,

      gender: student.gender,

      status: calculateOverallStatus(firstStatus, secondStatus),

      [checkField]: checkData,
    };

    // ============================================================
    // UPDATE OR CREATE
    // ============================================================

    const record = await Attendance.findOneAndUpdate(
      filter,

      {
        $set: updateData,
      },

      {
        new: true,

        upsert: true,

        setDefaultsOnInsert: true,

        runValidators: true,
      },
    );

    // ============================================================
    // STATISTICS
    // ============================================================

    const statistics = calculateChecks([record]);

    // ============================================================
    // RISK
    // ============================================================

    let risk = null;

    if (
      calculateStudentRisk &&
      typeof calculateStudentRisk === "function" &&
      batchId
    ) {
      try {
        risk = await calculateStudentRisk(student._id, batchId);
      } catch (riskError) {
        console.error("Attendance risk calculation failed:", riskError.message);
      }
    }

    // ============================================================
    // SUCCESS
    // ============================================================

    return res.status(200).json({
      success: true,

      message: "Attendance saved successfully",

      record,

      session,

      attendance: {
        status,

        weight: getAttendanceWeight(status),

        isExcused: status === "Excused",

        recordRate: statistics.attendanceRate,

        earnedPoints: statistics.earnedPoints,

        applicableChecks: statistics.applicableChecks,
      },

      risk,
    });
  } catch (error) {
    console.error("MARK ATTENDANCE ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate attendance record detected",
        error: error.message,
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Attendance validation failed",
        error: error.message,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid value for ${error.path}`,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while marking attendance",
      error: error.message,
    });
  }
};

// ================================================================
// GET MENTOR STUDENTS
// ================================================================

const getMentorStudents = async (req, res) => {
  try {
    const mentorId = req.user?._id;

    const mentorGender = req.user?.gender;

    if (!mentorId) {
      return res.status(401).json({
        success: false,
        message: "Mentor authentication required",
      });
    }

    const team = await Team.findOne({
      mentors: mentorId,
    })
      .populate("batch", "name status startDate endDate")
      .populate(
        "students",
        "firstName lastName fullName schoolId gender email batch",
      );

    // ============================================================
    // FALLBACK
    // ============================================================

    if (!team) {
      const mentor = await User.findById(mentorId).populate(
        "assignedStudents",
        "firstName lastName fullName schoolId gender email batch",
      );

      return res.status(200).json({
        success: true,

        teamName: "Assigned Students",

        teamId: mentorId,

        batch: mentor?.batch || null,

        students: mentor?.assignedStudents || [],
      });
    }

    // ============================================================
    // TEAM STUDENTS
    // ============================================================

    const students = (team.students || []).filter(
      (student) => !mentorGender || student.gender === mentorGender,
    );

    return res.status(200).json({
      success: true,

      teamName: team.name,

      teamId: team._id,

      teamGender: team.gender,

      batch: team.batch,

      mentorGender,

      students,
    });
  } catch (error) {
    console.error("GET MENTOR STUDENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting mentor students",
      error: error.message,
    });
  }
};

// ================================================================
// GET TEAM RECORDS FOR SESSION
// ================================================================

const getTeamRecordsForSession = async (req, res) => {
  try {
    const { sessionId, week, dayName } = req.query;

    const mentorId = req.user?._id;

    if (!mentorId) {
      return res.status(401).json({
        success: false,
        message: "Mentor authentication required",
      });
    }

    const team = await findMentorTeam(mentorId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "You are not assigned to a team",
      });
    }

    // ==========================================================
    // TEAM-RESTRICTED FILTER
    // ==========================================================

    const filter = {
      teamId: team._id,
    };

    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
      filter.sessionId = sessionId;
    }

    if (week) {
      filter.week = Number(week);
    }

    if (dayName) {
      filter.dayName = dayName;
    }

    // ==========================================================
    // GET RECORDS
    // ==========================================================

    const records = await Attendance.find(filter)
      .populate(
        "studentId",
        "firstName lastName fullName schoolId gender email",
      )
      .populate("firstCheck.markedBy", "firstName lastName email")
      .populate("secondCheck.markedBy", "firstName lastName email")
      .populate("sessionId", "name type batch week date createdBy isActive")
      .sort({
        date: 1,
        createdAt: 1,
      });

    return res.status(200).json({
      success: true,

      teamId: team._id,

      teamName: team.name || "My Team",

      records,
    });
  } catch (error) {
    console.error("GET TEAM RECORDS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting team attendance records",
      error: error.message,
    });
  }
};

// ================================================================
// GET STUDENT ATTENDANCE
// ================================================================

const getStudentAttendance = async (req, res) => {
  try {
    const { batchId } = req.query;

    const studentId = req.user?._id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Student authentication required",
      });
    }

    // ==========================================================
    // STUDENT-ONLY QUERY
    // ==========================================================

    const query = {
      studentId,
    };

    if (batchId && mongoose.Types.ObjectId.isValid(batchId)) {
      query.batchId = batchId;
    } else if (req.user?.batch) {
      query.batchId = req.user.batch;
    }

    // ==========================================================
    // RECORDS
    // ==========================================================

    const records = await Attendance.find(query)
      .populate("batchId", "name status startDate endDate")
      .populate("teamId", "name gender batch")
      .populate("sessionId", "name type batch week date createdBy isActive")
      .sort({
        date: 1,
        week: 1,
        createdAt: 1,
      });

    // ==========================================================
    // SEPARATE TRACKS
    // ==========================================================

    const generalRecords = records.filter((record) =>
      GENERAL_SESSION_TYPES.includes(record.sessionType),
    );

    const teamRecords = records.filter(
      (record) =>
        TEAM_SESSION_TYPES.includes(record.sessionType) ||
        record.sessionType === "Team Meeting",
    );

    // ==========================================================
    // STATISTICS
    // ==========================================================

    const overallStatistics = calculateChecks(records);

    const generalStatistics = calculateChecks(generalRecords);

    const teamStatistics = calculateChecks(teamRecords);

    // ==========================================================
    // RISK
    // ==========================================================

    const riskBatchId = batchId || req.user?.batch;

    let risk = {
      isAtRisk: false,
    };

    if (
      riskBatchId &&
      calculateStudentRisk &&
      typeof calculateStudentRisk === "function"
    ) {
      try {
        risk = (await calculateStudentRisk(studentId, riskBatchId)) || {
          isAtRisk: false,
        };
      } catch (riskError) {
        console.error("Risk calculation failed:", riskError.message);
      }
    }

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return res.status(200).json({
      success: true,

      records,

      percentage: overallStatistics.attendanceRate,

      generalPercentage: generalStatistics.attendanceRate,

      teamPercentage: teamStatistics.attendanceRate,

      summary: {
        totalSessions: records.length,

        totalChecks: overallStatistics.applicableChecks,

        attendedChecks: overallStatistics.earnedPoints,

        presentChecks: overallStatistics.presentChecks,

        absentChecks: overallStatistics.absentChecks,

        lateChecks: overallStatistics.lateChecks,

        excusedChecks: overallStatistics.excusedChecks,

        attendanceRate: overallStatistics.attendanceRate,

        generalTrack: generalStatistics,

        teamTrack: teamStatistics,
      },

      generalStats: generalStatistics,

      teamStats: teamStatistics,

      overallStats: overallStatistics,

      risk,
    });
  } catch (error) {
    console.error("GET STUDENT ATTENDANCE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting student attendance",
      error: error.message,
    });
  }
};

// ================================================================
// ADMIN ATTENDANCE STATS
// ================================================================

const getAdminAttendanceStats = async (req, res) => {
  try {
    const batches = await Batch.find().sort({
      createdAt: -1,
    });

    const allBatches = await Promise.all(
      batches.map(async (batch) => {
        const students = await User.find({
          batch: batch._id,

          role: "student",
        }).select("_id gender");

        const totalStudents = students.length;

        const maleStudents = students.filter(
          (student) => student.gender === "Male",
        ).length;

        const femaleStudents = students.filter(
          (student) => student.gender === "Female",
        ).length;

        const studentIds = students.map((student) => student._id);

        const records =
          studentIds.length > 0
            ? await Attendance.find({
                studentId: {
                  $in: studentIds,
                },

                batchId: batch._id,
              })
            : [];

        const statistics = calculateChecks(records);

        return {
          _id: batch._id,

          name: batch.name,

          status: batch.status,

          totalStudents,

          maleStudents,

          femaleStudents,

          totalSessions: records.length,

          totalApplicableChecks: statistics.applicableChecks,

          totalEarnedPoints: statistics.earnedPoints,

          overallAttendanceRate: statistics.attendanceRate,

          presentChecks: statistics.presentChecks,

          absentChecks: statistics.absentChecks,

          lateChecks: statistics.lateChecks,

          excusedChecks: statistics.excusedChecks,
        };
      }),
    );

    return res.status(200).json({
      success: true,

      allBatches,
    });
  } catch (error) {
    console.error("ADMIN ATTENDANCE STATS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting attendance statistics",
      error: error.message,
    });
  }
};

// ================================================================
// ADMIN BATCH REPORT
// ================================================================

const getAdminBatchReport = async (req, res) => {
  try {
    const { batchId } = req.params;

    // ==========================================================
    // VALIDATE BATCH
    // ==========================================================

    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Valid batch ID is required",
      });
    }

    const batch = await Batch.findById(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    // ==========================================================
    // STUDENTS
    // ==========================================================

    const students = await User.find({
      batch: batchId,

      role: "student",
    })
      .select("_id firstName lastName fullName schoolId gender email")
      .sort({
        firstName: 1,
        lastName: 1,
      });

    const studentIds = students.map((student) => student._id);

    // ==========================================================
    // ATTENDANCE RECORDS
    // ==========================================================

    const records =
      studentIds.length > 0
        ? await Attendance.find({
            studentId: {
              $in: studentIds,
            },

            batchId: batchId,
          }).populate(
            "sessionId",
            "name type batch week date createdBy isActive",
          )
        : [];

    // ==========================================================
    // STUDENT REPORTS
    // ==========================================================

    const studentReports = students.map((student) => {
      const studentRecords = records.filter(
        (record) => String(record.studentId) === String(student._id),
      );

      const stats = calculateChecks(studentRecords);

      const generalRecords = studentRecords.filter((record) =>
        GENERAL_SESSION_TYPES.includes(record.sessionType),
      );

      const teamRecords = studentRecords.filter(
        (record) =>
          TEAM_SESSION_TYPES.includes(record.sessionType) ||
          record.sessionType === "Team Meeting",
      );

      const generalStats = calculateChecks(generalRecords);

      const teamStats = calculateChecks(teamRecords);

      return {
        _id: student._id,

        firstName: student.firstName,

        lastName: student.lastName,

        fullName:
          student.fullName ||
          `${student.firstName || ""} ${student.lastName || ""}`.trim(),

        schoolId: student.schoolId,

        gender: student.gender,

        email: student.email,

        percentage: stats.attendanceRate,

        generalPercentage: generalStats.attendanceRate,

        teamPercentage: teamStats.attendanceRate,

        summary: stats,

        generalStats,

        teamStats,

        records: studentRecords,
      };
    });

    // ==========================================================
    // OVERALL BATCH STATISTICS
    // ==========================================================

    const overallStats = calculateChecks(records);

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return res.status(200).json({
      success: true,

      batch: {
        _id: batch._id,

        name: batch.name,

        status: batch.status,
      },

      summary: {
        totalStudents: students.length,

        totalSessions: records.length,

        overallAttendanceRate: overallStats.attendanceRate,
      },

      students: studentReports,
    });
  } catch (error) {
    console.error("ADMIN BATCH REPORT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting batch report",
      error: error.message,
    });
  }
};

// ================================================================
// EXPORTS
// ================================================================

module.exports = {
  markAttendance,

  markBulkAttendance,

  getMentorStudents,

  getTeamRecordsForSession,

  getStudentAttendance,

  getAdminAttendanceStats,

  getAdminBatchReport,
};
