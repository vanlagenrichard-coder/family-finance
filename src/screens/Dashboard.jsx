import { useEffect, useMemo, useState } from "react";
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

function getTransactions(data) {
  return Array.isArray(data?.transactions) ? data.transactions : [];
}

function getSetup(data) {
  return data?.settings?.setup || data?.setup || {};
}

function getName(item) {
  return normalizeText(item?.name || item?.label || item?.title || item?.id);
}

function getPercentValue(item) {
  return Number(item?.percent ?? item?.percentage ?? item?.allocation ?? item?.split ?? 0);
}

function isArchived(item) {
  return Boolean(item?.archived || item?.isArchived || item?.inactive);
}

function getTargetValue(item) {
  return Number(
    item?.targetAmount ??
      item?.target ??
      item?.monthlyTarget ??
      item?.monthlyAmount ??
      item?.goal ??
      item?.reserveGoal ??
      0
  );
}

function getMonthlyTarget(item) {
  return Number(item?.monthlyTarget ?? item?.monthlyAmount ?? item?.target ?? 0);
}

function getYearlyTarget(item) {
  return Number(item?.yearlyTarget ?? item?.annualTarget ?? item?.yearlyAmount ?? 0);
}

function getReserveGoal(item) {
  return Number(item?.reserveGoal ?? item?.reserveTarget ?? item?.monthsReserve ?? 0);
}

function getDueDate(item) {
  return item?.dueDate || item?.due || item?.nextDueDate || "";
}

function getFrequency(item) {
  return normalizeText(item?.frequency || item?.billFrequency || item?.cadence);
}

