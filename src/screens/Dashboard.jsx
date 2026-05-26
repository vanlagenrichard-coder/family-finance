import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData } from "../services/storage";

function money(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));
}

function percent(value) {
  return `${Math.max(0, Math.round(Number(value || 0)))}%`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getSetup(data) {
  return data?.settings?.setup || data?.setup || {};
}

function getTransactions(data) {
  return safeArray(data?.transactions);
}

function isArchived(item) {
  return Boolean(item?.archived || item?.isArchived || item?.inactive);
}

function getName(item) {
  return normalizeText(
    item?.name ||
      item?.label ||
      item?.title ||
      item?.bucket ||
      item?.subBucket ||
      item?.id
  );
}

function getPercentValue(item) {
  return Number(
    item?.percent ??
      item?.percentage ??
      item?.allocation ??
      item?.split ??
      0
  );
}

function getTargetValue(item) {
  return Number(
    item?.targetAmount ??
      item?.target ??
      item?.monthlyTarget ??
      item?.goal ??
      item?.reserveGoal ??
      0
  );
}

function getMonthlyTarget(item) {
  return Number(
    item?.monthlyTarget ??
      item?.monthlyAmount ??
      item?.target ??
      0
  );
}

function getYearlyTarget(item) {
  return Number(
    item?.yearlyTarget ??
      item?.annualTarget ??
      item?.yearlyAmount ??
      0
  );
}

function getReserveGoal(item) {
  return Number(
    item?.reserveGoal ??
      item?.reserveTarget ??
      item?.monthsReserve ??
      0
  );
}

function getDueDate(item) {
  return (
    item?.dueDate ||
    item?.due ||
    item?.nextDueDate ||
    ""
  );
}

function getFrequency(item) {
  return normalizeText(
    item?.frequency ||
      item?.billFrequency ||
      item?.cadence
  );
}

function getTargetDate(item) {
  return (
    item?.targetDate ||
    item?.goalDate ||
    ""
  );
}

function objectToSubBuckets(objectValue) {
  if (
    !objectValue ||
    typeof objectValue !== "object" ||
    Array.isArray(objectValue)
  ) {
    return [];
  }

  return Object.entries(objectValue).map(([name, value]) => {
    if (value && typeof value === "object") {
      return {
        ...value,
        id: value.id || name,
        name: value.name || name,
        percent: getPercentValue(value),
        archived: isArchived(value),
      };
    }

    return {
      id: name,
      name,
      percent: Number(value || 0),
      archived: false,
    };
  });
}

function normalizeSubBuckets(bucket, setup) {
  const directSubBuckets = safeArray(
    bucket?.subBuckets
  ).map((subBucket) => ({
    ...subBucket,
    id: subBucket.id || getName(subBucket),
    name: getName(subBucket),
    percent: getPercentValue(subBucket),
    archived: isArchived(subBucket),
  }));

  if (directSubBuckets.length > 0) {
    return directSubBuckets.filter(
      (subBucket) => subBucket.name
    );
  }

  const bucketName = getName(bucket);

  const setupSubBuckets =
    setup?.subBuckets?.[bucketName] ||
    setup?.subBucketPercentages?.[bucketName] ||
    setup?.subBucketRules?.[bucketName] ||
    setup?.children?.[bucketName];

  return objectToSubBuckets(setupSubBuckets).filter(
    (subBucket) => subBucket.name
  );
}

function normalizeBuckets(setup) {
  const bucketGroups = safeArray(
    setup?.bucketGroups
  ).map((bucket) => ({
    ...bucket,
    id: bucket.id || getName(bucket),
    name: getName(bucket),
    percent: getPercentValue(bucket),
    archived: isArchived(bucket),
    subBuckets: normalizeSubBuckets(bucket, setup),
  }));

  if (bucketGroups.length > 0) {
    return bucketGroups.filter(
      (bucket) => bucket.name
    );
  }

  const groups =
    setup?.groups ||
    setup?.percentages ||
    setup?.bucketPercentages ||
    setup?.allocations ||
    {};

  if (
    !groups ||
    typeof groups !== "object" ||
    Array.isArray(groups)
  ) {
    return [];
  }

  return Object.entries(groups)
    .map(([name, value]) => {
      const bucket =
        value && typeof value === "object"
          ? {
              ...value,
              id: value.id || name,
              name: value.name || name,
              percent: getPercentValue(value),
              archived: isArchived(value),
            }
          : {
              id: name,
              name,
              percent: Number(value || 0),
              archived: false,
            };

      return {
        ...bucket,
        subBuckets: normalizeSubBuckets(bucket, setup),
      };
    })
    .filter((bucket) => bucket.name);
}

function getTransactionType(transaction) {
  return normalizeText(
    transaction?.type
  ).toLowerCase();
}

function getTransactionAmount(transaction) {
  return Number(transaction?.amount || 0);
}

function getTransactionBucket(transaction) {
  return normalizeText(
    transaction?.bucket ||
      transaction?.group ||
      transaction?.bucketName ||
      transaction?.category
  );
}

function getTransactionSubBucket(transaction) {
  return normalizeText(
    transaction?.subBucket ||
      transaction?.subbucket ||
      transaction?.subCategory ||
      transaction?.subBucketName ||
      transaction?.bill ||
      transaction?.name
  );
}

function getTransactionDate(transaction) {
  return (
    transaction?.date ||
    transaction?.createdAt ||
    transaction?.timestamp ||
    ""
  );
}

function getTransactionNote(transaction) {
  return (
    transaction?.note ||
    transaction?.description ||
    ""
  );
}

function getSavedAllocations(transaction) {
  const allocations =
    transaction?.allocations ||
    transaction?.splits ||
    transaction?.split ||
    transaction?.bucketAllocations ||
    transaction?.subBucketAllocations;

  return safeArray(allocations);
}

function createBalancesShell(allBuckets) {
  const balances = {};

  allBuckets.forEach((bucket) => {
    balances[bucket.name] = {
      total: 0,
      subBuckets: {},
    };

    bucket.subBuckets.forEach((subBucket) => {
      balances[bucket.name].subBuckets[
        subBucket.name
      ] = 0;
    });
  });

  return balances;
}

function ensureBucketExists(
  balances,
  bucketName,
  subBucketName
) {
  if (!bucketName) return;

  if (!balances[bucketName]) {
    balances[bucketName] = {
      total: 0,
      subBuckets: {},
    };
  }

  if (
    subBucketName &&
    balances[bucketName].subBuckets[
      subBucketName
    ] === undefined
  ) {
    balances[bucketName].subBuckets[
      subBucketName
    ] = 0;
  }
}

function addBalance(
  balances,
  bucketName,
  subBucketName,
  amount
) {
  if (!bucketName) return;

  ensureBucketExists(
    balances,
    bucketName,
    subBucketName
  );

  if (subBucketName) {
    balances[bucketName].subBuckets[
      subBucketName
    ] += Number(amount || 0);
  }

  balances[bucketName].total += Number(
    amount || 0
  );
}

function addHistory(
  historyMap,
  bucketName,
  subBucketName,
  entry
) {
  if (!bucketName || !subBucketName) return;

  const key = `${bucketName}|||${subBucketName}`;

  if (!historyMap[key]) {
    historyMap[key] = [];
  }

  historyMap[key].push(entry);
}

function applyAllocationTransaction(
  transaction,
  balances,
  historyMap
) {
  const allocations =
    getSavedAllocations(transaction);

  if (allocations.length === 0) {
    return false;
  }

  allocations.forEach((allocation) => {
    const bucketName = normalizeText(
      allocation?.bucket ||
        allocation?.group ||
        allocation?.bucketName
    );

    const subBucketName = normalizeText(
      allocation?.subBucket ||
        allocation?.subbucket ||
        allocation?.subBucketName ||
        allocation?.name
    );

    const amount = Number(
      allocation?.amount || 0
    );

    if (
      !bucketName ||
      !subBucketName ||
      !amount
    ) {
      return;
    }

    addBalance(
      balances,
      bucketName,
      subBucketName,
      amount
    );

    addHistory(
      historyMap,
      bucketName,
      subBucketName,
      {
        type: "Paycheck Funding",
        amount,
        date: getTransactionDate(transaction),
        note: getTransactionNote(transaction),
      }
    );
  });

  return true;
}

function calculatePaycheck(
  transaction,
  activeBuckets,
  balances,
  historyMap
) {
  const usedSavedAllocations =
    applyAllocationTransaction(
      transaction,
      balances,
      historyMap
    );

  if (usedSavedAllocations) {
    return;
  }

  const paycheckAmount =
    getTransactionAmount(transaction);

  activeBuckets.forEach((bucket) => {
    const bucketPercent = Number(
      bucket.percent || 0
    );

    const bucketAmount =
      paycheckAmount * (bucketPercent / 100);

    const activeSubBuckets =
      bucket.subBuckets.filter(
        (subBucket) => !subBucket.archived
      );

    if (activeSubBuckets.length === 0) {
      addBalance(
        balances,
        bucket.name,
        "",
        bucketAmount
      );

      return;
    }

    let remaining = bucketAmount;

    activeSubBuckets.forEach(
      (subBucket, index) => {
        let subAmount = 0;

        if (
          index ===
          activeSubBuckets.length - 1
        ) {
          subAmount = remaining;
        } else {
          subAmount =
            bucketAmount *
            (Number(subBucket.percent || 0) /
              100);

          remaining -= subAmount;
        }

        addBalance(
          balances,
          bucket.name,
          subBucket.name,
          subAmount
        );

        addHistory(
          historyMap,
          bucket.name,
          subBucket.name,
          {
            type: "Paycheck Funding",
            amount: subAmount,
            date: getTransactionDate(transaction),
            note: getTransactionNote(transaction),
          }
        );
      }
    );
  });
}

function calculateBalances(
  transactions,
  allBuckets
) {
  const balances =
    createBalancesShell(allBuckets);

  const historyMap = {};

  transactions.forEach((transaction) => {
    const type =
      getTransactionType(transaction);

    const amount =
      getTransactionAmount(transaction);

    if (
      !amount &&
      getSavedAllocations(transaction)
        .length === 0
    ) {
      return;
    }

    if (type === "paycheck") {
      calculatePaycheck(
        transaction,
        allBuckets.filter(
          (bucket) => !bucket.archived
        ),
        balances,
        historyMap
      );

      return;
    }

    if (type === "expense") {
      const bucketName =
        getTransactionBucket(transaction);

      const subBucketName =
        getTransactionSubBucket(transaction);

      addBalance(
        balances,
        bucketName,
        subBucketName,
        -Math.abs(amount)
      );

      addHistory(
        historyMap,
        bucketName,
        subBucketName,
        {
          type: "Expense",
          amount: -Math.abs(amount),
          date: getTransactionDate(transaction),
          note: getTransactionNote(transaction),
        }
      );

      return;
    }

    if (type === "deposit") {
      const bucketName =
        getTransactionBucket(transaction);

      const subBucketName =
        getTransactionSubBucket(transaction);

      addBalance(
        balances,
        bucketName,
        subBucketName,
        Math.abs(amount)
      );

      addHistory(
        historyMap,
        bucketName,
        subBucketName,
        {
          type: "Deposit",
          amount: Math.abs(amount),
          date: getTransactionDate(transaction),
          note: getTransactionNote(transaction),
        }
      );

      return;
    }

    if (type === "transfer") {
      const fromBucket =
        normalizeText(
          transaction?.fromBucket
        );

      const fromSubBucket =
        normalizeText(
          transaction?.fromSubBucket
        );

      const toBucket =
        normalizeText(transaction?.toBucket);

      const toSubBucket =
        normalizeText(
          transaction?.toSubBucket
        );

      addBalance(
        balances,
        fromBucket,
        fromSubBucket,
        -Math.abs(amount)
      );

      addBalance(
        balances,
        toBucket,
        toSubBucket,
        Math.abs(amount)
      );

      addHistory(
        historyMap,
        fromBucket,
        fromSubBucket,
        {
          type: "Transfer Out",
          amount: -Math.abs(amount),
          date: getTransactionDate(transaction),
          note: getTransactionNote(transaction),
        }
      );

      addHistory(
        historyMap,
        toBucket,
        toSubBucket,
        {
          type: "Transfer In",
          amount: Math.abs(amount),
          date: getTransactionDate(transaction),
          note: getTransactionNote(transaction),
        }
      );
    }
  });

  Object.keys(historyMap).forEach((key) => {
    historyMap[key].sort((a, b) =>
      String(b.date).localeCompare(
        String(a.date)
      )
    );
  });

  return {
    balances,
    historyMap,
  };
}

function getFundedPercent(
  subBucket,
  amount
) {
  const target =
    getTargetValue(subBucket);

  if (target <= 0) {
    return amount >= 0 ? 100 : 0;
  }

  return Math.max(
    0,
    Math.round((amount / target) * 100)
  );
}

function getBucketProgress(
  bucket,
  bucketBalance
) {
  const subBuckets =
    bucket.subBuckets.filter(
      (subBucket) => !subBucket.archived
    );

  let targetTotal = 0;
  let fundedTotal = 0;

  subBuckets.forEach((subBucket) => {
    const target =
      getTargetValue(subBucket);

    const amount = Number(
      bucketBalance?.subBuckets?.[
        subBucket.name
      ] || 0
    );

    if (target > 0) {
      targetTotal += target;
      fundedTotal += Math.min(
        amount,
        target
      );
    }
  });

  if (targetTotal <= 0) {
    return bucketBalance?.total >= 0
      ? 100
      : 0;
  }

  return Math.max(
    0,
    Math.round(
      (fundedTotal / targetTotal) * 100
    )
  );
}

function getBucketStatus(
  progress,
  total
) {
  if (total < 0) {
    return {
      label: "Negative",
      tone: "red",
    };
  }

  if (progress >= 100) {
    return {
      label: "Funded",
      tone: "green",
    };
  }

  if (progress >= 75) {
    return {
      label: "Close",
      tone: "yellow",
    };
  }

  return {
    label: "Underfunded",
    tone: "red",
  };
}

function getDaysUntilDue(dueDate) {
  if (!dueDate) return null;

  const now = new Date();
  const due = new Date(dueDate);

  if (Number.isNaN(due.getTime())) {
    return null;
  }

  const diff =
    due.getTime() - now.getTime();

  return Math.ceil(
    diff / (1000 * 60 * 60 * 24)
  );
}

function getMonthsCovered(
  amount,
  subBucket
) {
  const monthlyTarget =
    getMonthlyTarget(subBucket);

  if (monthlyTarget <= 0) {
    return null;
  }

  return amount / monthlyTarget;
}

function getNeededPerMonth(
  subBucket,
  amount
) {
  const target =
    getTargetValue(subBucket);

  const targetDate =
    getTargetDate(subBucket);

  if (!target || !targetDate) {
    return null;
  }

  const now = new Date();
  const end = new Date(targetDate);

  if (Number.isNaN(end.getTime())) {
    return null;
  }

  const months =
    (end.getFullYear() -
      now.getFullYear()) *
      12 +
    (end.getMonth() - now.getMonth()) +
    1;

  if (months <= 0) {
    return null;
  }

  return Math.max(
    0,
    (target - amount) / months
  );
}

function getSubBucketStatus(
  subBucket,
  amount,
  fundedPercent
) {
  if (amount < 0) {
    return {
      label: "Negative",
      tone: "red",
    };
  }

  if (fundedPercent >= 100) {
    return {
      label: "Funded",
      tone: "green",
    };
  }

  const dueDays = getDaysUntilDue(
    getDueDate(subBucket)
  );

  if (
    dueDays !== null &&
    dueDays >= 0 &&
    dueDays <= 10
  ) {
    return {
      label: "Due Soon",
      tone: "yellow",
    };
  }

  if (fundedPercent >= 75) {
    return {
      label: "Close",
      tone: "yellow",
    };
  }

  return {
    label: "Underfunded",
    tone: "red",
  };
}

function getBucketAccent(bucketName) {
  const key = normalizeKey(bucketName);

  if (key.includes("goal")) {
    return "blue";
  }

  if (key.includes("saving")) {
    return "blue";
  }

  if (key.includes("giving")) {
    return "green";
  }

  if (key.includes("spending")) {
    return "yellow";
  }

  return "green";
}

export default function Dashboard() {
  const [data, setData] = useState(() =>
    loadData()
  );

  const [openBuckets, setOpenBuckets] =
    useState({});

  const [openHistoryKey, setOpenHistoryKey] =
    useState("");

  const refreshData = useCallback(() => {
    const freshData = loadData();
    setData(freshData);
  }, []);

  useEffect(() => {
    refreshData();

    function handleFocus() {
      refreshData();
    }

    function handlePageShow() {
      refreshData();
    }

    function handleStorage(event) {
      if (
        !event.key ||
        event.storageArea === localStorage
      ) {
        refreshData();
      }
    }

    window.addEventListener(
      "focus",
      handleFocus
    );

    window.addEventListener(
      "pageshow",
      handlePageShow
    );

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleFocus
      );

      window.removeEventListener(
        "pageshow",
        handlePageShow
      );

      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, [refreshData]);

  const setup = useMemo(() => {
    return getSetup(data || {});
  }, [data]);

  const allBuckets = useMemo(() => {
    return normalizeBuckets(setup);
  }, [setup]);

  const activeBuckets = useMemo(() => {
    return allBuckets.filter(
      (bucket) => !bucket.archived
    );
  }, [allBuckets]);

  const transactions = useMemo(() => {
    return getTransactions(data || {});
  }, [data]);

  const { balances, historyMap } =
    useMemo(() => {
      return calculateBalances(
        transactions,
        allBuckets
      );
    }, [transactions, allBuckets]);

  const totalMoney = useMemo(() => {
    return activeBuckets.reduce(
      (total, bucket) => {
        return (
          total +
          Number(
            balances?.[bucket.name]?.total ||
              0
          )
        );
      },
      0
    );
  }, [activeBuckets, balances]);

  function toggleBucket(bucketName) {
    setOpenBuckets((current) => ({
      ...current,
      [bucketName]:
        !current[bucketName],
    }));
  }

  function toggleHistory(
    bucketName,
    subBucketName
  ) {
    const key = `${bucketName}|||${subBucketName}`;

    setOpenHistoryKey((current) =>
      current === key ? "" : key
    );
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <Link to="/" className="home-button">
          Home
        </Link>

        <div>
          <h1>Balances</h1>
          <p>
            Live calculated output from
            transactions + setup
          </p>
        </div>
      </header>

      <section className="total-card">
        <span>Total Money</span>

        <strong
          className={
            totalMoney < 0
              ? "negative-money"
              : ""
          }
        >
          {money(totalMoney)}
        </strong>

        <p>
          History = truth · Setup = rules
        </p>
      </section>

      <main className="bucket-list">
        {activeBuckets.map((bucket) => {
          const bucketBalance =
            balances?.[bucket.name] || {
              total: 0,
              subBuckets: {},
            };

          const bucketProgress =
            getBucketProgress(
              bucket,
              bucketBalance
            );

          const bucketStatus =
            getBucketStatus(
              bucketProgress,
              bucketBalance.total
            );

          const isOpen =
            !!openBuckets[bucket.name];

          const activeSubBuckets =
            bucket.subBuckets.filter(
              (subBucket) =>
                !subBucket.archived
            );

          const accent =
            getBucketAccent(bucket.name);

          return (
            <section
              className={`bucket-card accent-${accent}`}
              key={bucket.id || bucket.name}
            >
              <button
                type="button"
                className="bucket-header"
                onClick={() =>
                  toggleBucket(bucket.name)
                }
              >
                <div className="bucket-title-wrap">
                  <div className="bucket-icon">
                    {bucket.name
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>

                  <div>
                    <h2>{bucket.name}</h2>

                    <p>
                      {
                        activeSubBuckets.length
                      }{" "}
                      sub-buckets ·{" "}
                      {percent(
                        bucketProgress
                      )}{" "}
                      funded
                    </p>
                  </div>
                </div>

                <div className="bucket-header-right">
                  <strong
                    className={
                      bucketBalance.total < 0
                        ? "negative-money"
                        : ""
                    }
                  >
                    {money(
                      bucketBalance.total
                    )}
                  </strong>

                  <span
                    className={`status-pill ${bucketStatus.tone}`}
                  >
                    {bucketStatus.label}
                  </span>
                </div>
              </button>

              <div className="bucket-progress-bar">
                <div
                  className={`bucket-progress-fill ${bucketStatus.tone}`}
                  style={{
                    width: `${Math.min(
                      Math.max(
                        bucketProgress,
                        0
                      ),
                      100
                    )}%`,
                  }}
                />
              </div>

              {isOpen && (
                <div className="subbucket-list">
                  {activeSubBuckets.map(
                    (subBucket) => {
                      const amount =
                        Number(
                          bucketBalance
                            ?.subBuckets?.[
                            subBucket.name
                          ] || 0
                        );

                      const target =
                        getTargetValue(
                          subBucket
                        );

                      const fundedPercent =
                        getFundedPercent(
                          subBucket,
                          amount
                        );

                      const status =
                        getSubBucketStatus(
                          subBucket,
                          amount,
                          fundedPercent
                        );

                      const dueDate =
                        getDueDate(
                          subBucket
                        );

                      const frequency =
                        getFrequency(
                          subBucket
                        );

                      const monthlyTarget =
                        getMonthlyTarget(
                          subBucket
                        );

                      const yearlyTarget =
                        getYearlyTarget(
                          subBucket
                        );

                      const reserveGoal =
                        getReserveGoal(
                          subBucket
                        );

                      const monthsCovered =
                        getMonthsCovered(
                          amount,
                          subBucket
                        );

                      const neededPerMonth =
                        getNeededPerMonth(
                          subBucket,
                          amount
                        );

                      const dueDays =
                        getDaysUntilDue(
                          dueDate
                        );

                      const historyKey = `${bucket.name}|||${subBucket.name}`;

                      const history =
                        historyMap[
                          historyKey
                        ] || [];

                      const historyOpen =
                        openHistoryKey ===
                        historyKey;

                      return (
                        <article
                          className="subbucket-card"
                          key={
                            subBucket.id ||
                            subBucket.name
                          }
                        >
                          <button
                            type="button"
                            className="subbucket-main"
                            onClick={() =>
                              toggleHistory(
                                bucket.name,
                                subBucket.name
                              )
                            }
                          >
                            <div className="subbucket-top">
                              <div>
                                <h3>
                                  {
                                    subBucket.name
                                  }
                                </h3>

                                {target >
                                0 ? (
                                  <p>
                                    {money(
                                      amount
                                    )}{" "}
                                    /{" "}
                                    {money(
                                      target
                                    )}
                                  </p>
                                ) : (
                                  <p>
                                    {money(
                                      amount
                                    )}{" "}
                                    available
                                  </p>
                                )}
                              </div>

                              <div className="subbucket-money">
                                <strong
                                  className={
                                    amount < 0
                                      ? "negative-money"
                                      : ""
                                  }
                                >
                                  {money(
                                    amount
                                  )}
                                </strong>

                                <span
                                  className={`status-pill ${status.tone}`}
                                >
                                  {
                                    status.label
                                  }
                                </span>
                              </div>
                            </div>

                            <div className="subbucket-meta">
                              <span>
                                {percent(
                                  fundedPercent
                                )}{" "}
                                funded
                              </span>

                              {dueDate ? (
                                <span>
                                  {dueDays ===
                                  null
                                    ? `Due ${dueDate}`
                                    : dueDays <
                                        0
                                      ? `Overdue ${Math.abs(
                                          dueDays
                                        )} days`
                                      : dueDays ===
                                          0
                                        ? "Due today"
                                        : `Due in ${dueDays} days`}
                                </span>
                              ) : null}

                              {frequency ? (
                                <span>
                                  {
                                    frequency
                                  }
                                </span>
                              ) : null}

                              {monthlyTarget >
                              0 ? (
                                <span>
                                  {money(
                                    monthlyTarget
                                  )}{" "}
                                  monthly
                                </span>
                              ) : null}

                              {yearlyTarget >
                              0 ? (
                                <span>
                                  {money(
                                    yearlyTarget
                                  )}{" "}
                                  yearly
                                </span>
                              ) : null}

                              {reserveGoal >
                              0 ? (
                                <span>
                                  {
                                    reserveGoal
                                  }{" "}
                                  month reserve
                                </span>
                              ) : null}

                              {monthsCovered !==
                              null ? (
                                <span>
                                  {monthsCovered.toFixed(
                                    2
                                  )}{" "}
                                  months covered
                                </span>
                              ) : null}

                              {neededPerMonth !==
                              null ? (
                                <span>
                                  {money(
                                    neededPerMonth
                                  )}{" "}
                                  needed/month
                                </span>
                              ) : null}
                            </div>

                            <div className="funding-bar">
                              <div
                                className={`funded ${status.tone}`}
                                style={{
                                  width: `${Math.min(
                                    Math.max(
                                      fundedPercent,
                                      0
                                    ),
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </button>

                          {historyOpen && (
                            <div className="history-panel">
                              <div className="history-heading">
                                <h4>
                                  History
                                </h4>

                                <span>
                                  {
                                    history.length
                                  }{" "}
                                  entries
                                </span>
                              </div>

                              {history.length ===
                              0 ? (
                                <p className="empty-history">
                                  No activity
                                  yet.
                                </p>
                              ) : (
                                <div className="history-list">
                                  {history.map(
                                    (
                                      entry,
                                      index
                                    ) => (
                                      <div
                                        className="history-row"
                                        key={`${historyKey}-${index}`}
                                      >
                                        <div>
                                          <strong>
                                            {
                                              entry.type
                                            }
                                          </strong>

                                          <span>
                                            {entry.date ||
                                              "No date"}
                                          </span>

                                          {entry.note ? (
                                            <p>
                                              {
                                                entry.note
                                              }
                                            </p>
                                          ) : null}
                                        </div>

                                        <strong
                                          className={
                                            Number(
                                              entry.amount
                                            ) >=
                                            0
                                              ? "amount-positive"
                                              : "amount-negative"
                                          }
                                        >
                                          {money(
                                            entry.amount
                                          )}
                                        </strong>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          );
        })}
      </main>

      <style>{`
        .dashboard-page {
          min-height: 100vh;
          padding: 16px;
          background:
            radial-gradient(circle at top left, rgba(59,130,246,0.12), transparent 30%),
            #f3f4f6;
          color: #111827;
        }

        .dashboard-header {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
        }

        .dashboard-header h1 {
          margin: 0;
          font-size: 30px;
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .dashboard-header p {
          margin: 6px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .home-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          padding: 0 16px;
          border-radius: 14px;
          background: #111827;
          color: white;
          text-decoration: none;
          font-weight: 800;
          flex-shrink: 0;
        }

        .total-card {
          background: #111827;
          color: white;
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 16px;
        }

        .total-card span {
          display: block;
          color: #d1d5db;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .total-card strong {
          display: block;
          font-size: 38px;
          line-height: 1;
          letter-spacing: -0.06em;
        }

        .total-card p {
          margin: 10px 0 0;
          color: #d1d5db;
          font-size: 13px;
        }

        .negative-money {
          color: #ef4444 !important;
        }

        .bucket-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .bucket-card {
          background: white;
          border-radius: 22px;
          overflow: hidden;
          border: 1px solid rgba(226,232,240,0.9);
          box-shadow: 0 2px 10px rgba(15,23,42,0.08);
        }

        .bucket-header {
          width: 100%;
          border: 0;
          background: white;
          padding: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          cursor: pointer;
          text-align: left;
        }

        .bucket-title-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .bucket-icon {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          color: white;
          flex-shrink: 0;
        }

        .accent-blue .bucket-icon {
          background: #2563eb;
        }

        .accent-green .bucket-icon {
          background: #16a34a;
        }

        .accent-yellow .bucket-icon {
          background: #ca8a04;
        }

        .bucket-header h2 {
          margin: 0;
          font-size: 23px;
          letter-spacing: -0.03em;
        }

        .bucket-header p {
          margin: 4px 0 0;
          font-size: 13px;
          color: #6b7280;
        }

        .bucket-header-right {
          text-align: right;
          flex-shrink: 0;
        }

        .bucket-header-right strong {
          display: block;
          font-size: 22px;
          letter-spacing: -0.04em;
          margin-bottom: 7px;
        }

        .bucket-progress-bar {
          height: 7px;
          background: #e5e7eb;
          overflow: hidden;
        }

        .bucket-progress-fill {
          height: 100%;
        }

        .subbucket-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 14px;
          background: #f8fafc;
        }

        .subbucket-card {
          border-radius: 18px;
          overflow: hidden;
          background: white;
          border: 1px solid #e5e7eb;
        }

        .subbucket-main {
          width: 100%;
          border: 0;
          background: transparent;
          padding: 14px;
          text-align: left;
          cursor: pointer;
        }

        .subbucket-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .subbucket-top h3 {
          margin: 0;
          font-size: 18px;
          letter-spacing: -0.03em;
        }

        .subbucket-top p {
          margin: 5px 0 0;
          font-size: 14px;
          color: #6b7280;
        }

        .subbucket-money {
          text-align: right;
          flex-shrink: 0;
        }

        .subbucket-money strong {
          display: block;
          font-size: 18px;
          margin-bottom: 7px;
        }

        .subbucket-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }

        .subbucket-meta span {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          padding: 0 9px;
          border-radius: 999px;
          background: #f3f4f6;
          color: #4b5563;
          font-size: 12px;
          font-weight: 700;
        }

        .funding-bar {
          height: 10px;
          border-radius: 999px;
          background: #e5e7eb;
          overflow: hidden;
          margin-top: 13px;
        }

        .funded {
          height: 100%;
          border-radius: 999px;
        }

        .green {
          background: #16a34a;
          color: #166534;
        }

        .red {
          background: #dc2626;
          color: #991b1b;
        }

        .yellow {
          background: #f59e0b;
          color: #92400e;
        }

        .blue {
          background: #2563eb;
          color: #1d4ed8;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 26px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
        }

        .status-pill.green {
          background: #dcfce7;
        }

        .status-pill.red {
          background: #fee2e2;
        }

        .status-pill.yellow {
          background: #fef3c7;
        }

        .history-panel {
          border-top: 1px solid #e5e7eb;
          background: white;
          padding: 14px;
        }

        .history-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .history-heading h4 {
          margin: 0;
          font-size: 16px;
        }

        .history-heading span {
          font-size: 12px;
          color: #6b7280;
          font-weight: 700;
        }

        .empty-history {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .history-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #f1f5f9;
        }

        .history-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .history-row strong {
          display: block;
          font-size: 14px;
        }

        .history-row span {
          display: block;
          margin-top: 2px;
          font-size: 12px;
          color: #6b7280;
        }

        .history-row p {
          margin: 4px 0 0;
          font-size: 13px;
          color: #4b5563;
        }

        .amount-positive {
          color: #166534;
          white-space: nowrap;
        }

        .amount-negative {
          color: #991b1b;
          white-space: nowrap;
        }

        @media (max-width: 430px) {
          .dashboard-page {
            padding: 12px;
          }

          .total-card strong {
            font-size: 34px;
          }

          .bucket-header {
            padding: 15px;
          }

          .bucket-header h2 {
            font-size: 21px;
          }

          .bucket-header-right strong {
            font-size: 19px;
          }

          .bucket-icon {
            width: 40px;
            height: 40px;
            border-radius: 14px;
          }
        }

        @media (min-width: 768px) {
          .dashboard-page {
            max-width: 980px;
            margin: 0 auto;
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
}