import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData, saveData, updateData } from "../services/storage";

const DEFAULT_SETUP_BUCKETS = [
  { id: "bills", name: "Bills", subBuckets: [] },
  { id: "savings", name: "Savings", subBuckets: [] },
  { id: "giving", name: "Giving", subBuckets: [] },
  { id: "spending", name: "Spending", subBuckets: [] },
  { id: "goals", name: "Goals", subBuckets: [] },
];

const TRANSACTION_TYPES = ["Paycheck", "Deposit", "Expense", "Transfer"];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function makeId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `transaction_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isArchived(item) {
  return Boolean(item?.archived || item?.isArchived || item?.inactive);
}

function cleanText(value) {
  return String(value || "").trim();
}

function getPercent(item) {
  const rawValue =
    item?.percent ?? item?.percentage ?? item?.value ?? item?.split ?? null;

  const numberValue = Number(rawValue);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getMonthlyTarget(item) {
  const rawValue =
    item?.monthlyTarget ??
    item?.target ??
    item?.targetAmount ??
    item?.monthlyGoal ??
    "";

  if (rawValue === "" || rawValue === null || rawValue === undefined) return null;

  const numberValue = Number(rawValue);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function getSubBucketList(bucket) {
  if (Array.isArray(bucket?.subBuckets)) return bucket.subBuckets;
  if (Array.isArray(bucket?.subcategories)) return bucket.subcategories;
  if (Array.isArray(bucket?.children)) return bucket.children;
  if (Array.isArray(bucket?.items)) return bucket.items;

  return [];
}

function getSetupBuckets(data) {
  if (Array.isArray(data?.setupBuckets)) return data.setupBuckets;
  if (Array.isArray(data?.buckets)) return data.buckets;
  if (Array.isArray(data?.settings?.setup)) return data.settings.setup;
  if (Array.isArray(data?.setup)) return data.setup;

  const settingsSetup = data?.settings?.setup || {};
  const setup = data?.setup || {};

  if (Array.isArray(settingsSetup?.bucketGroups)) return settingsSetup.bucketGroups;
  if (Array.isArray(settingsSetup?.buckets)) return settingsSetup.buckets;
  if (Array.isArray(setup?.bucketGroups)) return setup.bucketGroups;
  if (Array.isArray(setup?.buckets)) return setup.buckets;

  return DEFAULT_SETUP_BUCKETS;
}

function normalizeBuckets(data) {
  return getSetupBuckets(data)
    .filter((bucket) => !isArchived(bucket))
    .map((bucket) => ({
      id: bucket.id || bucket.name || makeId(),
      name: cleanText(bucket.name || bucket.label || bucket.id),
      percent: getPercent(bucket),
      monthlyTarget: getMonthlyTarget(bucket),
      subBuckets: getSubBucketList(bucket)
        .filter((subBucket) => !isArchived(subBucket))
        .map((subBucket) => ({
          id: subBucket.id || subBucket.name || makeId(),
          name: cleanText(subBucket.name || subBucket.label || subBucket.id),
          percent: getPercent(subBucket),
          monthlyTarget: getMonthlyTarget(subBucket),
        }))
        .filter((subBucket) => subBucket.name),
    }))
    .filter((bucket) => bucket.name);
}

function firstBucketName(buckets) {
  return buckets[0]?.name || "";
}

function firstSubBucketName(buckets, bucketName) {
  const bucket = buckets.find((item) => item.name === bucketName);
  return bucket?.subBuckets?.[0]?.name || "";
}

function createEmptyForm(buckets) {
  const firstBucket = firstBucketName(buckets);
  const firstSubBucket = firstSubBucketName(buckets, firstBucket);
  const secondBucket = buckets[1]?.name || firstBucket;
  const secondSubBucket = firstSubBucketName(buckets, secondBucket);

  return {
    type: "Expense",
    amount: "",
    date: todayDate(),
    bucket: firstBucket,
    subBucket: firstSubBucket,
    fromBucket: firstBucket,
    fromSubBucket: firstSubBucket,
    toBucket: secondBucket,
    toSubBucket: secondSubBucket || firstSubBucket,
    note: "",
  };
}

function normalizeTransactions(data) {
  if (!Array.isArray(data?.transactions)) return [];

  return data.transactions.map((transaction) => ({
    id: transaction.id || makeId(),
    type: transaction.type || "Expense",
    amount: Number(transaction.amount || 0),
    date: transaction.date || todayDate(),
    note: transaction.note || "",
    bucket: transaction.bucket || "",
    subBucket: transaction.subBucket || "",
    fromBucket: transaction.fromBucket || "",
    fromSubBucket: transaction.fromSubBucket || "",
    toBucket: transaction.toBucket || "",
    toSubBucket: transaction.toSubBucket || "",
    allocations: Array.isArray(transaction.allocations)
      ? transaction.allocations
      : [],
    createdAt: transaction.createdAt || new Date().toISOString(),
    updatedAt:
      transaction.updatedAt ||
      transaction.createdAt ||
      new Date().toISOString(),
  }));
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function balanceKey(bucket, subBucket) {
  return `${bucket || ""}|||${subBucket || ""}`;
}

function getSubBucketsForBucket(buckets, bucketName) {
  return buckets.find((bucket) => bucket.name === bucketName)?.subBuckets || [];
}

function History() {
  const [data, setData] = useState(null);
  const [newRow, setNewRow] = useState(() => createEmptyForm(DEFAULT_SETUP_BUCKETS));
  const [draftRows, setDraftRows] = useState({});

  const activeBuckets = useMemo(() => normalizeBuckets(data), [data]);

  const transactions = useMemo(() => {
    return normalizeTransactions(data).sort((a, b) => {
      const dateSort = String(b.date).localeCompare(String(a.date));
      if (dateSort !== 0) return dateSort;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }, [data]);

  useEffect(() => {
    const loadedData = loadData();
    const normalizedData = {
      ...loadedData,
      transactions: normalizeTransactions(loadedData),
    };

    const buckets = normalizeBuckets(normalizedData);

    setData(normalizedData);
    setNewRow(createEmptyForm(buckets));
    saveData(normalizedData);
  }, []);

  useEffect(() => {
    if (!activeBuckets.length) return;

    setNewRow((current) => normalizeRowBuckets(current, activeBuckets));
  }, [activeBuckets]);

  function normalizeRowBuckets(row, buckets) {
    const bucket = buckets.some((item) => item.name === row.bucket)
      ? row.bucket
      : firstBucketName(buckets);

    const fromBucket = buckets.some((item) => item.name === row.fromBucket)
      ? row.fromBucket
      : firstBucketName(buckets);

    const toBucket = buckets.some((item) => item.name === row.toBucket)
      ? row.toBucket
      : buckets[1]?.name || firstBucketName(buckets);

    const subBucket = getSubBucketsForBucket(buckets, bucket).some(
      (item) => item.name === row.subBucket
    )
      ? row.subBucket
      : firstSubBucketName(buckets, bucket);

    const fromSubBucket = getSubBucketsForBucket(buckets, fromBucket).some(
      (item) => item.name === row.fromSubBucket
    )
      ? row.fromSubBucket
      : firstSubBucketName(buckets, fromBucket);

    const toSubBucket = getSubBucketsForBucket(buckets, toBucket).some(
      (item) => item.name === row.toSubBucket
    )
      ? row.toSubBucket
      : firstSubBucketName(buckets, toBucket);

    return {
      ...row,
      bucket,
      subBucket,
      fromBucket,
      fromSubBucket,
      toBucket,
      toSubBucket,
    };
  }

  function getSubBuckets(bucketName) {
    return getSubBucketsForBucket(activeBuckets, bucketName);
  }

  function updateNewRow(field, value) {
    setNewRow((current) => updateRowField(current, field, value));
  }

  function updateDraftRow(transactionId, field, value) {
    const transaction = transactions.find((item) => item.id === transactionId);
    if (!transaction) return;

    setDraftRows((current) => {
      const baseRow = current[transactionId] || transaction;
      return {
        ...current,
        [transactionId]: updateRowField(baseRow, field, value),
      };
    });
  }

  function updateRowField(row, field, value) {
    const next = {
      ...row,
      [field]: value,
    };

    if (field === "type" && value === "Paycheck") {
      next.bucket = "";
      next.subBucket = "";
      next.fromBucket = "";
      next.fromSubBucket = "";
      next.toBucket = "";
      next.toSubBucket = "";
    }

    if (field === "type" && value !== "Paycheck") {
      return normalizeRowBuckets(next, activeBuckets);
    }

    if (field === "bucket") {
      next.subBucket = firstSubBucketName(activeBuckets, value);
    }

    if (field === "fromBucket") {
      next.fromSubBucket = firstSubBucketName(activeBuckets, value);
    }

    if (field === "toBucket") {
      next.toSubBucket = firstSubBucketName(activeBuckets, value);
    }

    return next;
  }

  function getCurrentBalances(excludeTransactionId = "") {
    const balances = {};
    const currentTransactions = normalizeTransactions(data).filter(
      (transaction) => transaction.id !== excludeTransactionId
    );

    currentTransactions.forEach((transaction) => {
      if (Array.isArray(transaction.allocations) && transaction.allocations.length > 0) {
        transaction.allocations.forEach((allocation) => {
          const key = balanceKey(allocation.bucket, allocation.subBucket);
          const amount = Number(allocation.amount || 0);

          if (transaction.type === "Expense") {
            balances[key] = money((balances[key] || 0) - amount);
          } else {
            balances[key] = money((balances[key] || 0) + amount);
          }
        });

        return;
      }

      if (transaction.type === "Expense") {
        const key = balanceKey(transaction.bucket, transaction.subBucket);
        balances[key] = money((balances[key] || 0) - Number(transaction.amount || 0));
        return;
      }

      if (transaction.type === "Deposit") {
        const key = balanceKey(transaction.bucket, transaction.subBucket);
        balances[key] = money((balances[key] || 0) + Number(transaction.amount || 0));
        return;
      }

      if (transaction.type === "Transfer") {
        const fromKey = balanceKey(transaction.fromBucket, transaction.fromSubBucket);
        const toKey = balanceKey(transaction.toBucket, transaction.toSubBucket);

        balances[fromKey] = money((balances[fromKey] || 0) - Number(transaction.amount || 0));
        balances[toKey] = money((balances[toKey] || 0) + Number(transaction.amount || 0));
      }
    });

    return balances;
  }

  function splitAmountByPercent(amount, items) {
    if (!items.length) return [];

    const percentTotal = items.reduce(
      (total, item) => total + Number(item.percent || 0),
      0
    );

    let remaining = money(amount);

    return items.map((item, index) => {
      const percent =
        percentTotal > 0
          ? Number(item.percent || 0) / percentTotal
          : 1 / items.length;

      const itemAmount =
        index === items.length - 1
          ? remaining
          : money(amount * percent);

      remaining = money(remaining - itemAmount);

      return {
        item,
        amount: itemAmount,
      };
    });
  }

  function buildBillsAllocations(bucket, bucketAmount, excludeTransactionId = "") {
    const allocations = [];
    const balances = getCurrentBalances(excludeTransactionId);
    const cappedSubBuckets = bucket.subBuckets.filter(
      (subBucket) => subBucket.monthlyTarget !== null
    );
    const noTargetSubBuckets = bucket.subBuckets.filter(
      (subBucket) => subBucket.monthlyTarget === null
    );

    let leftover = money(bucketAmount);

    splitAmountByPercent(bucketAmount, cappedSubBuckets).forEach(({ item, amount }) => {
      if (leftover <= 0) return;

      const currentBalance = Number(balances[balanceKey(bucket.name, item.name)] || 0);
      const remainingToTarget = money(Number(item.monthlyTarget || 0) - currentBalance);

      if (remainingToTarget <= 0) return;

      const cappedAmount = money(Math.min(amount, remainingToTarget, leftover));

      if (cappedAmount > 0) {
        allocations.push({
          bucket: bucket.name,
          subBucket: item.name,
          amount: cappedAmount,
        });

        leftover = money(leftover - cappedAmount);
      }
    });

    if (leftover > 0 && noTargetSubBuckets.length > 0) {
      splitAmountByPercent(leftover, noTargetSubBuckets).forEach(({ item, amount }) => {
        if (amount > 0) {
          allocations.push({
            bucket: bucket.name,
            subBucket: item.name,
            amount,
          });
        }
      });
    }

    return allocations;
  }

  function buildPaycheckAllocations(amount, excludeTransactionId = "") {
    const allocations = [];

    if (!activeBuckets.length) return allocations;

    const bucketPercentTotal = activeBuckets.reduce(
      (total, bucket) => total + Number(bucket.percent || 0),
      0
    );

    activeBuckets.forEach((bucket) => {
      const bucketPercent =
        bucketPercentTotal > 0
          ? Number(bucket.percent || 0)
          : 100 / activeBuckets.length;

      const bucketAmount = money(amount * (bucketPercent / 100));

      if (Array.isArray(bucket.subBuckets) && bucket.subBuckets.length > 0) {
        if (bucket.name.toLowerCase() === "bills") {
          allocations.push(
            ...buildBillsAllocations(bucket, bucketAmount, excludeTransactionId)
          );
          return;
        }

        const subPercentTotal = bucket.subBuckets.reduce(
          (total, subBucket) => total + Number(subBucket.percent || 0),
          0
        );

        bucket.subBuckets.forEach((subBucket) => {
          const subPercent =
            subPercentTotal > 0
              ? Number(subBucket.percent || 0)
              : 100 / bucket.subBuckets.length;

          const subAmount = money(bucketAmount * (subPercent / 100));

          allocations.push({
            bucket: bucket.name,
            subBucket: subBucket.name,
            amount: subAmount,
          });
        });
      } else {
        allocations.push({
          bucket: bucket.name,
          subBucket: "",
          amount: bucketAmount,
        });
      }
    });

    return allocations.filter((allocation) => Number(allocation.amount || 0) > 0);
  }

  function buildDepositAllocations(amount, bucketName) {
    const bucket = activeBuckets.find((item) => item.name === bucketName);
    const subBuckets = bucket?.subBuckets || [];

    if (!bucket || subBuckets.length === 0) return [];

    const subPercentTotal = subBuckets.reduce(
      (total, subBucket) => total + Number(subBucket.percent || 0),
      0
    );

    return subBuckets.map((subBucket) => {
      const subPercent =
        subPercentTotal > 0
          ? (Number(subBucket.percent || 0) / subPercentTotal) * 100
          : 100 / subBuckets.length;

      const subAmount = amount * (subPercent / 100);

      return {
        bucket: bucket.name,
        subBucket: subBucket.name,
        amount: money(subAmount),
      };
    });
  }

  function buildTransaction(row, existingTransaction) {
    const amount = Number(row.amount);

    if (!amount || amount <= 0) {
      alert("Enter a valid amount.");
      return null;
    }

    const now = new Date().toISOString();
    const type = row.type || "Expense";

    const baseTransaction = {
      id: existingTransaction?.id || makeId(),
      type,
      amount,
      date: row.date || todayDate(),
      note: cleanText(row.note),
      createdAt: existingTransaction?.createdAt || now,
      updatedAt: now,
    };

    if (type === "Paycheck") {
      const allocations = buildPaycheckAllocations(
        amount,
        existingTransaction?.id || ""
      );

      if (!allocations.length) {
        alert("Set up at least one active bucket before adding a paycheck.");
        return null;
      }

      return {
        ...baseTransaction,
        bucket: "",
        subBucket: "",
        fromBucket: "",
        fromSubBucket: "",
        toBucket: "",
        toSubBucket: "",
        allocations,
      };
    }

    if (type === "Transfer") {
      if (
        row.fromBucket === row.toBucket &&
        row.fromSubBucket === row.toSubBucket
      ) {
        alert("Transfer needs a different destination.");
        return null;
      }

      return {
        ...baseTransaction,
        bucket: "",
        subBucket: "",
        fromBucket: row.fromBucket,
        fromSubBucket: row.fromSubBucket,
        toBucket: row.toBucket,
        toSubBucket: row.toSubBucket,
        allocations: [],
      };
    }

    if (type === "Deposit" && row.bucket && !row.subBucket) {
      const allocations = buildDepositAllocations(amount, row.bucket);

      if (allocations.length > 0) {
        return {
          ...baseTransaction,
          bucket: row.bucket,
          subBucket: "",
          fromBucket: "",
          fromSubBucket: "",
          toBucket: "",
          toSubBucket: "",
          allocations,
        };
      }
    }

    return {
      ...baseTransaction,
      bucket: row.bucket,
      subBucket: row.subBucket,
      fromBucket: "",
      fromSubBucket: "",
      toBucket: "",
      toSubBucket: "",
      allocations: [],
    };
  }

  function saveTransactions(nextTransactions) {
    const nextData = updateData((currentData) => ({
      ...currentData,
      transactions: nextTransactions,
    }));

    setData({
      ...nextData,
      transactions: normalizeTransactions(nextData),
    });
  }

  function addTransaction() {
    if (!data) return;

    const transaction = buildTransaction(newRow);
    if (!transaction) return;

    const currentTransactions = normalizeTransactions(data);
    saveTransactions([transaction, ...currentTransactions]);
    setNewRow(createEmptyForm(activeBuckets));
  }

  function saveEditedTransaction(transactionId) {
    if (!data) return;

    const originalTransaction = transactions.find((item) => item.id === transactionId);
    if (!originalTransaction) return;

    const row = draftRows[transactionId] || originalTransaction;
    const transaction = buildTransaction(row, originalTransaction);
    if (!transaction) return;

    const currentTransactions = normalizeTransactions(data);
    const nextTransactions = currentTransactions.map((item) =>
      item.id === transactionId ? transaction : item
    );

    saveTransactions(nextTransactions);

    setDraftRows((current) => {
      const next = { ...current };
      delete next[transactionId];
      return next;
    });
  }

  function deleteTransaction(id) {
    if (!window.confirm("Delete this transaction?")) return;
    if (!data) return;

    const nextTransactions = normalizeTransactions(data).filter(
      (transaction) => transaction.id !== id
    );

    saveTransactions(nextTransactions);

    setDraftRows((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function getDisplayRow(transaction) {
    return draftRows[transaction.id] || transaction;
  }

  function rowTypeClass(type) {
    return `sheet-type ${String(type || "Expense").toLowerCase()}`;
  }

  function handleCellBlur(transactionId) {
    saveEditedTransaction(transactionId);
  }

  function handleCellKeyDown(event, transactionId) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      saveEditedTransaction(transactionId);
    }
  }

  function renderBucketCells(row, onChange, transactionId) {
    if (row.type === "Paycheck") {
      return (
        <>
          <td>
            <select disabled value="">
              <option value="">Auto</option>
            </select>
          </td>
          <td>
            <select disabled value="">
              <option value="">Auto</option>
            </select>
          </td>
        </>
      );
    }

    if (row.type === "Transfer") {
      return (
        <>
          <td className="transfer-cell">
            <span className="mini-label">From</span>
            <select
              value={row.fromBucket || ""}
              onChange={(event) => onChange("fromBucket", event.target.value)}
              onBlur={() => transactionId && handleCellBlur(transactionId)}
            >
              {activeBuckets.map((bucket) => (
                <option key={bucket.id} value={bucket.name}>
                  {bucket.name}
                </option>
              ))}
            </select>

            <span className="mini-label">To</span>
            <select
              value={row.toBucket || ""}
              onChange={(event) => onChange("toBucket", event.target.value)}
              onBlur={() => transactionId && handleCellBlur(transactionId)}
            >
              {activeBuckets.map((bucket) => (
                <option key={bucket.id} value={bucket.name}>
                  {bucket.name}
                </option>
              ))}
            </select>
          </td>

          <td className="transfer-cell">
            <span className="mini-label">From</span>
            <select
              value={row.fromSubBucket || ""}
              onChange={(event) => onChange("fromSubBucket", event.target.value)}
              onBlur={() => transactionId && handleCellBlur(transactionId)}
            >
              {getSubBuckets(row.fromBucket).map((subBucket) => (
                <option key={subBucket.id} value={subBucket.name}>
                  {subBucket.name}
                </option>
              ))}
            </select>

            <span className="mini-label">To</span>
            <select
              value={row.toSubBucket || ""}
              onChange={(event) => onChange("toSubBucket", event.target.value)}
              onBlur={() => transactionId && handleCellBlur(transactionId)}
            >
              {getSubBuckets(row.toBucket).map((subBucket) => (
                <option key={subBucket.id} value={subBucket.name}>
                  {subBucket.name}
                </option>
              ))}
            </select>
          </td>
        </>
      );
    }

    return (
      <>
        <td>
          <select
            value={row.bucket || ""}
            onChange={(event) => onChange("bucket", event.target.value)}
            onBlur={() => transactionId && handleCellBlur(transactionId)}
          >
            {activeBuckets.map((bucket) => (
              <option key={bucket.id} value={bucket.name}>
                {bucket.name}
              </option>
            ))}
          </select>
        </td>

        <td>
          <select
            value={row.subBucket || ""}
            onChange={(event) => onChange("subBucket", event.target.value)}
            onBlur={() => transactionId && handleCellBlur(transactionId)}
          >
            {row.type === "Deposit" && (
              <option value="">Auto Distribute</option>
            )}

            {getSubBuckets(row.bucket).map((subBucket) => (
              <option key={subBucket.id} value={subBucket.name}>
                {subBucket.name}
              </option>
            ))}
          </select>
        </td>
      </>
    );
  }

  if (!data) {
    return (
      <main className="history-page">
        <style>{historyStyles}</style>
        <p className="loading">Loading...</p>
      </main>
    );
  }

  return (
    <main className="history-page">
      <style>{historyStyles}</style>

      <header className="history-topbar">
        <div>
          <p className="eyebrow">Family Finance</p>
          <h1>History</h1>
        </div>

        <Link className="home-button" to="/">
          Home
        </Link>
      </header>

      <section className="sheet-shell">
        <div className="sheet-scroll">
          <table className="history-sheet">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Bucket</th>
                <th>Sub-bucket</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              <tr className="add-row">
                <td>
                  <input
                    type="date"
                    value={newRow.date}
                    onChange={(event) => updateNewRow("date", event.target.value)}
                  />
                </td>

                <td>
                  <select
                    className={rowTypeClass(newRow.type)}
                    value={newRow.type}
                    onChange={(event) => updateNewRow("type", event.target.value)}
                  >
                    {TRANSACTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </td>

                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={newRow.amount}
                    onChange={(event) => updateNewRow("amount", event.target.value)}
                    placeholder="0.00"
                  />
                </td>

                {renderBucketCells(newRow, updateNewRow)}

                <td>
                  <input
                    type="text"
                    value={newRow.note}
                    onChange={(event) => updateNewRow("note", event.target.value)}
                    placeholder="Note"
                  />
                </td>

                <td className="action-cell">
                  <button className="add-button" type="button" onClick={addTransaction}>
                    +
                  </button>
                </td>
              </tr>

              {transactions.length === 0 ? (
                <tr>
                  <td className="empty-row" colSpan="7">
                    No transactions yet. Add your first row above.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => {
                  const row = getDisplayRow(transaction);

                  return (
                    <tr key={transaction.id} className={`data-row ${row.type.toLowerCase()}`}>
                      <td>
                        <input
                          type="date"
                          value={row.date}
                          onChange={(event) =>
                            updateDraftRow(transaction.id, "date", event.target.value)
                          }
                          onBlur={() => handleCellBlur(transaction.id)}
                          onKeyDown={(event) =>
                            handleCellKeyDown(event, transaction.id)
                          }
                        />
                      </td>

                      <td>
                        <select
                          className={rowTypeClass(row.type)}
                          value={row.type}
                          onChange={(event) =>
                            updateDraftRow(transaction.id, "type", event.target.value)
                          }
                          onBlur={() => handleCellBlur(transaction.id)}
                        >
                          {TRANSACTION_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={row.amount}
                          onChange={(event) =>
                            updateDraftRow(transaction.id, "amount", event.target.value)
                          }
                          onBlur={() => handleCellBlur(transaction.id)}
                          onKeyDown={(event) =>
                            handleCellKeyDown(event, transaction.id)
                          }
                        />
                      </td>

                      {renderBucketCells(
                        row,
                        (field, value) => updateDraftRow(transaction.id, field, value),
                        transaction.id
                      )}

                      <td>
                        <input
                          type="text"
                          value={row.note}
                          onChange={(event) =>
                            updateDraftRow(transaction.id, "note", event.target.value)
                          }
                          onBlur={() => handleCellBlur(transaction.id)}
                          onKeyDown={(event) =>
                            handleCellKeyDown(event, transaction.id)
                          }
                          placeholder="Note"
                        />
                      </td>

                      <td className="action-cell">
                        <button
                          className="delete-button"
                          type="button"
                          onClick={() => deleteTransaction(transaction.id)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="sheet-footer">
        <span>{transactions.length} transactions</span>
        <span>
          Paycheck:{" "}
          {formatMoney(
            transactions
              .filter((transaction) => transaction.type === "Paycheck")
              .reduce((total, transaction) => total + transaction.amount, 0)
          )}
        </span>
      </footer>
    </main>
  );
}

const historyStyles = `
  .history-page {
    min-height: 100vh;
    background: #f8fafc;
    color: #111827;
    padding: 10px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .loading {
    font-weight: 900;
    color: #475569;
  }

  .history-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 0 auto 10px;
    max-width: 1180px;
  }

  .eyebrow {
    margin: 0 0 3px;
    color: #64748b;
    font-size: 11px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  h1 {
    margin: 0;
    font-size: 30px;
    line-height: 1;
    font-weight: 950;
    letter-spacing: -0.8px;
  }

  .home-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 0 15px;
    border-radius: 999px;
    background: #111827;
    color: white;
    text-decoration: none;
    font-weight: 900;
    font-size: 14px;
  }

  .sheet-shell {
    max-width: 1180px;
    margin: 0 auto;
    border: 1px solid #cbd5e1;
    background: white;
    overflow: hidden;
  }

  .sheet-scroll {
    width: 100%;
    max-height: calc(100vh - 116px);
    overflow: auto;
  }

  .history-sheet {
    width: 100%;
    min-width: 920px;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    font-size: 14px;
  }

  th,
  td {
    border-right: 1px solid #e2e8f0;
    border-bottom: 1px solid #e2e8f0;
    padding: 0;
    background: white;
    vertical-align: middle;
  }

  th {
    position: sticky;
    top: 0;
    z-index: 6;
    height: 36px;
    background: #f1f5f9;
    color: #334155;
    text-align: left;
    padding: 0 8px;
    font-size: 11px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  th:nth-child(1),
  td:nth-child(1) {
    width: 128px;
  }

  th:nth-child(2),
  td:nth-child(2) {
    width: 118px;
  }

  th:nth-child(3),
  td:nth-child(3) {
    width: 112px;
  }

  th:nth-child(4),
  td:nth-child(4) {
    width: 150px;
  }

  th:nth-child(5),
  td:nth-child(5) {
    width: 160px;
  }

  th:nth-child(6),
  td:nth-child(6) {
    width: 220px;
  }

  th:nth-child(7),
  td:nth-child(7) {
    width: 52px;
  }

  .add-row td {
    position: sticky;
    top: 36px;
    z-index: 5;
    background: #ecfdf5;
    border-bottom: 2px solid #22c55e;
  }

  .data-row.paycheck td {
    background: #eff6ff;
  }

  .data-row.deposit td {
    background: #f0fdf4;
  }

  .data-row.expense td {
    background: #fef2f2;
  }

  .data-row.transfer td {
    background: #f5f3ff;
  }

  input,
  select {
    width: 100%;
    min-height: 42px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #111827;
    padding: 0 8px;
    box-sizing: border-box;
    font-size: 15px;
    font-weight: 750;
    outline: none;
  }

  input:focus,
  select:focus {
    background: white;
    box-shadow: inset 0 0 0 2px #2563eb;
  }

  select:disabled {
    color: #94a3b8;
    opacity: 1;
  }

  input::placeholder {
    color: #94a3b8;
  }

  .sheet-type {
    font-weight: 950;
  }

  .sheet-type.paycheck {
    color: #1d4ed8;
  }

  .sheet-type.deposit {
    color: #15803d;
  }

  .sheet-type.expense {
    color: #dc2626;
  }

  .sheet-type.transfer {
    color: #6d28d9;
  }

  .transfer-cell {
    padding: 3px 0;
  }

  .transfer-cell select {
    min-height: 32px;
    padding-left: 42px;
  }

  .mini-label {
    position: absolute;
    margin-top: 8px;
    margin-left: 7px;
    color: #64748b;
    font-size: 10px;
    font-weight: 950;
    text-transform: uppercase;
    pointer-events: none;
  }

  .action-cell {
    text-align: center;
  }

  button {
    border: 0;
    cursor: pointer;
    font-weight: 950;
  }

  .add-button,
  .delete-button {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    font-size: 24px;
    line-height: 1;
  }

  .add-button {
    background: #16a34a;
    color: white;
  }

  .delete-button {
    background: #fee2e2;
    color: #991b1b;
  }

  .empty-row {
    height: 70px;
    text-align: center;
    color: #64748b;
    font-weight: 850;
    background: white;
  }

  .sheet-footer {
    max-width: 1180px;
    margin: 8px auto 0;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    color: #475569;
    font-size: 12px;
    font-weight: 900;
  }

  @media (max-width: 700px) {
    .history-page {
      padding: 8px;
    }

    .history-topbar {
      margin-bottom: 8px;
    }

    h1 {
      font-size: 26px;
    }

    .home-button {
      min-height: 38px;
      padding: 0 13px;
    }

    .sheet-scroll {
      max-height: calc(100vh - 104px);
    }

    .history-sheet {
      min-width: 860px;
      font-size: 13px;
    }

    th {
      height: 34px;
      font-size: 10px;
    }

    .add-row td {
      top: 34px;
    }

    input,
    select {
      min-height: 44px;
      font-size: 14px;
      padding: 0 7px;
    }

    .transfer-cell select {
      min-height: 34px;
      padding-left: 38px;
    }

    .mini-label {
      margin-top: 9px;
      margin-left: 6px;
      font-size: 9px;
    }

    .add-button,
    .delete-button {
      width: 36px;
      height: 36px;
    }
  }
`;

export default History;