const mongoose = require("mongoose");

const Attendance = require("../models/attendance");
const Session = require("../models/session");
const Team = require("../models/team");
const User = require("../models/user");
const Batch = require("../models/batch");

// ============================================================
// CONSTANTS
// ============================================================

const VALID_STATUSES = ["Present", "Absent", "Late", "Excused"];

const VALID_CHECK_TYPES = ["first", "second"];

// ============================================================
// ATTENDANCE WEIGHTS
// ============================================================
//
// Present = 1.0
// Late    = 0.5
// Absent  = 0.0
// Excused = excluded
//
// Excused returns null because it must NOT be included
// in the attendance denominator.
// ============================================================

const getAttendanceWeight = (status) => {
  switch (status) {
    case "Present":
      return 1.0;

    case "Late":
      return 0.5;

    case "Absent":
      return 0.0;

    case "Excused":
      return null;

    default:
      return null;
  }
};

// ============================================================
// CALCULATE ATTENDANCE FROM CHECKS
// ============================================================

const calculateChecks = (records = []) => {
  let earnedPoints = 0;
  let applicableChecks = 0;

  let presentChecks = 0;
  let absentChecks = 0;
  let lateChecks = 0;
  let excusedChecks = 0;

  records.forEach((record) => {
    const checks = [record.firstCheck, record.secondCheck];

    checks.forEach((check) => {
      if (!check || !check.status) {
        return;
      }

      const status = check.status;
      const weight = getAttendanceWeight(status);

      // --------------------------------------------------------
      // STATUS COUNTERS
      // --------------------------------------------------------

      if (status === "Present") {
        presentChecks++;
      } else if (status === "Absent") {
        absentChecks++;
      } else if (status === "Late") {
        lateChecks++;
      } else if (status === "Excused") {
        excusedChecks++;
      }

      // --------------------------------------------------------
      // EXCUSED IS NOT PART OF CALCULATION
      // --------------------------------------------------------

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

// ============================================================
// FIND MENTOR TEAM
// ============================================================

const findMentorTeam = async (mentorId) => {
  return Team.findOne({
    mentors: mentorId,
  });
};

// ============================================================
// MARK ATTENDANCE
// ============================================================
//
// Body: { studentId, sessionId, checkType, status }
//
// The session (week / lecture number / contest / experience
// sharing / date) is looked up from the Session collection —
// it is configured by an Admin ahead of time (see
// sessionController.js) and is NOT hardcoded here. Mentors only
// choose which existing session to mark and which student/check/
// status to record.
// ============================================================

const markAttendance = async (req, res) => {
  try {
    const { studentId, sessionId, checkType, status } = req.body;

    const mentorId = req.user?._id;

    // ========================================================
    // AUTHENTICATION
    // ========================================================

    if (!mentorId) {
      return res.status(401).json({
        success: false,
        message: "Mentor authentication required",
      });
    }

    // ========================================================
    // REQUIRED FIELDS
    // ========================================================

    if (!studentId || !sessionId || !checkType || !status) {
      return res.status(400).json({
        success: false,
        message: "studentId, sessionId, checkType and status are required",
      });
    }

    // ========================================================
    // IDS
    // ========================================================

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid session ID",
      });
    }

    // ========================================================
    // CHECK TYPE
    // ========================================================

    if (!VALID_CHECK_TYPES.includes(checkType)) {
      return res.status(400).json({
        success: false,
        message: "checkType must be 'first' or 'second'",
      });
    }

    // ========================================================
    // STATUS
    // ========================================================

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status",
      });
    }

    // ========================================================
    // SESSION
    // ========================================================

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    if (!session.isActive) {
      return res.status(400).json({
        success: false,
        message: "This session is no longer active",
      });
    }

    // ========================================================
    // FIND STUDENT
    // ========================================================

    const student = await User.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (student.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Attendance can only be marked for students",
      });
    }

    if (!student.batch) {
      return res.status(400).json({
        success: false,
        message: "Student is not assigned to a batch",
      });
    }

    if (String(student.batch) !== String(session.batch)) {
      return res.status(403).json({
        success: false,
        message: "Student does not belong to this session's batch",
      });
    }

    // ========================================================
    // MENTOR GENDER
    // ========================================================

    if (!req.user.gender) {
      return res.status(403).json({
        success: false,
        message: "Mentor gender information is required",
      });
    }

    // ========================================================
    // STUDENT GENDER
    // ========================================================

    if (!student.gender) {
      return res.status(403).json({
        success: false,
        message: "Student gender information is required",
      });
    }

    if (student.gender !== req.user.gender) {
      return res.status(403).json({
        success: false,
        message:
          "You can only mark attendance for students in your own gender group",
      });
    }

    // ========================================================
    // FIND MENTOR TEAM
    // ========================================================

    const team = await findMentorTeam(mentorId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "You are not assigned to a team",
      });
    }

    // ========================================================
    // VERIFY STUDENT BELONGS TO TEAM
    // ========================================================

    const studentBelongsToTeam = (team.students || []).some(
      (id) => String(id) === String(studentId),
    );

    if (!studentBelongsToTeam) {
      return res.status(403).json({
        success: false,
        message: "Student is not assigned to your team",
      });
    }

    // ========================================================
    // VERIFY TEAM GENDER
    // ========================================================

    if (team.gender !== student.gender) {
      return res.status(403).json({
        success: false,
        message: "Student does not belong to your team's gender",
      });
    }

    // ========================================================
    // VERIFY TEAM BATCH MATCHES SESSION BATCH
    // ========================================================

    if (!team.batch) {
      return res.status(400).json({
        success: false,
        message: "Your team does not have a batch assigned",
      });
    }

    if (String(team.batch) !== String(session.batch)) {
      return res.status(403).json({
        success: false,
        message: "This session does not belong to your team's batch",
      });
    }

    // ========================================================
    // BUILD UPDATE (denormalize session info onto the record)
    // ========================================================

    const checkField = checkType === "first" ? "firstCheck" : "secondCheck";

    const weight = getAttendanceWeight(status);

    const update = {
      studentId,
      batchId: session.batch,
      teamId: team._id,
      sessionId: session._id,
      week: session.week,
      sessionType: session.type,
      sessionName: session.name,
      date: session.date,
      gender: student.gender,

      [checkField]: {
        status,
        markedBy: mentorId,
        timestamp: new Date(),
      },
    };

    const record = await Attendance.findOneAndUpdate(
      {
        studentId,
        teamId: team._id,
        sessionId: session._id,
      },
      {
        $set: update,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    // ========================================================
    // RETURN CALCULATION FOR THIS RECORD
    // ========================================================

    const recordStatistics = calculateChecks([record]);

    return res.status(200).json({
      success: true,
      message: "Attendance saved successfully",

      record,

      session,

      attendance: {
        status,
        weight,
        isExcused: status === "Excused",

        recordRate: recordStatistics.attendanceRate,

        earnedPoints: recordStatistics.earnedPoints,

        applicableChecks: recordStatistics.applicableChecks,
      },
    });
  } catch (error) {
    console.error("=================================");
    console.error("MARK ATTENDANCE ERROR");
    console.error(error);
    console.error("MESSAGE:", error.message);
    console.error("CODE:", error.code);
    console.error("=================================");

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Attendance for this student/session was already recorded",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while marking attendance",
      error: error.message,
      code: error.code || null,
    });
  }
};

