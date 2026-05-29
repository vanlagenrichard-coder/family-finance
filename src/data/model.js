export const STORAGE_KEY = "family_finance_app_data";

export const FIXED_BUCKETS = [
  "Bills",
  "Savings",
  "Giving",
  "Spending",
  "Goals",
];

export const defaultAppData = {
  settings: {
    currency: "CAD",
    familyName: "",
  },

  setupBuckets: FIXED_BUCKETS.map((bucket) => ({
    id: bucket.toLowerCase(),
    name: bucket,
    expanded: true,
    subBuckets: [],
  })),

  transactions: [],

  paychecks: [],

  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 2,
  },
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeObject(value, fallback = {}) {
  return isPlainObject(value) ? value : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function makeId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function normalizeSubBucket(subBucket) {
  const safeSubBucket = safeObject(subBucket);

  return {
    id: safeString(safeSubBucket.id, makeId("sub")),

    name: safeString(safeSubBucket.name),

    percent: safeString(safeSubBucket.percent),

    archived: Boolean(safeSubBucket.archived),

    monthlyTarget: safeString(safeSubBucket.monthlyTarget),

    dueDate: safeString(safeSubBucket.dueDate),

    frequency: safeString(
      safeSubBucket.frequency,
      "Monthly"
    ),

    reserveGoal: safeString(safeSubBucket.reserveGoal),

    targetAmount: safeString(safeSubBucket.targetAmount),

    targetDate: safeString(safeSubBucket.targetDate),
  };
}

function normalizeSetupBucket(bucket, fallbackName = "") {
  const safeBucket = safeObject(bucket);

  return {
    id: safeString(
      safeBucket.id,
      fallbackName.toLowerCase()
    ),

    name: safeString(
      safeBucket.name,
      fallbackName
    ),

    expanded:
      typeof safeBucket.expanded === "boolean"
        ? safeBucket.expanded
        : true,

    subBuckets: safeArray(
      safeBucket.subBuckets
    ).map(normalizeSubBucket),
  };
}

function sanitizeSetupBuckets(data) {
  const existing = safeArray(data?.setupBuckets);

  return FIXED_BUCKETS.map((bucketName) => {
    const existingBucket = existing.find(
      (bucket) =>
        bucket?.name === bucketName ||
        bucket?.id === bucketName.toLowerCase()
    );

    return normalizeSetupBucket(
      existingBucket,
      bucketName
    );
  });
}

function sanitizeTransaction(transaction) {
  const safeTransaction = safeObject(transaction);

  return {
    id: safeString(
      safeTransaction.id,
      makeId("txn")
    ),

    type: safeString(
      safeTransaction.type,
      "Expense"
    ),

    amount: safeNumber(
      safeTransaction.amount
    ),

    bucket: safeString(
      safeTransaction.bucket
    ),

    subBucket: safeString(
      safeTransaction.subBucket
    ),

    fromBucket: safeString(
      safeTransaction.fromBucket
    ),

    fromSubBucket: safeString(
      safeTransaction.fromSubBucket
    ),

    toBucket: safeString(
      safeTransaction.toBucket
    ),

    toSubBucket: safeString(
      safeTransaction.toSubBucket
    ),

    date: safeString(
      safeTransaction.date,
      new Date().toISOString().slice(0, 10)
    ),

    note: safeString(
      safeTransaction.note
    ),

    createdAt: safeString(
      safeTransaction.createdAt,
      new Date().toISOString()
    ),

    updatedAt: safeString(
      safeTransaction.updatedAt,
      new Date().toISOString()
    ),
  };
}

function sanitizeTransactions(transactions) {
  return safeArray(transactions).map(
    sanitizeTransaction
  );
}

function sanitizePaychecks(paychecks) {
  return safeArray(paychecks).map((paycheck) => {
    const safePaycheck = safeObject(paycheck);

    return {
      id: safeString(
        safePaycheck.id,
        makeId("paycheck")
      ),

      amount: safeNumber(
        safePaycheck.amount
      ),

      date: safeString(
        safePaycheck.date,
        new Date().toISOString().slice(0, 10)
      ),

      note: safeString(
        safePaycheck.note
      ),
    };
  });
}

function sanitizeSettings(settings) {
  const safeSettings = safeObject(settings);

  return {
    currency: safeString(
      safeSettings.currency,
      "CAD"
    ),

    familyName: safeString(
      safeSettings.familyName
    ),
  };
}

function sanitizeMetadata(metadata) {
  const safeMetadata = safeObject(metadata);

  return {
    createdAt: safeString(
      safeMetadata.createdAt,
      new Date().toISOString()
    ),

    updatedAt: new Date().toISOString(),

    version: 2,
  };
}

export function sanitizeAppData(data) {
  const safeData = safeObject(data);

  return {
    settings: sanitizeSettings(
      safeData.settings
    ),

    setupBuckets: sanitizeSetupBuckets(
      safeData
    ),

    transactions: sanitizeTransactions(
      safeData.transactions
    ),

    paychecks: sanitizePaychecks(
      safeData.paychecks
    ),

    metadata: sanitizeMetadata(
      safeData.metadata
    ),
  };
}

export function createDefaultAppData() {
  return structuredClone(defaultAppData);
}