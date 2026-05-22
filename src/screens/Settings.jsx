import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { loadData, saveData, updateData } from "../services/storage";

const DEFAULT_SETUP = {
  paycheckSplit: [
    { id: "bills", name: "Bills", percent: 55, archived: false },
    { id: "savings", name: "Savings", percent: 10, archived: false },
    { id: "giving", name: "Giving", percent: 5, archived: false },
    { id: "spending", name: "Spending", percent: 30, archived: false },
  ],
  bucketGroups: {
    bills: {
      name: "Bills",
      archived: false,
      fixed: true,
      subBuckets: [
        {
          id: "mortgage",
          name: "Mortgage",
          percent: 45,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          reserveMonths: 3,
          reserveGoal: 0,
          archived: false,
        },
        {
          id: "natural-gas",
          name: "Natural Gas",
          percent: 5,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          reserveMonths: 2,
          reserveGoal: 0,
          archived: false,
        },
        {
          id: "hydro",
          name: "Hydro",
          percent: 5,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          reserveMonths: 2,
          reserveGoal: 0,
          archived: false,
        },
        {
          id: "house-insurance",
          name: "House Insurance",
          percent: 5,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          reserveMonths: 2,
          reserveGoal: 0,
          archived: false,
        },
        {
          id: "property-tax",
          name: "Property Tax",
          percent: 10,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "yearly",
          reserveMonths: 12,
          reserveGoal: 0,
          archived: false,
        },
        {
          id: "car-insurance",
          name: "Car Insurance",
          percent: 8,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          reserveMonths: 2,
          reserveGoal: 0,
          archived: false,
        },
        {
          id: "internet",
          name: "Internet",
          percent: 5,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          reserveMonths: 1,
          reserveGoal: 0,
          archived: false,
        },
        {
          id: "phone",
          name: "Phone",
          percent: 5,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          reserveMonths: 1,
          reserveGoal: 0,
          archived: false,
        },
        {
          id: "bank-fee",
          name: "Bank Fee",
          percent: 1,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          reserveMonths: 1,
          reserveGoal: 0,
          archived: false,
        },
        {
          id: "netflix",
          name: "Netflix",
          percent: 1,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          reserveMonths: 1,
          reserveGoal: 0,
          archived: false,
        },
        {
          id: "bills-buffer",
          name: "Bills Buffer",
          percent: 10,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          reserveMonths: 0,
          reserveGoal: 0,
          archived: false,
          isBuffer: true,
        },
      ],
    },
    savings: {
      name: "Savings",
      archived: false,
      fixed: true,
      subBuckets: [
        { id: "emergency", name: "Emergency", percent: 20, archived: false },
        { id: "holiday", name: "Holiday", percent: 50, archived: false },
        { id: "home", name: "Home", percent: 30, archived: false },
      ],
    },
    giving: {
      name: "Giving",
      archived: false,
      fixed: true,
      subBuckets: [
        { id: "church", name: "Church", percent: 100, archived: false },
      ],
    },
    spending: {
      name: "Spending",
      archived: false,
      fixed: true,
      subBuckets: [
        { id: "family", name: "Family", percent: 55, archived: false },
        { id: "wife", name: "Wife", percent: 15, archived: false },
        { id: "me", name: "Me", percent: 15, archived: false },
        { id: "kids", name: "Kids", percent: 15, archived: false },
      ],
    },
    goals: {
      name: "Goals",
      archived: false,
      fixed: true,
      subBuckets: [
        {
          id: "private-school",
          name: "Private School",
          targetAmount: 0,
          targetDate: "",
          archived: false,
        },
        {
          id: "renovation",
          name: "Renovation",
          targetAmount: 0,
          targetDate: "",
          archived: false,
        },
        {
          id: "vacation",
          name: "Vacation",
          targetAmount: 0,
          targetDate: "",
          archived: false,
        },
        {
          id: "golf-simulator",
          name: "Golf Simulator",
          targetAmount: 0,
          targetDate: "",
          archived: false,
        },
      ],
    },
  },
  incomePlanning: {
    baselineWorkChequeAmount: 1000,
    babyBonusExpectedAmount: 0,
    extraIncomeRule: {
      enabled: true,
      normalSplitLimit: 1000,
      extraSplit: [
        { id: "bills", name: "Bills", percent: 0, archived: false },
        { id: "savings", name: "Savings", percent: 50, archived: false },
        { id: "giving", name: "Giving", percent: 0, archived: false },
        { id: "spending", name: "Spending", percent: 20, archived: false },
        { id: "goals", name: "Goals", percent: 30, archived: false },
      ],
    },
  },
};

const PERCENT_GROUP_IDS = ["bills", "savings", "giving", "spending"];

