// src/data/model.js
export const STORAGE_KEY = "family_finance_app_data";

export const DEFAULT_SETTINGS = {
  currency: "CAD",
  step1Split: {
    bills: 0.55,
    savings: 0.1,
    giving: 0.05,
    spending: 0.3
  },
  step2Split: {
    family: 0.55,
    wife: 0.15,
    me: 0.15,
    kids: 0.15
  },
  subBucketSplits: {
    savings: {
      holiday: 0.5,
      emergency: 0.2,
      newCar: 0.3
    }
  }
};

export const DEFAULT_BUCKETS = {
  bills: 0,
  savings: 0,
  giving: 0,
  family: 0,
  wife: 0,
  me: 0,
  kids: 0
};

export const DEFAULT_SUB_BUCKETS = {
  savings: {
    holiday: 0,
    emergency: 0,
    newCar: 0
  }
};

export function createDefaultAppData() {
  return {
    settings: structuredClone(DEFAULT_SETTINGS),
    buckets: structuredClone(DEFAULT_BUCKETS),
    subBuckets: structuredClone(DEFAULT_SUB_BUCKETS),
    transactions: [],
    paychecks: []
  };
}

export function sanitizeAppData(data) {
  const fallback = createDefaultAppData();

  if (!data || typeof data !== "object") {
    return fallback;
  }

  return {
    settings: {
      ...fallback.settings,
      ...(data.settings || {}),
      step1Split: {
        ...fallback.settings.step1Split,
        ...(data.settings?.step1Split || {})
      },
      step2Split: {
        ...fallback.settings.step2Split,
        ...(data.settings?.step2Split || {})
      },
      subBucketSplits: {
        savings: {
          ...fallback.settings.subBucketSplits.savings,
          ...(data.settings?.subBucketSplits?.savings || {})
        }
      }
    },
    buckets: {
      ...fallback.buckets,
      ...(data.buckets || {})
    },
    subBuckets: {
      savings: {
        ...fallback.subBuckets.savings,
        ...(data.subBuckets?.savings || {})
      }
    },
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    paychecks: Array.isArray(data.paychecks) ? data.paychecks : []
  };
}