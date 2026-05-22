export const STORAGE_KEY = "family_finance_app_data";

export const DEFAULT_SETTINGS = {
  currency: "CAD",
  step1Split: {
    bills: 0.55,
    savings: 0.1,
    giving: 0.05,
    spending: 0.3,
  },
  step2Split: {
    family: 0.55,
    wife: 0.15,
    me: 0.15,
    kids: 0.15,
  },
  subBucketSplits: {
    savings: {
      holiday: 0.5,
      emergency: 0.2,
      newCar: 0.3,
    },
  },
};

export const DEFAULT_BUCKETS = {
  bills: 0,
  savings: 0,
  giving: 0,
  family: 0,
  wife: 0,
  me: 0,
  kids: 0,
};

export const DEFAULT_SUB_BUCKETS = {
  savings: {
    holiday: 0,
    emergency: 0,
    newCar: 0,
  },
};

export function createDefaultAppData() {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
    },
    buckets: {
      ...DEFAULT_BUCKETS,
    },
    subBuckets: {
      ...DEFAULT_SUB_BUCKETS,
    },
    transactions: [],
    paychecks: [],
    setup: null,
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeObject(value, fallback = {}) {
  return isPlainObject(value) ? value : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeSettings(settings) {
  const safeSettings = safeObject(settings);

  return {
    ...DEFAULT_SETTINGS,
    ...safeSettings,
    step1Split: {
      ...DEFAULT_SETTINGS.step1Split,
      ...safeObject(safeSettings.step1Split),
    },
    step2Split: {
      ...DEFAULT_SETTINGS.step2Split,
      ...safeObject(safeSettings.step2Split),
    },
    subBucketSplits: {
      ...DEFAULT_SETTINGS.subBucketSplits,
      ...safeObject(safeSettings.subBucketSplits),
    },
    setup: safeSettings.setup ?? null,
  };
}

export function sanitizeAppData(data) {
  const safeData = safeObject(data);
  const defaultData = createDefaultAppData();

  return {
    ...safeData,
    settings: sanitizeSettings(safeData.settings),
    buckets: {
      ...DEFAULT_BUCKETS,
      ...safeObject(safeData.buckets),
    },
    subBuckets: {
      ...DEFAULT_SUB_BUCKETS,
      ...safeObject(safeData.subBuckets),
    },
    transactions: safeArray(safeData.transactions),
    paychecks: safeArray(safeData.paychecks),
    setup: safeData.setup ?? safeData.settings?.setup ?? defaultData.setup,
  };
}