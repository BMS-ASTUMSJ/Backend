const mongoose = require("mongoose");

const Attendance = require("../models/attendance");
const Session = require("../models/session");
const Team = require("../models/team");
const User = require("../models/user");
const Batch = require("../models/batch");

let calculateStudentRisk = null;

try {
  const riskService = require("../services/atRiskService");

  calculateStudentRisk = riskService.calculateStudentRisk || riskService;
} catch (error) {
  calculateStudentRisk = null;
}

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

const TEAM_SESSION_MODEL_TYPE = "Daily Standup";

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
      } else if (status === "Absent") {
        absentChecks++;
      } else if (status === "Late") {
        lateChecks++;
      } else if (status === "Excused") {
        excusedChecks++;
      }

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

const findMentorTeam = async (mentorId) => {
  return Team.findOne({
    mentors: mentorId,
  });
};

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

  const sessionDate = now;

  const sessionName = `${meetingType} - ${dayName}`;

  const startOfDay = new Date(sessionDate);

  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(sessionDate);

  endOfDay.setHours(23, 59, 59, 999);

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

    date: sessionDate,

    createdBy: mentorId,

    isActive: true,
  });

  return session;
};

const markBulkAttendance = async (req, res) => {
  try {
    const mentorId = req.user?._id;

    if (!mentorId) {
      return res.status(401).json({
        success: false,
        message: "Mentor authentication required",
      });
    }

    const { sessionId, week, dayName, meetingType, attendanceList } = req.body;

    if (!Array.isArray(attendanceList) || attendanceList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "attendanceList must contain at least one student",
      });
    }

    const team = await Team.findOne({
      mentors: mentorId,
    });

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

    if (!req.user.gender) {
      return res.status(403).json({
        success: false,
        message: "Mentor gender information is required",
      });
    }

    const studentIds = attendanceList.map((item) => item.studentId);

    for (const studentId of studentIds) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid student ID: ${studentId}`,
        });
      }
    }

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
      (team.students || []).map((id) => String(id)),
    );

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

      for (const item of attendanceList) {
        const studentId = String(item.studentId);

        const student = studentMap.get(studentId);

        if (!student) {
          return res.status(404).json({
            success: false,
            message: `Student not found: ${studentId}`,
          });
        }

        if (!teamStudentIds.has(studentId)) {
          return res.status(403).json({
            success: false,
            message: `${student.firstName} ${student.lastName} is not assigned to your team`,
          });
        }

        if (student.gender !== req.user.gender) {
          return res.status(403).json({
            success: false,
            message: `You cannot mark attendance for ${student.firstName} ${student.lastName}`,
          });
        }

        if (String(student.batch) !== String(session.batch)) {
          return res.status(403).json({
            success: false,
            message: `Student ${student.firstName} does not belong to this session's batch`,
          });
        }

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

        let record = await Attendance.findOne({
          studentId: student._id,

          teamId: team._id,

          sessionId: session._id,
        });

        if (record) {
          record.batchId = session.batch;

          record.week = session.week;

          record.sessionType = session.type;

          record.sessionName = session.name;

          record.date = session.date || now;

          record.gender = student.gender;

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
        } else {
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

      if (calculateStudentRisk && typeof calculateStudentRisk === "function") {
        await Promise.all(
          students.map((student) =>
            calculateStudentRisk(student._id, session.batch),
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

    let resolvedMeetingType =
      meetingType ||
      (dayName === "Sunday" ? "Sunday Weekly Meeting" : "Daily Meeting");

    if (resolvedMeetingType === "Sunday Meeting") {
      resolvedMeetingType = "Sunday Weekly Meeting";
    }

    if (resolvedMeetingType === "Daily Standup") {
      resolvedMeetingType = "Daily Meeting";
    }

    if (!VALID_MEETING_TYPES.includes(resolvedMeetingType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid meeting type",
      });
    }

    if (
      dayName === "Sunday" &&
      resolvedMeetingType !== "Sunday Weekly Meeting"
    ) {
      return res.status(400).json({
        success: false,
        message: "Sunday must use Sunday Weekly Meeting",
      });
    }

    if (dayName !== "Sunday" && resolvedMeetingType !== "Daily Meeting") {
      return res.status(400).json({
        success: false,
        message: "Monday-Saturday must use Daily Meeting",
      });
    }

    const teamMeetingSession = await getOrCreateTeamMeetingSession({
      team,

      mentorId,

      week: numericWeek,

      dayName,

      meetingType: resolvedMeetingType,
    });

    const savedRecords = [];

    for (const item of attendanceList) {
      const studentId = String(item.studentId);

      const student = studentMap.get(studentId);

      if (!student) {
        return res.status(404).json({
          success: false,
          message: `Student not found: ${studentId}`,
        });
      }

      if (!teamStudentIds.has(studentId)) {
        return res.status(403).json({
          success: false,
          message: `${student.firstName} ${student.lastName} is not assigned to your team`,
        });
      }

      if (student.gender !== req.user.gender) {
        return res.status(403).json({
          success: false,
          message: `You cannot mark attendance for ${student.firstName} ${student.lastName}`,
        });
      }

      if (String(student.batch) !== String(team.batch)) {
        return res.status(403).json({
          success: false,
          message: `Student ${student.firstName} does not belong to your team's batch`,
        });
      }

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

      let record = await Attendance.findOne({
        studentId: student._id,

        teamId: team._id,

        sessionId: teamMeetingSession._id,
      });

      if (record) {
        record.studentId = student._id;

        record.batchId = team.batch;

        record.teamId = team._id;

        record.sessionId = teamMeetingSession._id;

        record.week = numericWeek;

        record.sessionType = "Team Meeting";

        record.sessionName = `${resolvedMeetingType} - ${dayName}`;

        record.date = teamMeetingSession.date || now;

        record.gender = student.gender;

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
      } else {
        record = await Attendance.create({
          studentId: student._id,

          batchId: team.batch,

          teamId: team._id,

          sessionId: teamMeetingSession._id,

          week: numericWeek,

          sessionType: "Team Meeting",

          sessionName: `${resolvedMeetingType} - ${dayName}`,

          date: teamMeetingSession.date || now,

          gender: student.gender,

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

    if (calculateStudentRisk && typeof calculateStudentRisk === "function") {
      await Promise.all(
        students.map((student) =>
          calculateStudentRisk(student._id, team.batch),
        ),
      );
    }

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
    console.error("MARK BULK ATTENDANCE ERROR:", error);

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

const markAttendance = async (req, res) => {
  try {
    const { studentId, sessionId, week, dayName, checkType, status } = req.body;

    const mentorId = req.user?._id;

    if (!mentorId) {
      return res.status(401).json({
        success: false,
        message: "Mentor authentication required",
      });
    }

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

    const team = await findMentorTeam(mentorId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "You are not assigned to a team",
      });
    }

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

    const belongsToTeam = (team.students || []).some(
      (id) => String(id) === String(student._id),
    );

    if (!belongsToTeam) {
      return res.status(403).json({
        success: false,
        message: "This student is not assigned to your team",
      });
    }

    if (req.user?.gender && student.gender !== req.user.gender) {
      return res.status(403).json({
        success: false,
        message: "You cannot mark attendance for this student",
      });
    }

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
    }

    let teamMeetingSession = null;

    let targetWeek = Number(week) || session?.week || 1;

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
        message: "Invalid meeting day",
      });
    }

    if (!Number.isInteger(targetWeek) || targetWeek < 1) {
      return res.status(400).json({
        success: false,
        message: "week must be a positive integer",
      });
    }

    let targetMeetingType =
      session?.type ||
      (targetDayName === "Sunday" ? "Sunday Weekly Meeting" : "Daily Meeting");

    if (targetMeetingType === "Sunday Meeting") {
      targetMeetingType = "Sunday Weekly Meeting";
    }

    if (targetMeetingType === "Daily Standup") {
      targetMeetingType = "Daily Meeting";
    }

    if (!session) {
      teamMeetingSession = await getOrCreateTeamMeetingSession({
        team,

        mentorId,

        week: targetWeek,

        dayName: targetDayName,

        meetingType: targetMeetingType,
      });

      session = teamMeetingSession;
    }

    const batchId = session?.batch || team.batch;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: "Unable to determine batch",
      });
    }

    const checkField = checkType === "first" ? "firstCheck" : "secondCheck";

    const existingRecord = await Attendance.findOne({
      studentId: student._id,

      teamId: team._id,

      sessionId: session._id,
    });

    const checkData = {
      status,

      markedBy: mentorId,

      timestamp: new Date(),
    };

    let record;

    if (existingRecord) {
      record = existingRecord;

      record.studentId = student._id;

      record.batchId = batchId;

      record.teamId = team._id;

      record.sessionId = session._id;

      record.week = targetWeek;

      record.sessionType = teamMeetingSession ? "Team Meeting" : session.type;

      record.sessionName = teamMeetingSession
        ? `${targetMeetingType} - ${targetDayName}`
        : session.name;

      record.date = session.date || new Date();

      record.gender = student.gender;

      record[checkField] = checkData;

      await record.save();
    } else {
      record = await Attendance.create({
        studentId: student._id,

        batchId,

        teamId: team._id,

        sessionId: session._id,

        week: targetWeek,

        sessionType: teamMeetingSession ? "Team Meeting" : session.type,

        sessionName: teamMeetingSession
          ? `${targetMeetingType} - ${targetDayName}`
          : session.name,

        date: session.date || new Date(),

        gender: student.gender,

        firstCheck:
          checkType === "first"
            ? checkData
            : {
                status: null,
                markedBy: null,
                timestamp: null,
              },

        secondCheck:
          checkType === "second"
            ? checkData
            : {
                status: null,
                markedBy: null,
                timestamp: null,
              },
      });
    }

    const statistics = calculateChecks([record]);

    let risk = null;

    if (
      calculateStudentRisk &&
      typeof calculateStudentRisk === "function" &&
      batchId
    ) {
      try {
        risk = await calculateStudentRisk(studentId, batchId);
      } catch (riskError) {
        console.error("ATTENDANCE RISK CALCULATION ERROR:", riskError);
      }
    }

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

    const team = await Team.findOne({
      mentors: mentorId,
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "You are not assigned to a team",
      });
    }

    const filter = {
      teamId: team._id,
    };

    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
      filter.sessionId = sessionId;
    }

    if (week) {
      filter.week = Number(week);
    }

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

    const query = {
      studentId,
    };

    if (batchId && mongoose.Types.ObjectId.isValid(batchId)) {
      query.batchId = batchId;
    } else if (req.user?.batch) {
      query.batchId = req.user.batch;
    }

    const records = await Attendance.find(query)
      .populate("batchId", "name status startDate endDate")
      .populate("teamId", "name gender batch")
      .populate("sessionId", "name type batch week date createdBy isActive")
      .sort({
        date: 1,
        week: 1,
        createdAt: 1,
      });

    const generalRecords = records.filter((record) =>
      GENERAL_SESSION_TYPES.includes(record.sessionType),
    );

    const teamRecords = records.filter(
      (record) =>
        TEAM_SESSION_TYPES.includes(record.sessionType) ||
        record.sessionType === "Team Meeting",
    );

    const overallStatistics = calculateChecks(records);

    const generalStatistics = calculateChecks(generalRecords);

    const teamStatistics = calculateChecks(teamRecords);

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
        risk = await calculateStudentRisk(studentId, riskBatchId);
      } catch (error) {}
    }

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
    console.error("GET ADMIN ATTENDANCE STATS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting attendance statistics",
      error: error.message,
    });
  }
};

const getAdminBatchReport = async (req, res) => {
  try {
    const { batchId } = req.params;

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

    const records =
      studentIds.length > 0
        ? await Attendance.find({
            studentId: {
              $in: studentIds,
            },

            batchId,
          }).populate(
            "sessionId",
            "name type batch week date createdBy isActive",
          )
        : [];

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

    const overallStats = calculateChecks(records);

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
    console.error("GET ADMIN BATCH REPORT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting batch report",
      error: error.message,
    });
  }
};

module.exports = {
  markAttendance,
  markBulkAttendance,
  getMentorStudents,
  getTeamRecordsForSession,
  getStudentAttendance,
  getAdminAttendanceStats,
  getAdminBatchReport,
};
