const mongoose = require("mongoose");

const Attendance = require("../models/attendance");
const Session = require("../models/session");
const Team = require("../models/team");
const User = require("../models/user");
const Batch = require("../models/batch");

let calculateStudentRisk = null;

try {
  const riskService = require("../services/atRiskService");
  calculateStudentRisk =
    riskService.calculateStudentRisk || riskService;
} catch (error) {
  calculateStudentRisk = null;
}

const VALID_STATUSES = [
  "Present",
  "Absent",
  "Late",
  "Excused",
];

const VALID_CHECK_TYPES = [
  "first",
  "second",
];

const GENERAL_SESSION_TYPES = [
  "Lecture",
  "Experience Sharing",
  "Contest",
];

const TEAM_SESSION_TYPES = [
  "Daily Standup",
  "Daily Meeting",
  "Sunday Meeting",
  "Sunday Weekly Meeting",
];

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
    const checks = [
      record?.firstCheck,
      record?.secondCheck,
    ];

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
      ? Number(
          ((earnedPoints / applicableChecks) * 100).toFixed(1)
        )
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

const calculateOverallStatus = (
  firstStatus,
  secondStatus
) => {
  const statuses = [
    firstStatus,
    secondStatus,
  ].filter(Boolean);

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

const markBulkAttendance = async (req, res) => {
  try {
    const {
      sessionId,
      week,
      dayName,
      meetingType,
      attendanceList,
    } = req.body;

    const mentorId = req.user?._id;
    const mentorGender = req.user?.gender;

    if (!mentorId) {
      return res.status(401).json({
        success: false,
        message: "Mentor authentication required",
      });
    }

    if (
      !Array.isArray(attendanceList) ||
      attendanceList.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "attendanceList array is required",
      });
    }

    const team = await findMentorTeam(mentorId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "You are not assigned to a team",
      });
    }

    let session = null;

    if (
      sessionId &&
      mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      session = await Session.findById(sessionId);
    }

    const targetWeek =
      Number(week) || session?.week || 1;

    const targetDayName =
      dayName ||
      (session?.date
        ? new Date(session.date).toLocaleDateString(
            "en-US",
            {
              weekday: "long",
            }
          )
        : "Monday");

    const targetMeetingType =
      meetingType ||
      session?.type ||
      (targetDayName === "Sunday"
        ? "Sunday Weekly Meeting"
        : "Daily Meeting");

    const targetSessionName =
      session?.name ||
      `Week ${targetWeek} - ${targetDayName} (${targetMeetingType})`;

    const targetDate =
      session?.date || new Date();

    const batchId =
      session?.batch || team.batch;

    const operations = [];
    const studentIdsToProcess = [];

    for (const item of attendanceList) {
      const studentId = item?.studentId;

      if (
        !studentId ||
        !mongoose.Types.ObjectId.isValid(studentId)
      ) {
        continue;
      }

      const firstStatus =
        VALID_STATUSES.includes(item?.firstCheck)
          ? item.firstCheck
          : null;

      const secondStatus =
        VALID_STATUSES.includes(item?.secondCheck)
          ? item.secondCheck
          : null;

      if (!firstStatus && !secondStatus) {
        continue;
      }

      const filter = session
        ? {
            studentId,
            sessionId: session._id,
          }
        : {
            studentId,
            week: targetWeek,
            dayName: targetDayName,
            batchId,
          };

      const existingRecord =
        await Attendance.findOne(filter);

      const finalFirstStatus =
        firstStatus ||
        existingRecord?.firstCheck?.status ||
        null;

      const finalSecondStatus =
        secondStatus ||
        existingRecord?.secondCheck?.status ||
        null;

      const updateData = {
        studentId,
        mentorId,
        teamId: team._id,
        batchId,
        week: targetWeek,
        dayName: targetDayName,
        meetingType: targetMeetingType,
        sessionType: targetMeetingType,
        sessionName: targetSessionName,
        date: targetDate,
        gender: mentorGender || "Female",
        status: calculateOverallStatus(
          finalFirstStatus,
          finalSecondStatus
        ),
      };

      if (firstStatus) {
        updateData.firstCheck = {
          status: firstStatus,
          markedBy: mentorId,
          markedAt: new Date(),
          timestamp: new Date(),
        };
      }

      if (secondStatus) {
        updateData.secondCheck = {
          status: secondStatus,
          markedBy: mentorId,
          markedAt: new Date(),
          timestamp: new Date(),
        };
      }

      if (session) {
        updateData.sessionId = session._id;
      }

      operations.push({
        updateOne: {
          filter,
          update: {
            $set: updateData,
          },
          upsert: true,
        },
      });

      studentIdsToProcess.push(studentId);
    }

    if (operations.length > 0) {
      await Attendance.bulkWrite(operations);
    }

    if (
      calculateStudentRisk &&
      typeof calculateStudentRisk === "function" &&
      batchId
    ) {
      for (const studentId of studentIdsToProcess) {
        try {
          await calculateStudentRisk(
            studentId,
            batchId
          );
        } catch (error) {}
      }
    }

    return res.status(200).json({
      success: true,
      message: `Attendance for ${operations.length} students submitted successfully!`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        "Server error while saving bulk attendance",
      error: error.message,
    });
  }
};

