const mongoose = require("mongoose");

const ProgressContent = require("../models/progressContent");
const StudentProgress = require("../models/studentProgress");
const User = require("../models/user");
const Batch = require("../models/batch");
const Team = require("../models/team");

// ======================================================
// CONSTANTS
// ======================================================

const TOPICS = [
  "HTML / CSS",
  "JavaScript",
  "React",
  "Node.js",
  "Express.js",
  "MongoDB",
  "Git / GitHub",
];

const STATUSES = ["not_started", "in_progress", "done", "needs_help"];

// ======================================================
// STATUS NORMALIZER
// ======================================================

const normalizeStatus = (status) => {
  if (!status) return null;

  const value = String(status).trim();

  const statusMap = {
    "Not Started": "not_started",
    "not started": "not_started",
    not_started: "not_started",

    "In Progress": "in_progress",
    "in progress": "in_progress",
    in_progress: "in_progress",

    Completed: "done",
    completed: "done",
    Done: "done",
    done: "done",

    "Needs Improvement": "needs_help",
    "needs improvement": "needs_help",
    needs_improvement: "needs_help",

    "Needs Help": "needs_help",
    "needs help": "needs_help",
    needs_help: "needs_help",
  };

  return statusMap[value] || null;
};

const displayStatus = (status) => {
  const normalized = normalizeStatus(status);

  const statusMap = {
    not_started: "Not Started",
    in_progress: "In Progress",
    done: "Completed",
    needs_help: "Needs Improvement",
  };

  return statusMap[normalized] || status || "Not Started";
};

// ======================================================
// OBJECT ID
// ======================================================