// ============================================================
// GET MENTOR STUDENTS
// ============================================================

const getMentorStudents = async (req, res) => {
  try {
    const mentorId = req.user._id;
    const mentorGender = req.user.gender;

    if (!mentorGender) {
      return res.status(403).json({
        success: false,
        message: "Mentor gender information is required",
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
      return res.status(200).json({
        success: true,
        teamName: null,
        teamId: null,
        batch: null,
        students: [],
      });
    }

    const students = (team.students || []).filter(
      (student) => student.gender === mentorGender,
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
    console.error("getMentorStudents error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting mentor students",
      error: error.message,
    });
  }
};

// ============================================================
// GET TEAM RECORDS FOR A SESSION
// ============================================================
//
// Replaces the old date/sessionType/sessionName query — a
// sessionId already fully identifies the session (batch, week,
// type, name, date), since sessions now live in their own
// collection instead of being guessed from mentor input.
// ============================================================

const getTeamRecordsForSession = async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "sessionId query param is required",
      });
    }

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

    // ========================================================
    // FIND TEAM
    // ========================================================

    const team = await Team.findOne({
      mentors: req.user._id,
    });

    if (!team) {
      return res.status(200).json({
        success: true,
        records: [],
      });
    }

    if (String(team.batch) !== String(session.batch)) {
      return res.status(403).json({
        success: false,
        message: "This session does not belong to your team's batch",
      });
    }

    // ========================================================
    // GET RECORDS
    // ========================================================

    const records = await Attendance.find({
      teamId: team._id,
      sessionId: session._id,
      gender: req.user.gender,
    })
      .populate(
        "studentId",
        "firstName lastName fullName schoolId gender email",
      )
      .populate("firstCheck.markedBy", "firstName lastName email")
      .populate("secondCheck.markedBy", "firstName lastName email")
      .sort({
        createdAt: 1,
      });

    return res.status(200).json({
      success: true,

      teamId: team._id,

      teamName: team.name,

      batchId: team.batch,

      gender: req.user.gender,

      session,

      records,
    });
  } catch (error) {
    console.error("getTeamRecordsForSession error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting team attendance records",
      error: error.message,
    });
  }
};