const markAttendance = async (req, res) => {
  try {
    const {
      studentId,
      sessionId,
      week,
      dayName,
      checkType,
      status,
    } = req.body;

    const mentorId = req.user?._id;

    if (!mentorId) {
      return res.status(401).json({
        success: false,
        message: "Mentor authentication required",
      });
    }

    if (
      !studentId ||
      !checkType ||
      !status
    ) {
      return res.status(400).json({
        success: false,
        message:
          "studentId, checkType and status are required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(studentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    if (
      !VALID_CHECK_TYPES.includes(checkType) ||
      !VALID_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid checkType or status",
      });
    }

    const team =
      await findMentorTeam(mentorId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message:
          "You are not assigned to a team",
      });
    }

    let session = null;

    if (
      sessionId &&
      mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      session =
        await Session.findById(sessionId);
    }

    const targetWeek =
      Number(week) ||
      session?.week ||
      1;

    const targetDayName =
      dayName ||
      (session?.date
        ? new Date(
            session.date
          ).toLocaleDateString(
            "en-US",
            {
              weekday: "long",
            }
          )
        : "Monday");

    const targetMeetingType =
      session?.type ||
      (targetDayName === "Sunday"
        ? "Sunday Weekly Meeting"
        : "Daily Meeting");

    const targetSessionName =
      session?.name ||
      `${targetDayName} (${targetMeetingType})`;

    const targetDate =
      session?.date ||
      new Date();

    const batchId =
      session?.batch ||
      team.batch;

    const checkField =
      checkType === "first"
        ? "firstCheck"
        : "secondCheck";

    const filter = session
      ? {
          studentId,
          sessionId: session._id,
        }
      : {
          studentId,
          week: targetWeek,
          dayName: targetDayName,
          batchId,
        };

    const existingRecord =
      await Attendance.findOne(filter);

    const firstStatus =
      checkType === "first"
        ? status
        : existingRecord?.firstCheck?.status ||
          null;

    const secondStatus =
      checkType === "second"
        ? status
        : existingRecord?.secondCheck?.status ||
          null;

    const update = {
      studentId,
      mentorId,
      batchId,
      teamId: team._id,
      week: targetWeek,
      dayName: targetDayName,
      meetingType: targetMeetingType,
      sessionType: targetMeetingType,
      sessionName: targetSessionName,
      date: targetDate,
      gender:
        req.user?.gender || "Female",
      status: calculateOverallStatus(
        firstStatus,
        secondStatus
      ),
      [checkField]: {
        status,
        markedBy: mentorId,
        markedAt: new Date(),
        timestamp: new Date(),
      },
    };

    if (session) {
      update.sessionId =
        session._id;
    }

    const record =
      await Attendance.findOneAndUpdate(
        filter,
        {
          $set: update,
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

    const statistics =
      calculateChecks([record]);

    let risk = null;

    if (
      calculateStudentRisk &&
      typeof calculateStudentRisk ===
        "function" &&
      batchId
    ) {
      try {
        risk =
          await calculateStudentRisk(
            studentId,
            batchId
          );
      } catch (error) {}
    }

    return res.status(200).json({
      success: true,
      message:
        "Attendance saved successfully",
      record,
      session,
      attendance: {
        status,
        weight:
          getAttendanceWeight(status),
        isExcused:
          status === "Excused",
        recordRate:
          statistics.attendanceRate,
        earnedPoints:
          statistics.earnedPoints,
        applicableChecks:
          statistics.applicableChecks,
      },
      risk,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        "Server error while marking attendance",
      error: error.message,
    });
  }
};