const validateObjectId = (id, name) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ${name}`);
  }

  return new mongoose.Types.ObjectId(id);
};

// ======================================================
// COMPLETION
// ======================================================

const isCompleted = (progress) => {
  if (!progress) return false;

  const status = normalizeStatus(progress.status);

  return Boolean(
    status === "done" ||
    progress.completedAt ||
    progress.watched ||
    progress.submissionLink,
  );
};

// ======================================================
// STUDENT BATCH IDS
// ======================================================

const getStudentBatchIds = async (studentId) => {
  const student = await User.findById(studentId).select("batch batchHistory");

  if (!student) {
    throw new Error("Student not found");
  }

  const batchIds = [];

  if (student.batch) {
    batchIds.push(student.batch.toString());
  }

  for (const history of student.batchHistory || []) {
    if (history.batch && !batchIds.includes(history.batch.toString())) {
      batchIds.push(history.batch.toString());
    }
  }

  return batchIds;
};

// ======================================================
// SELECTED STUDENT BATCH
// ======================================================

const getSelectedStudentBatch = async (studentId, batchId) => {
  const batches = await getStudentBatchIds(studentId);

  const selectedBatch = batchId || batches[0];

  if (!selectedBatch) {
    throw new Error("No batch assigned to this student");
  }

  if (!batches.includes(selectedBatch.toString())) {
    throw new Error("You do not have access to this batch");
  }

  return selectedBatch;
};

// ======================================================
// CREATE CONTENT
// ======================================================

const createProgressContent = async (data) => {
  const { batch, batchId, type, topic, week, title, link, publishedBy } = data;

  if (!["cp", "dev"].includes(type)) {
    throw new Error("Type must be cp or dev");
  }

  if (!TOPICS.includes(topic)) {
    throw new Error("Invalid topic");
  }

  if (!title?.trim()) {
    throw new Error("Title is required");
  }

  if (!link?.trim()) {
    throw new Error("Link is required");
  }

  const targetBatch = batch || batchId;

  if (!targetBatch) {
    throw new Error("Batch is required");
  }

  validateObjectId(targetBatch, "batch ID");

  const batchExists = await Batch.findById(targetBatch);

  if (!batchExists) {
    throw new Error("Batch not found");
  }

  const weekNumber = Number(week);

  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    throw new Error("Week must be a valid number");
  }

  return ProgressContent.create({
    batch: targetBatch,
    type,
    topic,
    week: weekNumber,
    title: title.trim(),
    link: link.trim(),
    publishedBy,
    isPublished: true,
  });
};

// ======================================================
// GET CONTENT
// ======================================================

const getProgressContent = async (type, week, batchId, topic) => {
  const filter = {
    isPublished: true,
  };

  if (batchId) {
    filter.batch = batchId;
  }

  if (type && type !== "all") {
    filter.type = type;
  }

  if (topic && topic !== "all") {
    filter.topic = topic;
  }

  if (week && week !== "all") {
    filter.week = Number(week);
  }

  return ProgressContent.find(filter)
    .populate("batch", "name status")
    .populate("publishedBy", "firstName lastName email")
    .sort({
      type: 1,
      week: 1,
      createdAt: 1,
    });
};

// ======================================================
// GET CONTENT BY ID
// ======================================================

const getContentById = async (contentId) => {
  validateObjectId(contentId, "content ID");

  const content = await ProgressContent.findById(contentId)
    .populate("batch", "name status")
    .populate("publishedBy", "firstName lastName email");

  if (!content) {
    throw new Error("Progress content not found");
  }

  return content;
};

// ======================================================
// GET STUDENT PROGRESS
// ======================================================

const getStudentProgress = async (studentId, type, week, batchId, topic) => {
  const selectedBatch = await getSelectedStudentBatch(studentId, batchId);

  const contentFilter = {
    batch: selectedBatch,
    isPublished: true,
  };

  if (type && type !== "all") {
    contentFilter.type = type;
  }

  if (topic && topic !== "all") {
    contentFilter.topic = topic;
  }

  if (week && week !== "all") {
    contentFilter.week = Number(week);
  }

  const contents = await ProgressContent.find(contentFilter).sort({
    type: 1,
    week: 1,
    createdAt: 1,
  });

  if (!contents.length) {
    return [];
  }

  const contentIds = contents.map((item) => item._id);

  const records = await StudentProgress.find({
    student: studentId,
    batch: selectedBatch,
    content: {
      $in: contentIds,
    },
  })
    .populate("updatedBy", "firstName lastName")
    .populate("content", "type topic week title link");

  const recordMap = new Map();

  records.forEach((record) => {
    if (record.content) {
      recordMap.set(record.content._id.toString(), record);
    }
  });

  return contents.map((content) => {
    const existing = recordMap.get(content._id.toString());

    if (!existing) {
      return {
        content,

        progress: {
          status: "not_started",
          displayStatus: "Not Started",
          mentorNote: "",
          note: "",
          completedAt: null,
        },
      };
    }

    const progress = existing.toObject();

    progress.status = normalizeStatus(progress.status) || "not_started";

    progress.displayStatus = displayStatus(progress.status);

    progress.mentorNote = progress.mentorNote || "";

    progress.note = progress.mentorNote;

    return {
      content,
      progress,
    };
  });
};

// ======================================================
// UPDATE STUDENT PROGRESS
// ======================================================

const updateStudentProgress = async (studentId, contentId, data) => {
  validateObjectId(studentId, "student ID");
  validateObjectId(contentId, "content ID");

  const student = await User.findOne({
    _id: studentId,
    role: "student",
  }).select("firstName lastName email gender batch");

  if (!student) {
    throw new Error("Student not found");
  }

  if (!student.batch) {
    throw new Error("You are not assigned to a batch");
  }

  const content = await ProgressContent.findOne({
    _id: contentId,
    isPublished: true,
  });

  if (!content) {
    throw new Error("Progress content not found");
  }

  if (student.batch.toString() !== content.batch.toString()) {
    throw new Error("This content is not assigned to your batch");
  }

  const normalizedStatus = normalizeStatus(data?.status);

  if (!normalizedStatus) {
    throw new Error(
      `Invalid progress status. Allowed statuses: ${STATUSES.join(", ")}`,
    );
  }

  let progress = await StudentProgress.findOne({
    student: student._id,
    batch: content.batch,
    content: content._id,
  });

  if (!progress) {
    progress = new StudentProgress({
      student: student._id,
      batch: content.batch,
      content: content._id,

      type: content.type,
      topic: content.topic,

      status: normalizedStatus,

      updatedBy: student._id,

      completedAt: normalizedStatus === "done" ? new Date() : null,
    });
  } else {
    progress.type = content.type;
    progress.topic = content.topic;
    progress.status = normalizedStatus;
    progress.updatedBy = student._id;

    progress.completedAt =
      normalizedStatus === "done" ? progress.completedAt || new Date() : null;
  }

  if (data?.submissionLink !== undefined) {
    progress.submissionLink = String(data.submissionLink).trim();
  }

  if (data?.attempts !== undefined) {
    const attempts = Number(data.attempts);

    if (Number.isInteger(attempts) && attempts >= 0) {
      progress.attempts = attempts;
    }
  }

  if (data?.timeSpent !== undefined) {
    const timeSpent = Number(data.timeSpent);

    if (Number.isFinite(timeSpent) && timeSpent >= 0) {
      progress.timeSpent = timeSpent;
    }
  }

  if (data?.watched !== undefined) {
    progress.watched = Boolean(data.watched);
  }

  if (data?.mentorNote !== undefined) {
    progress.mentorNote = String(data.mentorNote).trim().slice(0, 1000);
  }

  if (data?.note !== undefined) {
    progress.mentorNote = String(data.note).trim().slice(0, 1000);
  }

  try {
    await progress.save();
  } catch (error) {
    if (error.code === 11000) {
      progress = await StudentProgress.findOne({
        student: student._id,
        batch: content.batch,
        content: content._id,
      });

      if (!progress) {
        throw error;
      }

      progress.status = normalizedStatus;
      progress.updatedBy = student._id;

      progress.completedAt =
        normalizedStatus === "done" ? progress.completedAt || new Date() : null;

      await progress.save();
    } else {
      throw error;
    }
  }

  await progress.populate([
    {
      path: "student",
      select: "firstName lastName email gender",
    },
    {
      path: "content",
      select: "type topic week title link",
    },
    {
      path: "updatedBy",
      select: "firstName lastName",
    },
  ]);

  const result = progress.toObject();

  result.status = normalizeStatus(result.status);

  result.displayStatus = displayStatus(result.status);

  result.note = result.mentorNote || "";

  return result;
};

const updateStudentOwnProgress = updateStudentProgress;

// ======================================================
// STUDENT SUMMARY
// ======================================================

const getStudentSummary = async (studentId, type, week, batchId, topic) => {
  const progressList = await getStudentProgress(
    studentId,
    type,
    week,
    batchId,
    topic,
  );

  let completed = 0;
  let needsHelp = 0;
  let inProgress = 0;

  progressList.forEach((item) => {
    const status = normalizeStatus(item.progress?.status);

    if (status === "done" || isCompleted(item.progress)) {
      completed++;
    }

    if (status === "needs_help") {
      needsHelp++;
    }

    if (status === "in_progress") {
      inProgress++;
    }
  });

  const total = progressList.length;

  const completion = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    needsHelp,
    inProgress,
    completion,
  };
};

// ======================================================
// STUDENT RANK
// ======================================================

const getStudentRank = async (studentId, type, week, batchId, topic) => {
  const selectedBatch = await getSelectedStudentBatch(studentId, batchId);

  const students = await User.find({
    role: "student",
    batch: selectedBatch,
  }).select("_id");

  const rankings = await Promise.all(
    students.map(async (student) => ({
      studentId: student._id.toString(),

      ...(await getStudentSummary(
        student._id,
        type,
        week,
        selectedBatch,
        topic,
      )),
    })),
  );

  rankings.sort((a, b) => {
    if (b.completed !== a.completed) {
      return b.completed - a.completed;
    }

    return b.completion - a.completion;
  });

  const index = rankings.findIndex(
    (item) => item.studentId === studentId.toString(),
  );

  return {
    rank: index === -1 ? null : index + 1,
    totalStudents: rankings.length,
  };
};

// ======================================================
// STUDENT DASHBOARD
// ======================================================

const getProgressDashboard = async (studentId, batchId) => {
  const student = await User.findById(studentId).select(
    "firstName lastName email gender batch",
  );

  if (!student) {
    throw new Error("Student not found");
  }

  const selectedBatch = await getSelectedStudentBatch(studentId, batchId);

  const cp = await getStudentSummary(studentId, "cp", null, selectedBatch);

  const dev = await getStudentSummary(studentId, "dev", null, selectedBatch);

  const overall = await getStudentSummary(
    studentId,
    "all",
    null,
    selectedBatch,
  );

  const cpRank = await getStudentRank(studentId, "cp", null, selectedBatch);

  const devRank = await getStudentRank(studentId, "dev", null, selectedBatch);

  return {
    student: {
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      email: student.email,
      gender: student.gender,
    },

    batch: await Batch.findById(selectedBatch).select("name status"),

    cp: {
      ...cp,
      ...cpRank,
    },

    dev: {
      ...dev,
      ...devRank,
    },

    overall,
  };
};

const getStudentDashboard = getProgressDashboard;

// ======================================================
// MENTOR TEAMS
// ======================================================

const getMentorTeams = async (mentorId, batchId) => {
  const filter = {
    mentors: mentorId,
  };

  if (batchId) {
    filter.batch = batchId;
  }

  return Team.find(filter).select("_id name gender batch mentors students");
};

// ======================================================
// MENTOR STUDENTS
// ======================================================

const getMentorStudents = async (mentorId, batchId) => {
  const teams = await getMentorTeams(mentorId, batchId);

  const studentIds = [];

  for (const team of teams) {
    for (const studentId of team.students || []) {
      const id = studentId.toString();

      if (!studentIds.includes(id)) {
        studentIds.push(id);
      }
    }
  }

  if (!studentIds.length) {
    return [];
  }

  return User.find({
    _id: {
      $in: studentIds,
    },
    role: "student",

    ...(batchId
      ? {
          batch: batchId,
        }
      : {}),
  }).select("firstName lastName email gender batch");
};

// ======================================================
// MENTOR PROGRESS
// ======================================================

const getMentorProgress = async (mentorId, type, week, batchId, topic) => {
  validateObjectId(mentorId, "mentor ID");

  const mentor = await User.findOne({
    _id: mentorId,
    role: "mentor",
  }).select("batch");

  if (!mentor) {
    throw new Error("Mentor not found");
  }

  let selectedBatch = batchId || mentor.batch;

  if (!selectedBatch) {
    const team = await Team.findOne({
      mentors: mentorId,
    }).select("batch");

    if (team?.batch) {
      selectedBatch = team.batch;
    }
  }

  if (!selectedBatch) {
    return [];
  }

  validateObjectId(selectedBatch, "batch ID");

  const students = await getMentorStudents(mentorId, selectedBatch);

  if (!students.length) {
    return [];
  }

  const result = [];

  for (const student of students) {
    const cp = await getStudentSummary(
      student._id,
      "cp",
      week,
      selectedBatch,
      topic,
    );

    const dev = await getStudentSummary(
      student._id,
      "dev",
      week,
      selectedBatch,
      topic,
    );

    const overall = await getStudentSummary(
      student._id,
      "all",
      week,
      selectedBatch,
      topic,
    );

    const items = await getStudentProgress(
      student._id,
      "all",
      week,
      selectedBatch,
      topic,
    );

    // ====================================================
    // CALCULATE ACTUAL STATUS COUNTS
    // ====================================================

    let completed = 0;
    let inProgress = 0;
    let needsHelp = 0;
    let notStarted = 0;

    for (const item of items) {
      const status = normalizeStatus(item.progress?.status);

      if (status === "done" || isCompleted(item.progress)) {
        completed++;
      } else if (status === "in_progress") {
        inProgress++;
      } else if (status === "needs_help") {
        needsHelp++;
      } else {
        notStarted++;
      }
    }

    // ====================================================
    // ACTUAL TOTAL
    // ====================================================

    const total = items.length;

    // ====================================================
    // ACTUAL COMPLETION
    // ====================================================

    const completion = total > 0 ? Math.round((completed / total) * 100) : 0;

    // ====================================================
    // NOTES
    // ====================================================

    const notes = items
      .filter((item) => item.progress?.mentorNote || item.progress?.note)
      .map((item) => ({
        contentId: item.content?._id,

        title: item.content?.title,

        type: item.content?.type,

        topic: item.content?.topic,

        week: item.content?.week,

        note: item.progress?.mentorNote || item.progress?.note || "",

        status: normalizeStatus(item.progress?.status),

        displayStatus: displayStatus(item.progress?.status),

        updatedAt: item.progress?.updatedAt || null,
      }));

    const atRisk = completion < 50 || needsHelp > 0;

    result.push({
      // ==================================================
      // STUDENT
      // ==================================================

      student: {
        id: student._id,
        _id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        gender: student.gender,
        batch: student.batch,
      },

      // ==================================================
      // CP
      // ==================================================

      cp,

      // ==================================================
      // DEV
      // ==================================================

      dev,

      // ==================================================
      // OVERALL
      // ==================================================

      overall,

      // ==================================================
      // IMPORTANT TOP-LEVEL VALUES
      // FRONTEND USES THESE
      // ==================================================

      total,

      completed,

      inProgress,

      needsHelp,

      notStarted,

      completion,

      // ==================================================
      // PROGRESS OBJECT
      // ==================================================

      progress: {
        total,

        completed,

        inProgress,

        needsHelp,

        notStarted,

        completion,
      },

      // ==================================================
      // ITEMS
      // ==================================================

      items,

      // ==================================================
      // NOTES
      // ==================================================

      notes,

      // ==================================================
      // RISK
      // ==================================================

      atRisk,

      riskReason:
        completion < 50
          ? "Progress is below 50%"
          : needsHelp > 0
            ? "Student needs help"
            : null,
    });
  }

  return result.sort((a, b) => b.completion - a.completion);
};

// ======================================================
// FALLING BEHIND
// ======================================================

const getFallingBehindStudents = async (
  mentorId,
  type,
  week,
  batchId,
  topic,
  threshold = 50,
) => {
  const students = await getMentorProgress(
    mentorId,
    type,
    week,
    batchId,
    topic,
  );

  const minimum = Math.max(0, Math.min(100, Number(threshold) || 50));

  return students.filter(
    (student) =>
      student.completion < minimum ||
      student.needsHelp > 0 ||
      student.cp.needsHelp > 0 ||
      student.dev.needsHelp > 0,
  );
};

// ======================================================
// ADMIN OVERALL PROGRESS
// ======================================================

const getOverallProgress = async (type, week, batchId, topic) => {
  if (!batchId) {
    throw new Error("Batch ID is required");
  }

  const students = await User.find({
    role: "student",
    batch: batchId,
  }).select("firstName lastName email gender");

  return Promise.all(
    students.map(async (student) => ({
      student: {
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        gender: student.gender,
      },

      cp: await getStudentSummary(student._id, "cp", week, batchId, topic),

      dev: await getStudentSummary(student._id, "dev", week, batchId, topic),

      overall: await getStudentSummary(
        student._id,
        type || "all",
        week,
        batchId,
        topic,
      ),
    })),
  );
};

// ======================================================
// UNPUBLISH
// ======================================================

const unpublishProgressContent = async (contentId) => {
  validateObjectId(contentId, "content ID");

  const content = await ProgressContent.findByIdAndUpdate(
    contentId,
    {
      isPublished: false,
    },
    {
      new: true,
    },
  );

  if (!content) {
    throw new Error("Progress content not found");
  }

  return content;
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  createProgressContent,
  getProgressContent,
  getContentById,

  getStudentProgress,
  updateStudentProgress,
  updateStudentOwnProgress,

  getStudentSummary,
  getStudentRank,

  getProgressDashboard,
  getStudentDashboard,

  getMentorProgress,
  getFallingBehindStudents,

  getOverallProgress,

  unpublishProgressContent,

  normalizeStatus,
  displayStatus,

  TOPICS,
  STATUSES,
};
