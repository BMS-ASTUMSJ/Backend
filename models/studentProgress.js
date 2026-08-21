const ProgressContent = require("../models/progressContent");
const StudentProgress = require("../models/studentProgress");
const User = require("../models/user");
const Batch = require("../models/batch");

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

const isCompleted = (progress) => {
  if (!progress) return false;

  return Boolean(
    progress.status === "done" ||
      progress.completedAt ||
      progress.watched ||
      progress.submissionLink,
  );
};

const createProgressContent = async (data) => {
  const { batch, batchId, type, topic, week, title, link, publishedBy } = data;

  if (!["cp", "dev"].includes(type)) {
    throw new Error("Type must be cp or dev");
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
    topic: topic || "JavaScript",
    week: weekNumber,
    title: title.trim(),
    link: link.trim(),
    publishedBy,
    isPublished: true,
  });
};

const getProgressContent = async (type, week, batchId, topic) => {
  const filter = { isPublished: true };

  if (batchId) filter.batch = batchId;
  if (type && type !== "all") filter.type = type;
  if (topic && topic !== "all") filter.topic = topic;
  if (week && week !== "all") filter.week = Number(week);

  return ProgressContent.find(filter)
    .populate("batch", "name status")
    .populate("publishedBy", "firstName lastName email")
    .sort({ type: 1, week: 1, createdAt: 1 });
};

const getContentById = async (contentId) => {
  const content = await ProgressContent.findById(contentId)
    .populate("batch", "name status")
    .populate("publishedBy", "firstName lastName email");

  if (!content) {
    throw new Error("Progress content not found");
  }

  return content;
};

const getStudentProgress = async (studentId, type, week, batchId, topic) => {
  const selectedBatch = await getSelectedStudentBatch(studentId, batchId);

  const contentFilter = {
    batch: selectedBatch,
    isPublished: true,
  };

  if (type && type !== "all") contentFilter.type = type;
  if (topic && topic !== "all") contentFilter.topic = topic;
  if (week && week !== "all") contentFilter.week = Number(week);

  const contents = await ProgressContent.find(contentFilter).sort({
    type: 1,
    week: 1,
    createdAt: 1,
  });

  const records = await StudentProgress.find({
    student: studentId,
    batch: selectedBatch,
    content: { $in: contents.map((item) => item._id) },
  }).populate("updatedBy", "firstName lastName");

  const recordMap = new Map(
    records.map((record) => [record.content.toString(), record]),
  );

  return contents.map((content) => ({
    content,
    progress: recordMap.get(content._id.toString()) || null,
  }));
};

const updateStudentProgress = async (studentId, contentId, data) => {
  const content = await ProgressContent.findOne({
    _id: contentId,
    isPublished: true,
  });

  if (!content) {
    throw new Error("Progress content not found");
  }

  const selectedBatch = await getSelectedStudentBatch(
    studentId,
    content.batch.toString(),
  );

  const allowedStatuses = [
    "not_started",
    "in_progress",
    "needs_help",
    "done",
  ];

  if (data.status && !allowedStatuses.includes(data.status)) {
    throw new Error("Invalid progress status");
  }

  const progressData = {
    student: studentId,
    batch: selectedBatch,
    content: contentId,
    type: content.type,
    topic: content.topic || "JavaScript",
    updatedBy: studentId,
  };

  if (data.status !== undefined) {
    progressData.status = data.status;
  }

  if (content.type === "cp") {
    if (data.submissionLink !== undefined) {
      progressData.submissionLink = String(data.submissionLink).trim();
    }

    if (data.attempts !== undefined) {
      progressData.attempts = Math.max(0, Number(data.attempts) || 0);
    }

    if (data.timeSpent !== undefined) {
      progressData.timeSpent = Math.max(0, Number(data.timeSpent) || 0);
    }

    if (data.submissionLink || data.status === "done") {
      progressData.status = "done";
      progressData.completedAt = new Date();
    }
  }

  if (content.type === "dev") {
    if (data.watched !== undefined) {
      progressData.watched = Boolean(data.watched);
    }

    if (data.watched === true || data.status === "done") {
      progressData.status = "done";
      progressData.completedAt = new Date();
    }

    if (data.status === "needs_help") {
      progressData.completedAt = null;
    }
  }

  return StudentProgress.findOneAndUpdate(
    {
      student: studentId,
      batch: selectedBatch,
      content: contentId,
    },
    { $set: progressData },
    {
      new: true,
      upsert: true,
      runValidators: true,
    },
  )
    .populate("content", "type topic week title link")
    .populate("student", "firstName lastName email gender");
};

const getStudentSummary = async (
  studentId,
  type,
  week,
  batchId,
  topic,
) => {
  const progressList = await getStudentProgress(
    studentId,
    type,
    week,
    batchId,
    topic,
  );

  const completed = progressList.filter((item) =>
    isCompleted(item.progress),
  ).length;

  const needsHelp = progressList.filter(
    (item) => item.progress?.status === "needs_help",
  ).length;

  const total = progressList.length;

  return {
    total,
    completed,
    needsHelp,
    completion: total ? Math.round((completed / total) * 100) : 0,
  };
};

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
    if (b.completed !== a.completed) return b.completed - a.completed;
    return b.completion - a.completion;
  });

  return {
    rank:
      rankings.findIndex(
        (item) => item.studentId === studentId.toString(),
      ) + 1,
    totalStudents: rankings.length,
  };
};

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
    cp: { ...cp, ...cpRank },
    dev: { ...dev, ...devRank },
    overall,
  };
};

const getMentorProgress = async (mentorId, type, week, batchId, topic) => {
  const mentor = await User.findOne({
    _id: mentorId,
    role: "mentor",
  }).select("batch assignedStudents");

  if (!mentor) {
    throw new Error("Mentor not found");
  }

  const selectedBatch = batchId || mentor.batch;

  if (!selectedBatch) {
    return [];
  }

  const students = await User.find({
    _id: { $in: mentor.assignedStudents || [] },
    role: "student",
    batch: selectedBatch,
  }).select("firstName lastName email gender");

  const result = await Promise.all(
    students.map(async (student) => {
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
        type || "all",
        week,
        selectedBatch,
        topic,
      );

      const items = await getStudentProgress(
        student._id,
        type || "all",
        week,
        selectedBatch,
        topic,
      );

      return {
        student: {
          id: student._id,
          name: `${student.firstName} ${student.lastName}`,
          email: student.email,
          gender: student.gender,
        },
        cp,
        dev,
        overall,
        items,
      };
    }),
  );

  return result.sort(
    (a, b) => b.overall.completion - a.overall.completion,
  );
};

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
      student.overall.completion < minimum ||
      student.cp.needsHelp > 0 ||
      student.dev.needsHelp > 0,
  );
};

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

const unpublishProgressContent = async (contentId) => {
  const content = await ProgressContent.findByIdAndUpdate(
    contentId,
    { isPublished: false },
    { new: true },
  );

  if (!content) {
    throw new Error("Progress content not found");
  }

  return content;
};

module.exports = {
  createProgressContent,
  getProgressContent,
  getContentById,
  getStudentProgress,
  updateStudentProgress,
  getStudentSummary,
  getStudentRank,
  getProgressDashboard,
  getMentorProgress,
  getFallingBehindStudents,
  getOverallProgress,
  unpublishProgressContent,
};