const getMentorStudents = async (
  req,
  res
) => {
  try {
    const mentorId =
      req.user?._id;

    const mentorGender =
      req.user?.gender;

    if (!mentorId) {
      return res.status(401).json({
        success: false,
        message:
          "Mentor authentication required",
      });
    }

    const team =
      await Team.findOne({
        mentors: mentorId,
      })
        .populate(
          "batch",
          "name status startDate endDate"
        )
        .populate(
          "students",
          "firstName lastName fullName schoolId gender email batch"
        );

    if (!team) {
      const mentor =
        await User.findById(
          mentorId
        ).populate(
          "assignedStudents",
          "firstName lastName fullName schoolId gender email batch"
        );

      return res.status(200).json({
        success: true,
        teamName:
          "Assigned Students",
        teamId: mentorId,
        batch:
          mentor?.batch || null,
        students:
          mentor?.assignedStudents || [],
      });
    }

    const students = (
      team.students || []
    ).filter(
      (student) =>
        !mentorGender ||
        student.gender === mentorGender
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
    return res.status(500).json({
      success: false,
      message:
        "Server error while getting mentor students",
      error: error.message,
    });
  }
};

const getTeamRecordsForSession = async (
  req,
  res
) => {
  try {
    const {
      sessionId,
      week,
      dayName,
    } = req.query;

    const mentorId =
      req.user?._id;

    if (!mentorId) {
      return res.status(401).json({
        success: false,
        message:
          "Mentor authentication required",
      });
    }

    const team =
      await Team.findOne({
        mentors: mentorId,
      });

    const filter = {};

    if (team) {
      filter.teamId =
        team._id;
    } else {
      return res.status(404).json({
        success: false,
        message:
          "You are not assigned to a team",
      });
    }

    if (
      sessionId &&
      mongoose.Types.ObjectId.isValid(
        sessionId
      )
    ) {
      filter.sessionId =
        sessionId;
    }

    if (week) {
      filter.week =
        Number(week);
    }

    if (dayName) {
      filter.dayName =
        dayName;
    }

    const records =
      await Attendance.find(filter)
        .populate(
          "studentId",
          "firstName lastName fullName schoolId gender email"
        )
        .populate(
          "firstCheck.markedBy",
          "firstName lastName email"
        )
        .populate(
          "secondCheck.markedBy",
          "firstName lastName email"
        )
        .sort({
          date: 1,
          createdAt: 1,
        });

    return res.status(200).json({
      success: true,
      teamId: team._id,
      teamName:
        team.name || "My Team",
      records,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        "Server error while getting team attendance records",
      error: error.message,
    });
  }
};

const getStudentAttendance = async (
  req,
  res
) => {
  try {
    const { batchId } =
      req.query;

    const studentId =
      req.user?._id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message:
          "Student authentication required",
      });
    }

    const query = {
      studentId,
    };

    if (
      batchId &&
      mongoose.Types.ObjectId.isValid(
        batchId
      )
    ) {
      query.batchId =
        batchId;
    } else if (
      req.user?.batch
    ) {
      query.batchId =
        req.user.batch;
    }

    const records =
      await Attendance.find(query)
        .populate(
          "batchId",
          "name status startDate endDate"
        )
        .populate(
          "teamId",
          "name gender batch"
        )
        .sort({
          date: 1,
          week: 1,
          createdAt: 1,
        });

    const generalRecords =
      records.filter((record) =>
        GENERAL_SESSION_TYPES.includes(
          record.sessionType
        )
      );

    const teamRecords =
      records.filter((record) =>
        TEAM_SESSION_TYPES.includes(
          record.sessionType
        )
      );

    const overallStatistics =
      calculateChecks(records);

    const generalStatistics =
      calculateChecks(
        generalRecords
      );

    const teamStatistics =
      calculateChecks(
        teamRecords
      );

    const riskBatchId =
      batchId ||
      req.user?.batch;

    let risk = {
      isAtRisk: false,
    };

    if (
      riskBatchId &&
      calculateStudentRisk &&
      typeof calculateStudentRisk ===
        "function"
    ) {
      try {
        risk =
          await calculateStudentRisk(
            studentId,
            riskBatchId
          );
      } catch (error) {}
    }

    return res.status(200).json({
      success: true,
      records,
      percentage:
        overallStatistics.attendanceRate,
      generalPercentage:
        generalStatistics.attendanceRate,
      teamPercentage:
        teamStatistics.attendanceRate,
      summary: {
        totalSessions:
          records.length,
        totalChecks:
          overallStatistics.applicableChecks,
        attendedChecks:
          overallStatistics.earnedPoints,
        presentChecks:
          overallStatistics.presentChecks,
        absentChecks:
          overallStatistics.absentChecks,
        lateChecks:
          overallStatistics.lateChecks,
        excusedChecks:
          overallStatistics.excusedChecks,
        attendanceRate:
          overallStatistics.attendanceRate,
        generalTrack:
          generalStatistics,
        teamTrack:
          teamStatistics,
      },
      generalStats:
        generalStatistics,
      teamStats:
        teamStatistics,
      overallStats:
        overallStatistics,
      risk,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        "Server error while getting student attendance",
      error: error.message,
    });
  }
};