function numberValue(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function makeId(name) {
  const cleanName = `${name || "item"}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${cleanName || "item"}-${Date.now()}`;
}

function activeItems(items) {
  return Array.isArray(items) ? items.filter((item) => !item.archived) : [];
}

function totalPercent(items) {
  return activeItems(items).reduce(
    (sum, item) => sum + numberValue(item.percent),
    0
  );
}

function isValidTotal(total) {
  return Math.abs(total - 100) < 0.01;
}

function monthsUntil(dateValue) {
  if (!dateValue) return 0;

  const today = new Date();
  const target = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(target.getTime()) || target <= today) return 0;

  const yearDiff = target.getFullYear() - today.getFullYear();
  const monthDiff = target.getMonth() - today.getMonth();
  const months = yearDiff * 12 + monthDiff;

  return Math.max(months, 1);
}

function projectedMonthlyNeeded(goal) {
  const targetAmount = numberValue(goal.targetAmount);
  const months = monthsUntil(goal.targetDate);

  if (!targetAmount || !months) return 0;

  return targetAmount / months;
}

function mergeArrayById(defaultItems, savedItems) {
  const safeDefaultItems = Array.isArray(defaultItems) ? defaultItems : [];
  const safeSavedItems = Array.isArray(savedItems) ? savedItems : [];
  const savedById = new Map(safeSavedItems.map((item) => [item.id, item]));

  const mergedDefaults = safeDefaultItems.map((defaultItem) => ({
    ...defaultItem,
    ...(savedById.get(defaultItem.id) || {}),
  }));

  const customItems = safeSavedItems.filter(
    (savedItem) =>
      savedItem &&
      savedItem.id &&
      !safeDefaultItems.some((defaultItem) => defaultItem.id === savedItem.id)
  );

  return [...mergedDefaults, ...customItems];
}

function normalizeBillSubBucketForEditing(subBucket) {
  return {
    id: subBucket.id || makeId(subBucket.name),
    name: textValue(subBucket.name || "Bill"),
    percent: textValue(subBucket.percent),
    monthlyTarget: textValue(subBucket.monthlyTarget),
    dueDate: textValue(subBucket.dueDate),
    frequency:
      subBucket.frequency === "weekly" ||
      subBucket.frequency === "yearly" ||
      subBucket.frequency === "monthly"
        ? subBucket.frequency
        : "monthly",
    reserveMonths: textValue(subBucket.reserveMonths),
    reserveGoal: textValue(subBucket.reserveGoal),
    archived: Boolean(subBucket.archived),
    isBuffer: Boolean(subBucket.isBuffer),
  };
}

function normalizePercentSubBucketForEditing(subBucket) {
  return {
    id: subBucket.id || makeId(subBucket.name),
    name: textValue(subBucket.name || "Sub-Bucket"),
    percent: textValue(subBucket.percent),
    archived: Boolean(subBucket.archived),
  };
}

function normalizeGoalForEditing(goal) {
  return {
    id: goal.id || makeId(goal.name),
    name: textValue(goal.name || "Goal"),
    targetAmount: textValue(goal.targetAmount),
    targetDate: textValue(goal.targetDate),
    archived: Boolean(goal.archived),
  };
}

function normalizeGroupForEditing(groupId, group) {
  const safeGroup = group || {};
  const safeSubBuckets = Array.isArray(safeGroup.subBuckets)
    ? safeGroup.subBuckets
    : [];

  let subBuckets = safeSubBuckets.map(normalizePercentSubBucketForEditing);

  if (groupId === "bills") {
    subBuckets = safeSubBuckets.map(normalizeBillSubBucketForEditing);
  }

  if (groupId === "goals") {
    subBuckets = safeSubBuckets.map(normalizeGoalForEditing);
  }

  return {
    name: textValue(safeGroup.name || DEFAULT_SETUP.bucketGroups[groupId]?.name || "Bucket"),
    archived: Boolean(safeGroup.archived),
    fixed: Boolean(safeGroup.fixed),
    subBuckets,
  };
}

function mergeBucketGroups(savedGroups) {
  const safeSavedGroups = savedGroups || {};
  const mergedGroups = {};

  Object.entries(DEFAULT_SETUP.bucketGroups).forEach(([groupId, defaultGroup]) => {
    const savedGroup = safeSavedGroups[groupId] || {};
    const mergedSubBuckets = mergeArrayById(
      defaultGroup.subBuckets,
      savedGroup.subBuckets
    );

    mergedGroups[groupId] = normalizeGroupForEditing(groupId, {
      ...defaultGroup,
      ...savedGroup,
      fixed: true,
      subBuckets: mergedSubBuckets,
    });
  });

  Object.entries(safeSavedGroups).forEach(([groupId, savedGroup]) => {
    if (mergedGroups[groupId]) return;
    mergedGroups[groupId] = normalizeGroupForEditing(groupId, savedGroup);
  });

  return mergedGroups;
}

