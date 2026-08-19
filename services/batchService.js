const Batch = require("../models/batch");
const User = require("../models/user");

const createBatch = async (data) => {
  const {
    name,
    status = "upcoming",
    isRegistrationOpen = false,
    startDate,
    endDate,
    description = "",
  } = data;

  if (!name || !name.trim()) {
    throw new Error("Batch name is required");
  }

  const existingBatch = await Batch.findOne({
    name: name.trim(),
  });

  if (existingBatch) {
    throw new Error("A batch with this name already exists");
  }

  if (!["upcoming", "active", "completed"].includes(status)) {
    throw new Error("Invalid batch status");
  }

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

  return Batch.create({
    name: name.trim(),
    status,
    isRegistrationOpen,
    startDate: startDate || null,
    endDate: endDate || null,
    description: description.trim(),
  });
};

const getAllBatches = async () => {
  return Batch.find().sort({ createdAt: -1 });
};

const getBatchById = async (batchId) => {
  const batch = await Batch.findById(batchId);

  if (!batch) {
    throw new Error("Batch not found");
  }

  return batch;
};

const getActiveBatch = async () => {
  return Batch.findOne({
    status: "active",
  }).sort({ createdAt: -1 });
};

const getRegistrationBatch = async () => {
  return Batch.findOne({
    isRegistrationOpen: true,
    status: {
      $in: ["upcoming", "active"],
    },
  }).sort({ startDate: 1, createdAt: 1 });
};

const updateBatch = async (batchId, data) => {
  const batch = await Batch.findById(batchId);

  if (!batch) {
    throw new Error("Batch not found");
  }

  if (data.name !== undefined) {
    if (!data.name.trim()) {
      throw new Error("Batch name is required");
    }

    const existingBatch = await Batch.findOne({
      name: data.name.trim(),
      _id: { $ne: batchId },
    });

    if (existingBatch) {
      throw new Error("A batch with this name already exists");
    }

    batch.name = data.name.trim();
  }

  if (data.description !== undefined) {
    batch.description = data.description.trim();
  }

  if (data.startDate !== undefined) {
    batch.startDate = data.startDate || null;
  }

  if (data.endDate !== undefined) {
    batch.endDate = data.endDate || null;
  }

  if (data.isRegistrationOpen !== undefined) {
    batch.isRegistrationOpen = Boolean(data.isRegistrationOpen);
  }

  if (data.status !== undefined) {
    if (!["upcoming", "active", "completed"].includes(data.status)) {
      throw new Error("Invalid batch status");
    }

    if (data.status === "active") {
      await Batch.updateMany(
        {
          _id: { $ne: batchId },
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

    batch.status = data.status;

    if (data.status === "completed") {
      batch.isRegistrationOpen = false;
    }
  }

  return batch.save();
};

const openRegistration = async (batchId) => {
  const batch = await Batch.findById(batchId);

  if (!batch) {
    throw new Error("Batch not found");
  }

  if (batch.status === "completed") {
    throw new Error("Registration cannot be opened for a completed batch");
  }

  await Batch.updateMany(
    { _id: { $ne: batchId } },
    {
      $set: {
        isRegistrationOpen: false,
      },
    },
  );

  batch.isRegistrationOpen = true;

  return batch.save();
};

const closeRegistration = async (batchId) => {
  const batch = await Batch.findById(batchId);

  if (!batch) {
    throw new Error("Batch not found");
  }

  batch.isRegistrationOpen = false;

  return batch.save();
};

const activateBatch = async (batchId) => {
  const batch = await Batch.findById(batchId);

  if (!batch) {
    throw new Error("Batch not found");
  }

  await Batch.updateMany(
    { _id: { $ne: batchId } },
    {
      $set: {
        status: "completed",
        isRegistrationOpen: false,
      },
    },
  );

  batch.status = "active";

  return batch.save();
};

const completeBatch = async (batchId) => {
  const batch = await Batch.findById(batchId);

  if (!batch) {
    throw new Error("Batch not found");
  }

  batch.status = "completed";
  batch.isRegistrationOpen = false;

  return batch.save();
};

const getBatchUsers = async (batchId) => {
  const batch = await Batch.findById(batchId);

  if (!batch) {
    throw new Error("Batch not found");
  }

  const users = await User.find({
    $or: [
      { batch: batchId },
      {
        "batchHistory.batch": batchId,
      },
    ],
  }).select(
    "firstName lastName email gender role phone schoolId batch batchHistory status",
  );

  return users;
};

module.exports = {
  createBatch,
  getAllBatches,
  getBatchById,
  getActiveBatch,
  getRegistrationBatch,
  updateBatch,
  openRegistration,
  closeRegistration,
  activateBatch,
  completeBatch,
  getBatchUsers,
};