const getAdminAttendanceStats = async (
  req,
  res
) => {
  try {
    const batches =
      await Batch.find().sort({
        createdAt: -1,
      });

    const allBatches =
      await Promise.all(
        batches.map(async (batch) => {
          const students =
            await User.find({
              batch: batch._id,
              role: "student",
            }).select(
              "_id gender"
            );

          const totalStudents =
            students.length;

          const maleStudents =
            students.filter(
              (student) =>
                student.gender === "Male"
            ).length;

          const femaleStudents =
            students.filter(
              (student) =>
                student.gender === "Female"
            ).length;

          const studentIds =
            students.map(
              (student) =>
                student._id
            );

          const records =
            studentIds.length > 0
              ? await Attendance.find({
                  studentId: {
                    $in: studentIds,
                  },
                  batchId:
                    batch._id,
                })
              : [];

          const statistics =
            calculateChecks(
              records
            );

          return {
            _id: batch._id,
            name: batch.name,
            status: batch.status,
            totalStudents,
            maleStudents,
            femaleStudents,
            totalSessions:
              records.length,
            totalApplicableChecks:
              statistics.applicableChecks,
            totalEarnedPoints:
              statistics.earnedPoints,
            overallAttendanceRate:
              statistics.attendanceRate,
            presentChecks:
              statistics.presentChecks,
            absentChecks:
              statistics.absentChecks,
            lateChecks:
              statistics.lateChecks,
            excusedChecks:
              statistics.excusedChecks,
          };
        })
      );

    return res.status(200).json({
      success: true,
      allBatches,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        "Server error while getting attendance statistics",
      error: error.message,
    });
  }
};

const getAdminBatchReport = async (
  req,
  res
) => {
  try {
    const { batchId } =
      req.params;

    if (
      !batchId ||
      !mongoose.Types.ObjectId.isValid(
        batchId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid batch ID is required",
      });
    }

    const batch =
      await Batch.findById(
        batchId
      );

    if (!batch) {
      return res.status(404).json({
        success: false,
        message:
          "Batch not found",
      });
    }

    const students =
      await User.find({
        batch: batchId,
        role: "student",
      })
        .select(
          "_id firstName lastName fullName schoolId gender email"
        )
        .sort({
          firstName: 1,
          lastName: 1,
        });

    const studentIds =
      students.map(
        (student) =>
          student._id
      );

    const records =
      studentIds.length > 0
        ? await Attendance.find({
            studentId: {
              $in: studentIds,
            },
            batchId,
          })
        : [];

    const studentReports =
      students.map((student) => {
        const studentRecords =
          records.filter(
            (record) =>
              String(
                record.studentId
              ) ===
              String(
                student._id
              )
          );

        const stats =
          calculateChecks(
            studentRecords
          );

        const generalRecords =
          studentRecords.filter(
            (record) =>
              GENERAL_SESSION_TYPES.includes(
                record.sessionType
              )
          );

        const teamRecords =
          studentRecords.filter(
            (record) =>
              TEAM_SESSION_TYPES.includes(
                record.sessionType
              )
          );

        const generalStats =
          calculateChecks(
            generalRecords
          );

        const teamStats =
          calculateChecks(
            teamRecords
          );

        return {
          _id: student._id,
          firstName:
            student.firstName,
          lastName:
            student.lastName,
          fullName:
            student.fullName ||
            `${student.firstName || ""} ${
              student.lastName || ""
            }`.trim(),
          schoolId:
            student.schoolId,
          gender:
            student.gender,
          email:
            student.email,
          percentage:
            stats.attendanceRate,
          generalPercentage:
            generalStats.attendanceRate,
          teamPercentage:
            teamStats.attendanceRate,
          summary: stats,
          generalStats,
          teamStats,
          records:
            studentRecords,
        };
      });

    const overallStats =
      calculateChecks(records);

    return res.status(200).json({
      success: true,
      batch: {
        _id: batch._id,
        name: batch.name,
        status: batch.status,
      },
      summary: {
        totalStudents:
          students.length,
        totalSessions:
          records.length,
        overallAttendanceRate:
          overallStats.attendanceRate,
      },
      students:
        studentReports,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        "Server error while getting batch report",
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