function mergeSetup(existingSetup) {
  const savedSetup = existingSetup || {};
  const savedIncomePlanning = savedSetup.incomePlanning || {};
  const savedExtraIncomeRule = savedIncomePlanning.extraIncomeRule || {};

  const paycheckSplit = mergeArrayById(
    DEFAULT_SETUP.paycheckSplit,
    savedSetup.paycheckSplit
  )
    .filter((item) => item.id !== "goals")
    .map((item) => ({
      id: item.id || makeId(item.name),
      name: textValue(item.name || "Bucket"),
      percent: textValue(item.percent),
      archived: Boolean(item.archived),
    }));

  const extraSplit = mergeArrayById(
    DEFAULT_SETUP.incomePlanning.extraIncomeRule.extraSplit,
    savedExtraIncomeRule.extraSplit
  ).map((item) => ({
    id: item.id || makeId(item.name),
    name: textValue(item.name || "Bucket"),
    percent: textValue(item.percent),
    archived: Boolean(item.archived),
  }));

  return {
    paycheckSplit,
    bucketGroups: mergeBucketGroups(savedSetup.bucketGroups),
    incomePlanning: {
      baselineWorkChequeAmount: textValue(
        savedIncomePlanning.baselineWorkChequeAmount ??
          DEFAULT_SETUP.incomePlanning.baselineWorkChequeAmount
      ),
      babyBonusExpectedAmount: textValue(
        savedIncomePlanning.babyBonusExpectedAmount ??
          DEFAULT_SETUP.incomePlanning.babyBonusExpectedAmount
      ),
      extraIncomeRule: {
        enabled:
          typeof savedExtraIncomeRule.enabled === "boolean"
            ? savedExtraIncomeRule.enabled
            : DEFAULT_SETUP.incomePlanning.extraIncomeRule.enabled,
        normalSplitLimit: textValue(
          savedExtraIncomeRule.normalSplitLimit ??
            DEFAULT_SETUP.incomePlanning.extraIncomeRule.normalSplitLimit
        ),
        extraSplit,
      },
    },
  };
}

function normalizeSetupForSave(setup) {
  const bucketGroups = {};

  Object.entries(setup.bucketGroups || {}).forEach(([groupId, group]) => {
    bucketGroups[groupId] = {
      name: group.name || "Bucket",
      archived: Boolean(group.archived),
      fixed: Boolean(group.fixed),
      subBuckets: activeItems(group.subBuckets).map((subBucket) => {
        if (groupId === "bills") {
          return {
            ...subBucket,
            name: subBucket.name || "Bill",
            percent: numberValue(subBucket.percent),
            monthlyTarget: numberValue(subBucket.monthlyTarget),
            dueDate: subBucket.dueDate || "",
            frequency: subBucket.frequency || "monthly",
            reserveMonths: numberValue(subBucket.reserveMonths),
            reserveGoal: numberValue(subBucket.reserveGoal),
            archived: Boolean(subBucket.archived),
            isBuffer: Boolean(subBucket.isBuffer),
          };
        }

        if (groupId === "goals") {
          return {
            ...subBucket,
            name: subBucket.name || "Goal",
            targetAmount: numberValue(subBucket.targetAmount),
            targetDate: subBucket.targetDate || "",
            archived: Boolean(subBucket.archived),
          };
        }

        return {
          ...subBucket,
          name: subBucket.name || "Sub-Bucket",
          percent: numberValue(subBucket.percent),
          archived: Boolean(subBucket.archived),
        };
      }),
    };
  });

  return {
    paycheckSplit: activeItems(setup.paycheckSplit)
      .filter((item) => item.id !== "goals")
      .map((item) => ({
        ...item,
        name: item.name || "Bucket",
        percent: numberValue(item.percent),
        archived: Boolean(item.archived),
      })),
    bucketGroups,
    incomePlanning: {
      baselineWorkChequeAmount: numberValue(
        setup.incomePlanning?.baselineWorkChequeAmount
      ),
      babyBonusExpectedAmount: numberValue(
        setup.incomePlanning?.babyBonusExpectedAmount
      ),
      extraIncomeRule: {
        enabled: Boolean(setup.incomePlanning?.extraIncomeRule?.enabled),
        normalSplitLimit: numberValue(
          setup.incomePlanning?.extraIncomeRule?.normalSplitLimit
        ),
        extraSplit: activeItems(
          setup.incomePlanning?.extraIncomeRule?.extraSplit
        ).map((item) => ({
          ...item,
          name: item.name || "Bucket",
          percent: numberValue(item.percent),
          archived: Boolean(item.archived),
        })),
      },
    },
  };
}

function TotalBadge({ total, required = true }) {
  if (!required) {
    return <span className="total-badge neutral">No fixed %</span>;
  }

  const valid = isValidTotal(total);

  return (
    <span className={`total-badge ${valid ? "valid" : "invalid"}`}>
      {total.toFixed(2).replace(".00", "")}% / 100%
    </span>
  );
}