// ============================================================
// GET STUDENT ATTENDANCE
// ============================================================

const getStudentAttendance = async (req, res) => {
  try {
    const { batchId } = req.query;

    const query = {
      studentId: req.user._id,
    };

    // ========================================================
    // BATCH ACCESS
    // ========================================================

    if (batchId) {
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid batch ID",
        });
      }

      if (req.user.role !== "admin") {
        const hasBatchHistory = req.user.batchHistory?.some(
          (history) =>
            history.batch && String(history.batch) === String(batchId),
        );

        const isCurrentBatch =
          req.user.batch && String(req.user.batch) === String(batchId);

        if (!hasBatchHistory && !isCurrentBatch) {
          return res.status(403).json({
            success: false,
            message: "You do not have access to this batch's attendance",
          });
        }
      }

      query.batchId = batchId;
    } else if (req.user.batch) {
      query.batchId = req.user.batch;
    }

    // ========================================================
    // GET RECORDS
    // ========================================================

    const records = await Attendance.find(query)
      .sort({
        date: -1,
      })
      .populate("batchId", "name status startDate endDate")
      .populate("teamId", "name gender batch")
      .populate("firstCheck.markedBy", "firstName lastName email")
      .populate("secondCheck.markedBy", "firstName lastName email");

    // ========================================================
    // PROFESSIONAL CALCULATION
    // ========================================================

    const statistics = calculateChecks(records);

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,

      records,

      // ------------------------------------------------------
      // FINAL ATTENDANCE PERCENTAGE
      // ------------------------------------------------------

      percentage: statistics.attendanceRate,

      summary: {
        // Number of attendance session records
        totalSessions: records.length,

        // Only Present, Late and Absent
        // are included here.
        //
        // Excused is excluded.
        totalChecks: statistics.applicableChecks,

        // Weighted attendance points
        //
        // Present = 1
        // Late = 0.5
        // Absent = 0
        earnedPoints: statistics.earnedPoints,

        // Backward-compatible name
        attendedChecks: statistics.earnedPoints,

        presentChecks: statistics.presentChecks,

        absentChecks: statistics.absentChecks,

        lateChecks: statistics.lateChecks,

        excusedChecks: statistics.excusedChecks,

        attendanceRate: statistics.attendanceRate,
      },
    });
  } catch (error) {
    console.error("getStudentAttendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting student attendance",
      error: error.message,
    });
  }
};

// ============================================================
// ADMIN ATTENDANCE STATS
// ============================================================