function getTargetDate(item) {
  return item?.targetDate || item?.goalDate || "";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function objectToSubBuckets(objectValue) {
  if (!objectValue || typeof objectValue !== "object" || Array.isArray(objectValue)) {
    return [];
  }

  return Object.entries(objectValue).map(([name, value]) => {
    if (value && typeof value === "object") {
      return {
        id: value.id || name,
        name: value.name || value.label || name,
        percent: Number(value.percent ?? value.percentage ?? value.allocation ?? value.split ?? 0),
        archived: Boolean(value.archived || value.isArchived || value.inactive),
        ...value,
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
  const directSubBuckets = safeArray(bucket?.subBuckets).map((subBucket) => ({
    ...subBucket,
    id: subBucket.id || getName(subBucket),
    name: getName(subBucket),
    percent: getPercentValue(subBucket),
    archived: isArchived(subBucket),
  }));

  if (directSubBuckets.length > 0) {
    return directSubBuckets.filter((subBucket) => subBucket.name);
  }

  const bucketName = getName(bucket);
  const setupSubBuckets =
    setup?.subBuckets?.[bucketName] ||
    setup?.subBucketPercentages?.[bucketName] ||
    setup?.subBucketRules?.[bucketName] ||
    setup?.children?.[bucketName];

  return objectToSubBuckets(setupSubBuckets).filter((subBucket) => subBucket.name);
}

function normalizeBuckets(setup) {
  const bucketGroups = safeArray(setup?.bucketGroups).map((bucket) => ({
    ...bucket,
    id: bucket.id || getName(bucket),
    name: getName(bucket),
    percent: getPercentValue(bucket),
    archived: isArchived(bucket),
    subBuckets: normalizeSubBuckets(bucket, setup),
  }));

  if (bucketGroups.length > 0) {
    return bucketGroups.filter((bucket) => bucket.name);
  }

  const groups =
    setup?.groups ||
    setup?.percentages ||
    setup?.bucketPercentages ||
    setup?.allocations ||
    {};

  if (!groups || typeof groups !== "object" || Array.isArray(groups)) {
    return [];
  }

  return Object.entries(groups)
    .map(([name, value]) => {
      const bucket =
        value && typeof value === "object"
          ? {
              id: value.id || name,
              name: value.name || value.label || name,
              percent: Number(value.percent ?? value.percentage ?? value.allocation ?? value.split ?? 0),
              archived: Boolean(value.archived || value.isArchived || value.inactive),
              ...value,
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
  return normalizeText(transaction.type).toLowerCase();
}

function getTransactionAmount(transaction) {
  return Number(transaction.amount || 0);
}

function getTransactionBucket(transaction) {
  return normalizeText(
    transaction.bucket ||
      transaction.group ||
      transaction.bucketName ||
      transaction.category ||
      transaction.toBucket
  );
}

function getTransactionSubBucket(transaction) {
  return normalizeText(
    transaction.subBucket ||
      transaction.subbucket ||
      transaction.subCategory ||
      transaction.subBucketName ||
      transaction.bill ||
      transaction.name ||
      transaction.toSubBucket
  );
}

function getTransactionDate(transaction) {
  return transaction.date || transaction.createdAt || transaction.timestamp || "";
}

function getTransactionNote(transaction) {
  return transaction.note || transaction.description || "";
}

function createBalanceShell(allBuckets) {
  const balances = {};

  allBuckets.forEach((bucket) => {
    balances[bucket.name] = {
      total: 0,
      subBuckets: {},
    };

    bucket.subBuckets.forEach((subBucket) => {
      balances[bucket.name].subBuckets[subBucket.name] = 0;
    });
  });

  return balances;
}

function addHistory(historyMap, bucketName, subBucketName, entry) {
  if (!bucketName || !subBucketName) return;

  const key = `${bucketName}|||${subBucketName}`;

  if (!historyMap[key]) {
    historyMap[key] = [];
  }

  historyMap[key].push(entry);
}

function ensureBucket(balances, bucketName) {
  if (!bucketName) return;

  if (!balances[bucketName]) {
    balances[bucketName] = {
      total: 0,
      subBuckets: {},
    };
  }
}

function addBalance(balances, bucketName, subBucketName, amount) {
  if (!bucketName) return;

  ensureBucket(balances, bucketName);

  if (subBucketName) {
    if (balances[bucketName].subBuckets[subBucketName] === undefined) {
      balances[bucketName].subBuckets[subBucketName] = 0;
    }

    balances[bucketName].subBuckets[subBucketName] += amount;
  }

  balances[bucketName].total += amount;
}

function getSavedAllocations(transaction) {
  const possible =
    transaction.allocations ||
    transaction.splits ||
    transaction.split ||
    transaction.bucketAllocations ||
    transaction.subBucketAllocations;

  return Array.isArray(possible) ? possible : [];
}

function applyAllocationTransaction(transaction, balances, historyMap, label) {
  const allocations = getSavedAllocations(transaction);

  if (allocations.length === 0) {
    return false;
  }

  allocations.forEach((allocation) => {
    const bucketName = normalizeText(
      allocation.bucket ||
        allocation.group ||
        allocation.bucketName ||
        allocation.category
    );

    const subBucketName = normalizeText(
      allocation.subBucket ||
        allocation.subbucket ||
        allocation.subBucketName ||
        allocation.subCategory ||
        allocation.name
    );

    const amount = Number(allocation.amount || 0);

    if (!bucketName || !subBucketName || !amount) return;

    addBalance(balances, bucketName, subBucketName, amount);

    addHistory(historyMap, bucketName, subBucketName, {
      type: label,
      amount,
      date: getTransactionDate(transaction),
      note: getTransactionNote(transaction),
    });
  });

  return true;
}

function calculatePaycheck(transaction, allBuckets, balances, historyMap) {
  if (applyAllocationTransaction(transaction, balances, historyMap, "Paycheck Funding")) {
    return;
  }

  const amount = getTransactionAmount(transaction);

  allBuckets
    .filter((bucket) => !bucket.archived)
    .forEach((bucket) => {
      const activeSubBuckets = bucket.subBuckets.filter((subBucket) => !subBucket.archived);
      const bucketAmount = amount * (Number(bucket.percent || 0) / 100);

      if (activeSubBuckets.length === 0) {
        addBalance(balances, bucket.name, "", bucketAmount);
        return;
      }

      let remaining = bucketAmount;

      activeSubBuckets.forEach((subBucket, index) => {
        let subAmount;

        if (index === activeSubBuckets.length - 1) {
          subAmount = remaining;
        } else {
          subAmount = bucketAmount * (Number(subBucket.percent || 0) / 100);
          remaining -= subAmount;
        }

        addBalance(balances, bucket.name, subBucket.name, subAmount);

        addHistory(historyMap, bucket.name, subBucket.name, {
          type: "Paycheck Funding",
          amount: subAmount,
          date: getTransactionDate(transaction),
          note: getTransactionNote(transaction),
        });
      });
    });
}

function calculateBalances(transactions, allBuckets) {
  const balances = createBalanceShell(allBuckets);
  const historyMap = {};

  transactions.forEach((transaction) => {
    const type = getTransactionType(transaction);
    const amount = getTransactionAmount(transaction);

    if (!amount && getSavedAllocations(transaction).length === 0) return;

    if (type === "paycheck") {
      calculatePaycheck(transaction, allBuckets, balances, historyMap);
      return;
    }

    if (type === "expense") {
      const bucketName = getTransactionBucket(transaction);
      const subBucketName = getTransactionSubBucket(transaction);

      addBalance(balances, bucketName, subBucketName, -amount);

      addHistory(historyMap, bucketName, subBucketName, {
        type: "Expense",
        amount: -amount,
        date: getTransactionDate(transaction),
        note: getTransactionNote(transaction),
      });

      return;
    }

    if (type === "deposit") {
      const bucketName = getTransactionBucket(transaction);
      const subBucketName = getTransactionSubBucket(transaction);

      addBalance(balances, bucketName, subBucketName, amount);

      addHistory(historyMap, bucketName, subBucketName, {
        type: "Deposit",
        amount,
        date: getTransactionDate(transaction),
        note: getTransactionNote(transaction),
      });

      return;
    }

    if (type === "transfer") {
      const fromBucket = normalizeText(transaction.fromBucket);
      const fromSubBucket = normalizeText(transaction.fromSubBucket);
      const toBucket = normalizeText(transaction.toBucket);
      const toSubBucket = normalizeText(transaction.toSubBucket);

      addBalance(balances, fromBucket, fromSubBucket, -amount);
      addBalance(balances, toBucket, toSubBucket, amount);

      addHistory(historyMap, fromBucket, fromSubBucket, {
        type: "Transfer Out",
        amount: -amount,
        date: getTransactionDate(transaction),
        note: getTransactionNote(transaction),
      });

      addHistory(historyMap, toBucket, toSubBucket, {
        type: "Transfer In",
        amount,
        date: getTransactionDate(transaction),
        note: getTransactionNote(transaction),
      });
    }
  });

  Object.keys(historyMap).forEach((key) => {
    historyMap[key].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  });

  return {
    balances,
    historyMap,
  };
}

function getDaysUntilDue(dueDate) {
  if (!dueDate) return null;

  const now = new Date();
  const due = new Date(dueDate);

  if (Number.isNaN(due.getTime())) return null;

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

function getMonthsCovered(amount, subBucket) {
  const monthlyTarget = getMonthlyTarget(subBucket);

  if (monthlyTarget <= 0) return null;

  return amount / monthlyTarget;
}

function getFundedPercent(subBucket, amount) {
  const target = getTargetValue(subBucket);

  if (target <= 0) {
    return amount >= 0 ? 100 : 0;
  }

  return Math.max(0, Math.round((amount / target) * 100));
}

function getBucketProgress(bucket, bucketBalance) {
  const visibleSubBuckets = bucket.subBuckets.filter((subBucket) => !subBucket.archived);
  let targetTotal = 0;
  let fundedTotal = 0;

  visibleSubBuckets.forEach((subBucket) => {
    const target = getTargetValue(subBucket);
    const amount = Number(bucketBalance?.subBuckets?.[subBucket.name] || 0);

    if (target > 0) {
      targetTotal += target;
      fundedTotal += Math.min(amount, target);
    }
  });

  if (targetTotal <= 0) {
    return Number(bucketBalance?.total || 0) >= 0 ? 100 : 0;
  }

  return Math.max(0, Math.round((fundedTotal / targetTotal) * 100));
}

function getStatus(subBucket, amount, fundedPercent) {
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

  const daysUntilDue = getDaysUntilDue(getDueDate(subBucket));

  if (daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 10) {
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

function getBucketStatus(progress, total) {
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

function getNeededPerMonth(subBucket, amount) {
  const target = getTargetValue(subBucket);
  const targetDate = getTargetDate(subBucket);

  if (!target || !targetDate) return null;

  const end = new Date(targetDate);

  if (Number.isNaN(end.getTime())) return null;

  const now = new Date();
  const months =
    (end.getFullYear() - now.getFullYear()) * 12 +
    (end.getMonth() - now.getMonth()) +
    1;

  if (months <= 0) return null;

  return Math.max(0, (target - amount) / months);
}

function getBucketAccent(bucketName) {
  const key = normalizeKey(bucketName);

  if (key.includes("goal")) return "blue";
  if (key.includes("saving")) return "blue";
  if (key.includes("bill")) return "green";
  if (key.includes("giving")) return "green";
  if (key.includes("spending")) return "yellow";

  return "blue";
}

export default function Dashboard() {
  const [data, setData] = useState(() => loadData());
  const [openBuckets, setOpenBuckets] = useState({});
  const [openHistoryKey, setOpenHistoryKey] = useState("");

  useEffect(() => {
    function refreshData() {
      setData(loadData());
    }

    window.addEventListener("focus", refreshData);
    window.addEventListener("pageshow", refreshData);

    return () => {
      window.removeEventListener("focus", refreshData);
      window.removeEventListener("pageshow", refreshData);
    };
  }, []);

  const setup = useMemo(() => getSetup(data || {}), [data]);
  const allBuckets = useMemo(() => normalizeBuckets(setup), [setup]);
  const activeBuckets = useMemo(() => allBuckets.filter((bucket) => !bucket.archived), [allBuckets]);
  const transactions = useMemo(() => getTransactions(data || {}), [data]);

  const { balances, historyMap } = useMemo(() => {
    return calculateBalances(transactions, allBuckets);
  }, [transactions, allBuckets]);

  const totalMoney = useMemo(() => {
    return activeBuckets.reduce((total, bucket) => {
      return total + Number(balances[bucket.name]?.total || 0);
    }, 0);
  }, [activeBuckets, balances]);

  function toggleBucket(bucketName) {
    setOpenBuckets((current) => ({
      ...current,
      [bucketName]: !current[bucketName],
    }));
  }

  function toggleHistory(bucketName, subBucketName) {
    const key = `${bucketName}|||${subBucketName}`;

    setOpenHistoryKey((current) => (current === key ? "" : key));
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <Link to="/" className="home-button">
          Home
        </Link>

        <div>
          <h1>Balances</h1>
          <p>Calculated from History + Setup</p>
        </div>
      </header>

      <section className="total-card">
        <span>Total Money</span>
        <strong className={totalMoney < 0 ? "negative-money" : ""}>{money(totalMoney)}</strong>
        <p>Live output only. No manual balances.</p>
      </section>

      {activeBuckets.length === 0 ? (
        <section className="empty-card">
          <h2>No active buckets found</h2>
          <p>Go to Setup and add active buckets and sub-buckets.</p>
        </section>
      ) : (
        <main className="bucket-list">
          {activeBuckets.map((bucket) => {
            const bucketBalance = balances[bucket.name] || {
              total: 0,
              subBuckets: {},
            };

            const isOpen = !!openBuckets[bucket.name];
            const bucketProgress = getBucketProgress(bucket, bucketBalance);
            const bucketStatus = getBucketStatus(bucketProgress, bucketBalance.total);
            const activeSubBuckets = bucket.subBuckets.filter((subBucket) => !subBucket.archived);
            const accent = getBucketAccent(bucket.name);

            return (
              <section className={`bucket-card accent-${accent}`} key={bucket.id || bucket.name}>
                <button type="button" className="bucket-header" onClick={() => toggleBucket(bucket.name)}>
                  <div className="bucket-title-wrap">
                    <div className="bucket-icon">{bucket.name.slice(0, 1).toUpperCase()}</div>

                    <div>
                      <h2>{bucket.name}</h2>
                      <p>
                        {activeSubBuckets.length} sub-buckets · {percent(bucketProgress)} funded
                      </p>
                    </div>
                  </div>

                  <div className="bucket-header-right">
                    <strong className={bucketBalance.total < 0 ? "negative-money" : ""}>
                      {money(bucketBalance.total)}
                    </strong>

                    <span className={`status-pill ${bucketStatus.tone}`}>{bucketStatus.label}</span>
                  </div>
                </button>

                <div className="bucket-progress-bar">
                  <div
                    className={`bucket-progress-fill ${bucketStatus.tone}`}
                    style={{
                      width: `${Math.min(Math.max(bucketProgress, 0), 100)}%`,
                    }}
                  />
                </div>

                {isOpen && (
                  <div className="subbucket-list">
                    {activeSubBuckets.map((subBucket) => {
                      const amount = Number(bucketBalance.subBuckets?.[subBucket.name] || 0);
                      const target = getTargetValue(subBucket);
                      const monthlyTarget = getMonthlyTarget(subBucket);
                      const yearlyTarget = getYearlyTarget(subBucket);
                      const reserveGoal = getReserveGoal(subBucket);
                      const dueDate = getDueDate(subBucket);
                      const frequency = getFrequency(subBucket);
                      const targetDate = getTargetDate(subBucket);
                      const fundedPercent = getFundedPercent(subBucket, amount);
                      const status = getStatus(subBucket, amount, fundedPercent);
                      const daysUntilDue = getDaysUntilDue(dueDate);
                      const monthsCovered = getMonthsCovered(amount, subBucket);
                      const neededPerMonth = getNeededPerMonth(subBucket, amount);
                      const historyKey = `${bucket.name}|||${subBucket.name}`;
                      const history = historyMap[historyKey] || [];
                      const historyOpen = openHistoryKey === historyKey;

                      return (
                        <article className="subbucket-card" key={subBucket.id || subBucket.name}>
                          <button
                            type="button"
                            className="subbucket-main"
                            onClick={() => toggleHistory(bucket.name, subBucket.name)}
                          >
                            <div className="subbucket-top">
                              <div>
                                <h3>{subBucket.name}</h3>

                                {target > 0 ? (
                                  <p>
                                    {money(amount)} / {money(target)}
                                  </p>
                                ) : (
                                  <p>{money(amount)} available</p>
                                )}
                              </div>

                              <div className="subbucket-money">
                                <strong className={amount < 0 ? "negative-money" : ""}>{money(amount)}</strong>
                                <span className={`status-pill ${status.tone}`}>{status.label}</span>
                              </div>
                            </div>

                            <div className="subbucket-meta">
                              <span>{percent(fundedPercent)} funded</span>

                              {dueDate ? (
                                <span>
                                  {daysUntilDue === null
                                    ? `Due ${dueDate}`
                                    : daysUntilDue < 0
                                      ? `Overdue ${Math.abs(daysUntilDue)} days`
                                      : daysUntilDue === 0
                                        ? "Due today"
                                        : `Due in ${daysUntilDue} days`}
                                </span>
                              ) : null}

                              {frequency ? <span>{frequency}</span> : null}

                              {monthsCovered !== null ? <span>{monthsCovered.toFixed(2)} months covered</span> : null}

                              {reserveGoal > 0 ? <span>{reserveGoal} month reserve goal</span> : null}

                              {monthlyTarget > 0 ? <span>{money(monthlyTarget)} monthly target</span> : null}

                              {yearlyTarget > 0 ? <span>{money(yearlyTarget)} yearly target</span> : null}

                              {targetDate ? <span>Target date {targetDate}</span> : null}

                              {neededPerMonth !== null ? <span>{money(neededPerMonth)} needed/month</span> : null}
                            </div>

                            <div className="funding-bar">
                              <div
                                className={`funded ${status.tone}`}
                                style={{
                                  width: `${Math.min(Math.max(fundedPercent, 0), 100)}%`,
                                }}
                              />
                            </div>
                          </button>

                          {historyOpen && (
                            <div className="history-panel">
                              <div className="history-heading">
                                <h4>History</h4>
                                <span>{history.length} entries</span>
                              </div>

                              {history.length === 0 ? (
                                <p className="empty-history">No activity yet.</p>
                              ) : (
                                <div className="history-list">
                                  {history.map((entry, index) => (
                                    <div className="history-row" key={`${historyKey}-${index}`}>
                                      <div>
                                        <strong>{entry.type}</strong>
                                        <span>{entry.date || "No date"}</span>
                                        {entry.note ? <p>{entry.note}</p> : null}
                                      </div>

                                      <strong
                                        className={
                                          Number(entry.amount) >= 0 ? "amount-positive" : "amount-negative"
                                        }
                                      >
                                        {money(entry.amount)}
                                      </strong>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </main>
      )}

      <style>{`
        .dashboard-page {
          min-height: 100vh;
          padding: 16px;
          background:
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 32%),
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
          box-shadow: 0 8px 20px rgba(17, 24, 39, 0.16);
        }

        .total-card {
          background: #111827;
          color: white;
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 16px;
          box-shadow: 0 14px 30px rgba(17, 24, 39, 0.2);
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

        .empty-card {
          background: white;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
        }

        .empty-card h2 {
          margin: 0 0 6px;
          font-size: 20px;
        }

        .empty-card p {
          margin: 0;
          color: #6b7280;
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
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08);
          border: 1px solid rgba(226, 232, 240, 0.9);
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
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          overflow: hidden;
          background: white;
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
          letter-spacing: -0.04em;
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
          white-space: nowrap;
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

        .status-pill.blue {
          background: #dbeafe;
        }

        .negative-money {
          color: #ef4444 !important;
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
          font-size: 14px;
          color: #6b7280;
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