function SectionCard({ title, total, requiredTotal = true, children }) {
  return (
    <section className="setup-card">
      <div className="card-header">
        <h2>{title}</h2>
        <TotalBadge total={total} required={requiredTotal} />
      </div>
      {children}
    </section>
  );
}

export default function Settings() {
  const [setup, setSetup] = useState(() => mergeSetup(DEFAULT_SETUP));
  const [newBucketName, setNewBucketName] = useState("");
  const [newSubBucketNames, setNewSubBucketNames] = useState({});
  const [saveStatus, setSaveStatus] = useState("Saved");
  const didLoadRef = useRef(false);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    const data = loadData();
    const mergedSetup = mergeSetup(data?.setup);
    setSetup(mergedSetup);

    if (!data?.setup) {
      saveData({
        ...(data || {}),
        setup: normalizeSetupForSave(mergedSetup),
      });
    }

    didLoadRef.current = true;
  }, []);

  useEffect(() => {
    if (!didLoadRef.current) return;

    setSaveStatus("Saving...");

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      const cleanSetup = normalizeSetupForSave(setup);

      updateData((currentData) => ({
        ...(currentData || {}),
        setup: cleanSetup,
      }));

      setSaveStatus("Saved");
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [setup]);

  const validation = useMemo(() => {
    const groupTotals = {};

    PERCENT_GROUP_IDS.forEach((groupId) => {
      const group = setup.bucketGroups?.[groupId];

      if (group && !group.archived) {
        groupTotals[groupId] = totalPercent(group.subBuckets);
      }
    });

    const paycheckTotal = totalPercent(setup.paycheckSplit);

    const allGroupTotalsValid = Object.values(groupTotals).every((total) =>
      isValidTotal(total)
    );

    return {
      paycheckTotal,
      groupTotals,
      valid: isValidTotal(paycheckTotal) && allGroupTotalsValid,
    };
  }, [setup]);

  const activeGroups = Object.entries(setup.bucketGroups || {}).filter(
    ([, group]) => !group.archived
  );

  const activePercentGroups = activeGroups.filter(([groupId]) =>
    PERCENT_GROUP_IDS.includes(groupId)
  );

  const goalsGroup = setup.bucketGroups?.goals || {
    name: "Goals",
    archived: false,
    fixed: true,
    subBuckets: [],
  };

  function updatePaycheckItem(id, field, value) {
    setSetup((current) => ({
      ...current,
      paycheckSplit: current.paycheckSplit.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  }

  function updateExtraSplitItem(id, value) {
    setSetup((current) => ({
      ...current,
      incomePlanning: {
        ...current.incomePlanning,
        extraIncomeRule: {
          ...current.incomePlanning.extraIncomeRule,
          extraSplit: current.incomePlanning.extraIncomeRule.extraSplit.map(
            (item) => (item.id === id ? { ...item, percent: value } : item)
          ),
        },
      },
    }));
  }

  function updateGroupName(groupId, value) {
    setSetup((current) => ({
      ...current,
      bucketGroups: {
        ...current.bucketGroups,
        [groupId]: {
          ...current.bucketGroups[groupId],
          name: value,
        },
      },
      paycheckSplit: current.paycheckSplit.map((item) =>
        item.id === groupId ? { ...item, name: value } : item
      ),
      incomePlanning: {
        ...current.incomePlanning,
        extraIncomeRule: {
          ...current.incomePlanning.extraIncomeRule,
          extraSplit: current.incomePlanning.extraIncomeRule.extraSplit.map(
            (item) => (item.id === groupId ? { ...item, name: value } : item)
          ),
        },
      },
    }));
  }

  function archiveGroup(groupId) {
    if (
      groupId === "bills" ||
      groupId === "savings" ||
      groupId === "giving" ||
      groupId === "spending" ||
      groupId === "goals"
    ) {
      return;
    }

    setSetup((current) => ({
      ...current,
      bucketGroups: {
        ...current.bucketGroups,
        [groupId]: {
          ...current.bucketGroups[groupId],
          archived: true,
        },
      },
      paycheckSplit: current.paycheckSplit.map((item) =>
        item.id === groupId ? { ...item, archived: true, percent: "0" } : item
      ),
      incomePlanning: {
        ...current.incomePlanning,
        extraIncomeRule: {
          ...current.incomePlanning.extraIncomeRule,
          extraSplit: current.incomePlanning.extraIncomeRule.extraSplit.map(
            (item) =>
              item.id === groupId
                ? { ...item, archived: true, percent: "0" }
                : item
          ),
        },
      },
    }));
  }

  function addBucket() {
    const name = newBucketName.trim();

    if (!name) return;

    const id = makeId(name);

    setSetup((current) => ({
      ...current,
      bucketGroups: {
        ...current.bucketGroups,
        [id]: {
          name,
          archived: false,
          fixed: false,
          subBuckets: [
            {
              id: makeId(`${name}-general`),
              name: "General",
              percent: "100",
              archived: false,
            },
          ],
        },
      },
    }));

    setNewBucketName("");
  }

  function updateSubBucket(groupId, subBucketId, field, value) {
    setSetup((current) => ({
      ...current,
      bucketGroups: {
        ...current.bucketGroups,
        [groupId]: {
          ...current.bucketGroups[groupId],
          subBuckets: activeItems(
            current.bucketGroups[groupId]?.subBuckets || []
          ).map((subBucket) =>
            subBucket.id === subBucketId
              ? { ...subBucket, [field]: value }
              : subBucket
          ),
        },
      },
    }));
  }

  function archiveSubBucket(groupId, subBucketId) {
    setSetup((current) => ({
      ...current,
      bucketGroups: {
        ...current.bucketGroups,
        [groupId]: {
          ...current.bucketGroups[groupId],
          subBuckets: activeItems(
            current.bucketGroups[groupId]?.subBuckets || []
          ).map((subBucket) =>
            subBucket.id === subBucketId
              ? { ...subBucket, archived: true, percent: "0" }
              : subBucket
          ),
        },
      },
    }));
  }

  function addSubBucket(groupId) {
    const name = (newSubBucketNames[groupId] || "").trim();

    if (!name) return;

    setSetup((current) => {
      const isBillsGroup = groupId === "bills";
      const isGoalsGroup = groupId === "goals";

      let newSubBucket = {
        id: makeId(name),
        name,
        percent: "0",
        archived: false,
      };

      if (isBillsGroup) {
        newSubBucket = {
          id: makeId(name),
          name,
          percent: "0",
          monthlyTarget: "0",
          dueDate: "",
          frequency: "monthly",
          reserveMonths: "1",
          reserveGoal: "0",
          archived: false,
          isBuffer: false,
        };
      }

      if (isGoalsGroup) {
        newSubBucket = {
          id: makeId(name),
          name,
          targetAmount: "0",
          targetDate: "",
          archived: false,
        };
      }

      return {
        ...current,
        bucketGroups: {
          ...current.bucketGroups,
          [groupId]: {
            ...current.bucketGroups[groupId],
            subBuckets: [
              ...activeItems(current.bucketGroups[groupId]?.subBuckets || []),
              newSubBucket,
            ],
          },
        },
      };
    });

    setNewSubBucketNames((current) => ({
      ...current,
      [groupId]: "",
    }));
  }

  function updateIncomePlanning(field, value) {
    setSetup((current) => ({
      ...current,
      incomePlanning: {
        ...current.incomePlanning,
        [field]: value,
      },
    }));
  }

  function updateExtraIncomeRule(field, value) {
    setSetup((current) => ({
      ...current,
      incomePlanning: {
        ...current.incomePlanning,
        extraIncomeRule: {
          ...current.incomePlanning.extraIncomeRule,
          [field]: value,
        },
      },
    }));
  }

  return (
    <main className="setup-page">
      <style>{`
        .setup-page {
          min-height: 100vh;
          background: #f5f7fb;
          color: #172033;
          padding: 16px;
          box-sizing: border-box;
        }

        .setup-wrap {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          padding-bottom: 20px;
        }

        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }

        .home-link {
          color: white;
          background: #172033;
          border-radius: 14px;
          padding: 12px 16px;
          text-decoration: none;
          font-weight: 800;
          font-size: 15px;
          flex-shrink: 0;
        }

        h1 {
          margin: 0;
          font-size: 30px;
          line-height: 1.1;
        }

        h2 {
          margin: 0;
          font-size: 20px;
          line-height: 1.2;
        }

        h3 {
          margin: 0 0 10px;
          font-size: 17px;
        }

        .subtitle {
          margin: 7px 0 0;
          color: #5d687b;
          font-size: 15px;
          line-height: 1.45;
        }

        .setup-card {
          background: white;
          border-radius: 20px;
          padding: 18px;
          margin-bottom: 16px;
          box-shadow: 0 8px 24px rgba(23, 32, 51, 0.08);
          border: 1px solid #e4e8f0;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 16px;
        }

        .total-badge {
          border-radius: 999px;
          padding: 8px 11px;
          font-size: 13px;
          font-weight: 900;
          white-space: nowrap;
        }

        .total-badge.valid {
          background: #dcfce7;
          color: #166534;
        }

        .total-badge.invalid {
          background: #fee2e2;
          color: #991b1b;
        }

        .total-badge.neutral {
          background: #e0ecff;
          color: #1d4ed8;
        }

        .row {
          display: grid;
          grid-template-columns: 1fr 100px;
          gap: 10px;
          align-items: center;
          margin-bottom: 11px;
        }

        .bucket-row {
          display: grid;
          grid-template-columns: 1fr 98px;
          gap: 10px;
          align-items: center;
          margin-bottom: 11px;
        }

        .bill-row,
        .goal-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          padding: 14px;
          margin-bottom: 12px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #e4e8f0;
        }

        .bill-grid,
        .goal-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 11px;
        }

        .goal-summary {
          grid-column: 1 / -1;
          background: #eef2ff;
          color: #3730a3;
          border-radius: 12px;
          padding: 10px;
          font-weight: 800;
          font-size: 14px;
          line-height: 1.35;
        }

        .label {
          display: block;
          font-size: 13px;
          font-weight: 900;
          color: #5d687b;
          margin-bottom: 6px;
        }

        input,
        select {
          width: 100%;
          min-height: 46px;
          border-radius: 13px;
          border: 1px solid #cfd6e3;
          padding: 10px 11px;
          box-sizing: border-box;
          font-size: 17px;
          background: white;
          color: #172033;
        }

        input:disabled {
          background: #f1f5f9;
          color: #64748b;
        }

        input:focus,
        select:focus {
          outline: 2px solid #93c5fd;
          border-color: #2563eb;
        }

        .small-button,
        .danger-button {
          min-height: 46px;
          border: 0;
          border-radius: 13px;
          padding: 11px 12px;
          font-weight: 900;
          cursor: pointer;
          font-size: 15px;
        }

        .small-button {
          background: #e0ecff;
          color: #1d4ed8;
        }

        .danger-button {
          background: #fee2e2;
          color: #991b1b;
        }

        .danger-button:disabled {
          background: #f1f5f9;
          color: #94a3b8;
          cursor: not-allowed;
        }

        .add-row {
          display: grid;
          grid-template-columns: 1fr 96px;
          gap: 10px;
          margin-top: 14px;
        }

        .section-divider {
          height: 1px;
          background: #e4e8f0;
          margin: 16px 0;
        }

        .income-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 13px;
        }

        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .toggle-row input {
          width: 26px;
          min-height: 26px;
        }

        .warning {
          background: #fee2e2;
          color: #991b1b;
          border-radius: 14px;
          padding: 12px;
          font-weight: 900;
          margin-bottom: 14px;
          line-height: 1.35;
        }

        .save-status {
          position: sticky;
          bottom: 12px;
          margin-top: 12px;
          margin-left: auto;
          width: fit-content;
          background: #172033;
          color: white;
          border-radius: 999px;
          padding: 9px 13px;
          font-size: 14px;
          font-weight: 900;
          box-shadow: 0 8px 24px rgba(23, 32, 51, 0.16);
        }

        .helper-text {
          font-size: 14px;
          color: #64748b;
          line-height: 1.4;
          margin: 8px 0 0;
        }

        @media (min-width: 720px) {
          .income-grid {
            grid-template-columns: 1fr 1fr;
          }

          .bill-row,
          .goal-row {
            grid-template-columns: 1.1fr 1fr;
            align-items: start;
          }
        }
      `}</style>

      <div className="setup-wrap">
        <div className="top-bar">
          <div>
            <h1>Setup</h1>
            <p className="subtitle">
              Rules only. Setup affects future paychecks and future entries only.
            </p>
          </div>
          <Link className="home-link" to="/">
            Home
          </Link>
        </div>

        {!validation.valid && (
          <div className="warning">
            One or more active percentage groups does not equal 100%.
          </div>
        )}

        <SectionCard title="Paycheck Split" total={validation.paycheckTotal}>
          {activeItems(setup.paycheckSplit).map((item) => (
            <div className="row" key={item.id}>
              <input
                value={item.name || ""}
                onChange={(event) =>
                  updateGroupName(item.id, event.target.value)
                }
                aria-label={`${item.name} name`}
              />
              <input
                type="number"
                value={item.percent ?? ""}
                onChange={(event) =>
                  updatePaycheckItem(item.id, "percent", event.target.value)
                }
                aria-label={`${item.name} percent`}
              />
            </div>
          ))}
        </SectionCard>

        <section className="setup-card">
          <div className="card-header">
            <h2>Bucket Management</h2>
          </div>

          {activeGroups.map(([groupId, group]) => (
            <div className="bucket-row" key={groupId}>
              <input
                value={group.name || ""}
                onChange={(event) =>
                  updateGroupName(groupId, event.target.value)
                }
                disabled={Boolean(group.fixed)}
                aria-label={`${group.name} bucket name`}
              />
              <button
                className="danger-button"
                type="button"
                disabled={Boolean(group.fixed)}
                onClick={() => archiveGroup(groupId)}
              >
                Archive
              </button>
            </div>
          ))}

          <div className="add-row">
            <input
              value={newBucketName}
              onChange={(event) => setNewBucketName(event.target.value)}
              placeholder="New bucket name"
              aria-label="New bucket name"
            />
            <button className="small-button" type="button" onClick={addBucket}>
              Add
            </button>
          </div>
        </section>

        {activePercentGroups.map(([groupId, group]) => {
          const isBillsGroup = groupId === "bills";
          const total = validation.groupTotals[groupId] || 0;

          return (
            <SectionCard key={groupId} title={`${group.name} Split`} total={total}>
              {activeItems(group.subBuckets).map((subBucket) =>
                isBillsGroup ? (
                  <div className="bill-row" key={subBucket.id}>
                    <div>
                      <label className="label">Bill Name</label>
                      <input
                        value={subBucket.name || ""}
                        onChange={(event) =>
                          updateSubBucket(
                            groupId,
                            subBucket.id,
                            "name",
                            event.target.value
                          )
                        }
                        aria-label={`${subBucket.name} name`}
                      />
                    </div>

                    <div className="bill-grid">
                      <div>
                        <label className="label">Percent</label>
                        <input
                          type="number"
                          value={subBucket.percent ?? ""}
                          onChange={(event) =>
                            updateSubBucket(
                              groupId,
                              subBucket.id,
                              "percent",
                              event.target.value
                            )
                          }
                          aria-label={`${subBucket.name} percent`}
                        />
                      </div>

                      <div>
                        <label className="label">Monthly Target</label>
                        <input
                          type="number"
                          value={subBucket.monthlyTarget ?? ""}
                          onChange={(event) =>
                            updateSubBucket(
                              groupId,
                              subBucket.id,
                              "monthlyTarget",
                              event.target.value
                            )
                          }
                          aria-label={`${subBucket.name} monthly target`}
                        />
                      </div>

                      <div>
                        <label className="label">Due Date</label>
                        <input
                          type="date"
                          value={subBucket.dueDate || ""}
                          onChange={(event) =>
                            updateSubBucket(
                              groupId,
                              subBucket.id,
                              "dueDate",
                              event.target.value
                            )
                          }
                          aria-label={`${subBucket.name} due date`}
                        />
                      </div>

                      <div>
                        <label className="label">Frequency</label>
                        <select
                          value={subBucket.frequency || "monthly"}
                          onChange={(event) =>
                            updateSubBucket(
                              groupId,
                              subBucket.id,
                              "frequency",
                              event.target.value
                            )
                          }
                          aria-label={`${subBucket.name} frequency`}
                        >
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>

                      <div>
                        <label className="label">Reserve Months</label>
                        <input
                          type="number"
                          value={subBucket.reserveMonths ?? ""}
                          onChange={(event) =>
                            updateSubBucket(
                              groupId,
                              subBucket.id,
                              "reserveMonths",
                              event.target.value
                            )
                          }
                          aria-label={`${subBucket.name} reserve months`}
                        />
                      </div>

                      <div>
                        <label className="label">Reserve Goal</label>
                        <input
                          type="number"
                          value={subBucket.reserveGoal ?? ""}
                          onChange={(event) =>
                            updateSubBucket(
                              groupId,
                              subBucket.id,
                              "reserveGoal",
                              event.target.value
                            )
                          }
                          aria-label={`${subBucket.name} reserve goal`}
                        />
                      </div>

                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => archiveSubBucket(groupId, subBucket.id)}
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bucket-row" key={subBucket.id}>
                    <div className="row" style={{ marginBottom: 0 }}>
                      <input
                        value={subBucket.name || ""}
                        onChange={(event) =>
                          updateSubBucket(
                            groupId,
                            subBucket.id,
                            "name",
                            event.target.value
                          )
                        }
                        aria-label={`${subBucket.name} name`}
                      />
                      <input
                        type="number"
                        value={subBucket.percent ?? ""}
                        onChange={(event) =>
                          updateSubBucket(
                            groupId,
                            subBucket.id,
                            "percent",
                            event.target.value
                          )
                        }
                        aria-label={`${subBucket.name} percent`}
                      />
                    </div>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => archiveSubBucket(groupId, subBucket.id)}
                    >
                      Archive
                    </button>
                  </div>
                )
              )}

              <div className="add-row">
                <input
                  value={newSubBucketNames[groupId] || ""}
                  onChange={(event) =>
                    setNewSubBucketNames((current) => ({
                      ...current,
                      [groupId]: event.target.value,
                    }))
                  }
                  placeholder={`New ${group.name} sub-bucket`}
                  aria-label={`New ${group.name} sub-bucket`}
                />
                <button
                  className="small-button"
                  type="button"
                  onClick={() => addSubBucket(groupId)}
                >
                  Add
                </button>
              </div>
            </SectionCard>
          );
        })}

        <section className="setup-card">
          <div className="card-header">
            <h2>Bills Buffer Logic</h2>
          </div>
          <p className="subtitle">
            Bill targets, due dates, frequency, and reserves are stored for
            future paycheck logic. Once a bill reserve is full, overflow can go
            to Bills Buffer / General Bills.
          </p>
        </section>

        <SectionCard title="Goals" total={0} requiredTotal={false}>
          {activeItems(goalsGroup.subBuckets).map((goal) => {
            const monthlyNeeded = projectedMonthlyNeeded(goal);

            return (
              <div className="goal-row" key={goal.id}>
                <div>
                  <label className="label">Goal Name</label>
                  <input
                    value={goal.name || ""}
                    onChange={(event) =>
                      updateSubBucket(
                        "goals",
                        goal.id,
                        "name",
                        event.target.value
                      )
                    }
                    aria-label={`${goal.name} name`}
                  />
                </div>

                <div className="goal-grid">
                  <div>
                    <label className="label">Target Amount</label>
                    <input
                      type="number"
                      value={goal.targetAmount ?? ""}
                      onChange={(event) =>
                        updateSubBucket(
                          "goals",
                          goal.id,
                          "targetAmount",
                          event.target.value
                        )
                      }
                      aria-label={`${goal.name} target amount`}
                    />
                  </div>

                  <div>
                    <label className="label">Target Date</label>
                    <input
                      type="date"
                      value={goal.targetDate || ""}
                      onChange={(event) =>
                        updateSubBucket(
                          "goals",
                          goal.id,
                          "targetDate",
                          event.target.value
                        )
                      }
                      aria-label={`${goal.name} target date`}
                    />
                  </div>

                  <div className="goal-summary">
                    Projected monthly needed: $
                    {monthlyNeeded.toFixed(2)}
                    <br />
                    Progress: calculated from History + Balances later
                  </div>

                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => archiveSubBucket("goals", goal.id)}
                  >
                    Archive
                  </button>
                </div>
              </div>
            );
          })}

          <div className="add-row">
            <input
              value={newSubBucketNames.goals || ""}
              onChange={(event) =>
                setNewSubBucketNames((current) => ({
                  ...current,
                  goals: event.target.value,
                }))
              }
              placeholder="New goal"
              aria-label="New goal"
            />
            <button
              className="small-button"
              type="button"
              onClick={() => addSubBucket("goals")}
            >
              Add
            </button>
          </div>
        </SectionCard>

        <section className="setup-card">
          <div className="card-header">
            <h2>Income Planning</h2>
          </div>

          <div className="income-grid">
            <div>
              <label className="label">Baseline Work Cheque</label>
              <input
                type="number"
                value={setup.incomePlanning.baselineWorkChequeAmount ?? ""}
                onChange={(event) =>
                  updateIncomePlanning(
                    "baselineWorkChequeAmount",
                    event.target.value
                  )
                }
              />
            </div>

            <div>
              <label className="label">Expected Monthly Baby Bonus</label>
              <input
                type="number"
                value={setup.incomePlanning.babyBonusExpectedAmount ?? ""}
                onChange={(event) =>
                  updateIncomePlanning(
                    "babyBonusExpectedAmount",
                    event.target.value
                  )
                }
              />
            </div>
          </div>

          <div className="section-divider" />

          <div className="toggle-row">
            <div>
              <h3>Extra Income Rule</h3>
              <p className="subtitle">
                First amount uses normal split. Extra above that uses extra
                income split.
              </p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(setup.incomePlanning.extraIncomeRule.enabled)}
              onChange={(event) =>
                updateExtraIncomeRule("enabled", event.target.checked)
              }
              aria-label="Enable extra income rule"
            />
          </div>

          <div>
            <label className="label">Normal Split Limit</label>
            <input
              type="number"
              value={setup.incomePlanning.extraIncomeRule.normalSplitLimit ?? ""}
              onChange={(event) =>
                updateExtraIncomeRule("normalSplitLimit", event.target.value)
              }
            />
          </div>
        </section>

        <SectionCard title="Extra Income Split" total={0} requiredTotal={false}>
          {activeItems(setup.incomePlanning.extraIncomeRule.extraSplit).map(
            (item) => (
              <div className="row" key={item.id}>
                <input
                  value={item.name || ""}
                  disabled
                  aria-label={`${item.name} name`}
                />
                <input
                  type="number"
                  value={item.percent ?? ""}
                  onChange={(event) =>
                    updateExtraSplitItem(item.id, event.target.value)
                  }
                  aria-label={`${item.name} extra income percent`}
                />
              </div>
            )
          )}
          <p className="helper-text">
            Extra income can fund savings, spending, bills overflow, and goals.
          </p>
        </SectionCard>

        <div className="save-status">{saveStatus}</div>
      </div>
    </main>
  );
}