const getAdminAttendanceStats = async (req, res) => {
  try {
    const batches = await Batch.find().sort({
      createdAt: -1,
    });

    const allBatches = await Promise.all(
      batches.map(async (batch) => {
        // ==================================================
        // STUDENTS
        // ==================================================

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

        // ==================================================
        // RECORDS
        // ==================================================

        const records =
          studentIds.length > 0
            ? await Attendance.find({
                studentId: {
                  $in: studentIds,
                },

                batchId: batch._id,
              }).sort({
                date: 1,
              })
            : [];

        // ==================================================
        // SESSION COUNT
        // ==================================================
        //
        // Each Attendance record already carries a unique
        // sessionId, so counting distinct sessions no longer
        // needs to guess from date + sessionName strings.
        // ==================================================

        const sessionKeys = new Set();

        records.forEach((record) => {
          sessionKeys.add(String(record.sessionId));
        });

        const totalSessions = sessionKeys.size;

        // ==================================================
        // WEIGHTED CALCULATION
        // ==================================================

        let totalEarnedPoints = 0;

        let maleEarnedPoints = 0;
        let femaleEarnedPoints = 0;

        let totalApplicableChecks = 0;

        let maleApplicableChecks = 0;
        let femaleApplicableChecks = 0;

        let presentChecks = 0;
        let absentChecks = 0;
        let lateChecks = 0;
        let excusedChecks = 0;

        records.forEach((record) => {
          const checks = [record.firstCheck, record.secondCheck];

          checks.forEach((check) => {
            if (!check || !check.status) {
              return;
            }

            const status = check.status;

            const weight = getAttendanceWeight(status);

            // ----------------------------------------
            // COUNTERS
            // ----------------------------------------

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

            // ----------------------------------------
            // EXCUSED EXCLUDED
            // ----------------------------------------

            if (weight === null) {
              return;
            }

            totalEarnedPoints += weight;

            totalApplicableChecks++;

            // ----------------------------------------
            // GENDER
            // ----------------------------------------

            if (record.gender === "Male") {
              maleEarnedPoints += weight;

              maleApplicableChecks++;
            }

            if (record.gender === "Female") {
              femaleEarnedPoints += weight;

              femaleApplicableChecks++;
            }
          });
        });

        // ==================================================
        // RATES
        // ==================================================

        const overallAttendanceRate =
          totalApplicableChecks > 0
            ? Number(
                ((totalEarnedPoints / totalApplicableChecks) * 100).toFixed(1),
              )
            : 0;

        const maleAttendanceRate =
          maleApplicableChecks > 0
            ? Number(
                ((maleEarnedPoints / maleApplicableChecks) * 100).toFixed(1),
              )
            : 0;

        const femaleAttendanceRate =
          femaleApplicableChecks > 0
            ? Number(
                ((femaleEarnedPoints / femaleApplicableChecks) * 100).toFixed(
                  1,
                ),
              )
            : 0;

        // ==================================================
        // RETURN
        // ==================================================

        return {
          _id: batch._id,

          name: batch.name,

          status: batch.status,

          totalStudents,

          maleStudents,

          femaleStudents,

          totalSessions,

          totalApplicableChecks,

          totalEarnedPoints: Number(totalEarnedPoints.toFixed(2)),

          overallAttendanceRate,

          maleAttendanceRate,

          femaleAttendanceRate,

          presentChecks,

          absentChecks,

          lateChecks,

          excusedChecks,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      allBatches,
    });
  } catch (error) {
    console.error("getAdminAttendanceStats error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting attendance statistics",
      error: error.message,
    });
  }
};

// ============================================================
// ADMIN BATCH REPORT
// ============================================================

const getAdminBatchReport = async (req, res) => {
  try {
    const { batchId } = req.params;

    // ========================================================
    // VALIDATE BATCH ID
    // ========================================================

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: "Batch ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID",
      });
    }

    // ========================================================
    // FIND BATCH
    // ========================================================

    const batch = await Batch.findById(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    // ========================================================
    // STUDENTS
    // ========================================================

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

    // ========================================================
    // ATTENDANCE RECORDS
    // ========================================================

    const records =
      studentIds.length > 0
        ? await Attendance.find({
            studentId: {
              $in: studentIds,
            },

            batchId,
          }).sort({
            date: -1,
          })
        : [];

    // ========================================================
    // SESSION MAP (grouped by distinct sessionId now)
    // ========================================================

    const sessionMap = new Map();

    records.forEach((record) => {
      const key = String(record.sessionId);

      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          sessionId: key,

          week: record.week,

          date: record.date,

          sessionType: record.sessionType,

          sessionName: record.sessionName,
        });
      }
    });

    const totalSessions = sessionMap.size;

    // ========================================================
    // STUDENT REPORTS
    // ========================================================

    const studentReports = students.map((student) => {
      const studentRecords = records.filter(
        (record) => String(record.studentId) === String(student._id),
      );

      // ----------------------------------------------
      // PROFESSIONAL CALCULATION
      // ----------------------------------------------

      const statistics = calculateChecks(studentRecords);

      // ----------------------------------------------
      // RESPONSE
      // ----------------------------------------------

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

        percentage: statistics.attendanceRate,

        // Weighted points
        earnedPoints: statistics.earnedPoints,

        // Checks included in denominator
        applicableChecks: statistics.applicableChecks,

        presentChecks: statistics.presentChecks,

        absentChecks: statistics.absentChecks,

        lateChecks: statistics.lateChecks,

        excusedChecks: statistics.excusedChecks,

        summary: {
          totalSessions,

          totalChecks: statistics.applicableChecks,

          earnedPoints: statistics.earnedPoints,

          present: statistics.presentChecks,

          absent: statistics.absentChecks,

          late: statistics.lateChecks,

          excused: statistics.excusedChecks,

          attendanceRate: statistics.attendanceRate,
        },

        records: studentRecords,
      };
    });

    // ========================================================
    // OVERALL BATCH STATISTICS
    // ========================================================

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    let totalExcused = 0;

    let totalEarnedPoints = 0;
    let totalApplicableChecks = 0;

    records.forEach((record) => {
      const checks = [record.firstCheck, record.secondCheck];

      checks.forEach((check) => {
        if (!check || !check.status) {
          return;
        }

        const status = check.status;

        const weight = getAttendanceWeight(status);

        if (status === "Present") {
          totalPresent++;
        }

        if (status === "Absent") {
          totalAbsent++;
        }

        if (status === "Late") {
          totalLate++;
        }

        if (status === "Excused") {
          totalExcused++;
        }

        // Excused excluded
        if (weight === null) {
          return;
        }

        totalEarnedPoints += weight;

        totalApplicableChecks++;
      });
    });

    // ========================================================
    // OVERALL RATE
    // ========================================================

    const overallAttendanceRate =
      totalApplicableChecks > 0
        ? Number(((totalEarnedPoints / totalApplicableChecks) * 100).toFixed(1))
        : 0;

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,

      batch: {
        _id: batch._id,

        name: batch.name,

        status: batch.status,
      },

      summary: {
        totalStudents: students.length,

        totalSessions,

        // Excused excluded
        totalApplicableChecks,

        // Weighted points
        totalEarnedPoints: Number(totalEarnedPoints.toFixed(2)),

        totalPresent,

        totalAbsent,

        totalLate,

        totalExcused,

        overallAttendanceRate,
      },

      // List of the distinct sessions the report is built from,
      // useful for the admin UI to show a session/week breakdown.
      sessions: Array.from(sessionMap.values()).sort(
        (a, b) => a.week - b.week || new Date(a.date) - new Date(b.date),
      ),

      students: studentReports,
    });
  } catch (error) {
    console.error("getAdminBatchReport error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting batch attendance report",
      error: error.message,
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  markAttendance,
  getMentorStudents,
  getTeamRecordsForSession,
  getStudentAttendance,
  getAdminAttendanceStats,
  getAdminBatchReport,
};
