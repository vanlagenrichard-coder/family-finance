import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData, saveData, updateData } from "../services/storage";

const DEFAULT_SETUP_BUCKETS = [
  {
    id: "bills",
    name: "Bills",
    label: "Bills",
    archived: false,
    subBuckets: [],
  },
];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getItemName(item) {
  if (typeof item === "string") {
    return item;
  }

  return item?.name || item?.label || item?.title || item?.id || "";
}

function getItemLabel(item) {
  if (typeof item === "string") {
    return item;
  }

  return item?.label || item?.name || item?.title || item?.id || "";
}

function isArchived(item) {
  return Boolean(item?.archived || item?.isArchived || item?.active === false);
}

function normalizeSetupItem(item) {
  const name = getItemName(item);
  const label = getItemLabel(item);

  return {
    id: item?.id || name,
    name,
    label,
    archived: isArchived(item),
    subBuckets: Array.isArray(item?.subBuckets)
      ? item.subBuckets
      : Array.isArray(item?.subbuckets)
      ? item.subbuckets
      : Array.isArray(item?.children)
      ? item.children
      : [],
  };
}

function getSetup(data) {
  return data?.settings?.setup || data?.setup || {};
}

function getActiveBuckets(data) {
  const setup = getSetup(data);

  let rawBuckets = [];

  if (Array.isArray(setup.buckets)) {
    rawBuckets = setup.buckets;
  } else if (Array.isArray(setup.bucketGroups)) {
    rawBuckets = setup.bucketGroups;
  } else if (Array.isArray(data?.bucketGroups)) {
    rawBuckets = data.bucketGroups;
  } else if (setup.buckets && typeof setup.buckets === "object") {
    rawBuckets = Object.entries(setup.buckets).map(([key, value]) => ({
      id: value?.id || key,
      name: value?.name || value?.label || key,
      label: value?.label || value?.name || key,
      archived: value?.archived || value?.isArchived || value?.active === false,
      subBuckets:
        value?.subBuckets ||
        value?.subbuckets ||
        value?.children ||
        setup.subBuckets?.[key] ||
        [],
    }));
  } else if (setup.bucketGroups && typeof setup.bucketGroups === "object") {
    rawBuckets = Object.entries(setup.bucketGroups).map(([key, value]) => ({
      id: value?.id || key,
      name: value?.name || value?.label || key,
      label: value?.label || value?.name || key,
      archived: value?.archived || value?.isArchived || value?.active === false,
      subBuckets:
        value?.subBuckets ||
        value?.subbuckets ||
        value?.children ||
        setup.subBuckets?.[key] ||
        [],
    }));
  }

  if (rawBuckets.length === 0) {
    rawBuckets = DEFAULT_SETUP_BUCKETS;
  }

  return rawBuckets
    .map((bucket) => normalizeSetupItem(bucket))
    .filter((bucket) => bucket.name && !bucket.archived)
    .map((bucket) => ({
      ...bucket,
      subBuckets: bucket.subBuckets
        .map((subBucket) => normalizeSetupItem(subBucket))
        .filter((subBucket) => subBucket.name && !subBucket.archived),
    }));
}

function getFirstBucketName(buckets) {
  return buckets[0]?.name || "";
}

function getFirstSubBucketName(buckets, bucketName) {
  const bucket = buckets.find((item) => item.name === bucketName);
  return bucket?.subBuckets?.[0]?.name || "";
}

function createEmptyForm(buckets) {
  const firstBucket = getFirstBucketName(buckets);
  const firstSubBucket = getFirstSubBucketName(buckets, firstBucket);
  const secondBucket = buckets[1]?.name || firstBucket;
  const secondSubBucket =
    getFirstSubBucketName(buckets, secondBucket) || firstSubBucket;

  return {
    type: "Expense",
    amount: "",
    bucket: firstBucket,
    subBucket: firstSubBucket,
    fromBucket: firstBucket,
    fromSubBucket: firstSubBucket,
    toBucket: secondBucket,
    toSubBucket: secondSubBucket,
    date: todayDate(),
    note: "",
  };
}

function normalizeTransactions(data) {
  if (!data || !Array.isArray(data.transactions)) {
    return [];
  }

  return data.transactions.map((transaction) => ({
    id: transaction.id || crypto.randomUUID(),
    type: transaction.type || "Expense",
    amount: Number(transaction.amount || 0),
    bucket: transaction.bucket || "",
    subBucket: transaction.subBucket || transaction.subbucket || "",
    fromBucket: transaction.fromBucket || "",
    fromSubBucket: transaction.fromSubBucket || "",
    toBucket: transaction.toBucket || "",
    toSubBucket: transaction.toSubBucket || "",
    date: transaction.date || todayDate(),
    note: transaction.note || "",
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

export default function History() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(() => createEmptyForm(DEFAULT_SETUP_BUCKETS));
  const [editingId, setEditingId] = useState(null);

  const activeBuckets = useMemo(() => getActiveBuckets(data), [data]);

  const transactions = useMemo(() => {
    return normalizeTransactions(data).sort((a, b) => {
      const dateCompare = new Date(b.date) - new Date(a.date);

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [data]);

  useEffect(() => {
    const loadedData = loadData();
    const normalizedData = {
      ...loadedData,
      transactions: normalizeTransactions(loadedData),
    };
    const buckets = getActiveBuckets(normalizedData);

    setData(normalizedData);
    setForm(createEmptyForm(buckets));
    saveData(normalizedData);
  }, []);

  useEffect(() => {
    if (!activeBuckets.length) {
      return;
    }

    setForm((current) => {
      const bucketExists = activeBuckets.some(
        (bucket) => bucket.name === current.bucket
      );
      const fromBucketExists = activeBuckets.some(
        (bucket) => bucket.name === current.fromBucket
      );
      const toBucketExists = activeBuckets.some(
        (bucket) => bucket.name === current.toBucket
      );

      const nextBucket = bucketExists
        ? current.bucket
        : getFirstBucketName(activeBuckets);
      const nextFromBucket = fromBucketExists
        ? current.fromBucket
        : getFirstBucketName(activeBuckets);
      const nextToBucket = toBucketExists
        ? current.toBucket
        : activeBuckets[1]?.name || getFirstBucketName(activeBuckets);

      const subBucketExists = activeBuckets
        .find((bucket) => bucket.name === nextBucket)
        ?.subBuckets.some((subBucket) => subBucket.name === current.subBucket);

      const fromSubBucketExists = activeBuckets
        .find((bucket) => bucket.name === nextFromBucket)
        ?.subBuckets.some(
          (subBucket) => subBucket.name === current.fromSubBucket
        );

      const toSubBucketExists = activeBuckets
        .find((bucket) => bucket.name === nextToBucket)
        ?.subBuckets.some((subBucket) => subBucket.name === current.toSubBucket);

      return {
        ...current,
        bucket: nextBucket,
        subBucket: subBucketExists
          ? current.subBucket
          : getFirstSubBucketName(activeBuckets, nextBucket),
        fromBucket: nextFromBucket,
        fromSubBucket: fromSubBucketExists
          ? current.fromSubBucket
          : getFirstSubBucketName(activeBuckets, nextFromBucket),
        toBucket: nextToBucket,
        toSubBucket: toSubBucketExists
          ? current.toSubBucket
          : getFirstSubBucketName(activeBuckets, nextToBucket),
      };
    });
  }, [activeBuckets]);

  function getSubBuckets(bucketName) {
    return (
      activeBuckets.find((bucket) => bucket.name === bucketName)?.subBuckets ||
      []
    );
  }

  function updateForm(field, value) {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      if (field === "type") {
        next.type = value;
      }

      if (field === "bucket") {
        next.subBucket = getFirstSubBucketName(activeBuckets, value);
      }

      if (field === "fromBucket") {
        next.fromSubBucket = getFirstSubBucketName(activeBuckets, value);
      }

      if (field === "toBucket") {
        next.toSubBucket = getFirstSubBucketName(activeBuckets, value);
      }

      return next;
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm(activeBuckets));
  }

  function buildTransaction() {
    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      alert("Enter a valid amount.");
      return null;
    }

    const now = new Date().toISOString();

    const baseTransaction = {
      id: editingId || crypto.randomUUID(),
      type: form.type,
      amount,
      date: form.date,
      note: form.note.trim(),
      createdAt: editingId
        ? transactions.find((transaction) => transaction.id === editingId)
            ?.createdAt || now
        : now,
      updatedAt: now,
    };

    if (form.type === "Paycheck") {
      return {
        ...baseTransaction,
        bucket: "",
        subBucket: "",
        fromBucket: "",
        fromSubBucket: "",
        toBucket: "",
        toSubBucket: "",
      };
    }

    if (form.type === "Transfer") {
      if (
        form.fromBucket === form.toBucket &&
        form.fromSubBucket === form.toSubBucket
      ) {
        alert("Transfer needs a different destination.");
        return null;
      }

      return {
        ...baseTransaction,
        bucket: "",
        subBucket: "",
        fromBucket: form.fromBucket,
        fromSubBucket: form.fromSubBucket,
        toBucket: form.toBucket,
        toSubBucket: form.toSubBucket,
      };
    }

    return {
      ...baseTransaction,
      bucket: form.bucket,
      subBucket: form.subBucket,
      fromBucket: "",
      fromSubBucket: "",
      toBucket: "",
      toSubBucket: "",
    };
  }

  function saveTransaction(event) {
    event.preventDefault();

    const transaction = buildTransaction();

    if (!transaction || !data) {
      return;
    }

    const currentTransactions = normalizeTransactions(data);

    const nextTransactions = editingId
      ? currentTransactions.map((item) =>
          item.id === editingId ? transaction : item
        )
      : [transaction, ...currentTransactions];

    const nextData = updateData((currentData) => ({
      ...currentData,
      transactions: nextTransactions,
    }));

    setData({
      ...nextData,
      transactions: normalizeTransactions(nextData),
    });

    resetForm();
  }

  function editTransaction(transaction) {
    setEditingId(transaction.id);

    setForm({
      type: transaction.type,
      amount: String(transaction.amount),
      bucket: transaction.bucket || getFirstBucketName(activeBuckets),
      subBucket:
        transaction.subBucket ||
        getFirstSubBucketName(activeBuckets, getFirstBucketName(activeBuckets)),
      fromBucket: transaction.fromBucket || getFirstBucketName(activeBuckets),
      fromSubBucket:
        transaction.fromSubBucket ||
        getFirstSubBucketName(activeBuckets, getFirstBucketName(activeBuckets)),
      toBucket:
        transaction.toBucket ||
        activeBuckets[1]?.name ||
        getFirstBucketName(activeBuckets),
      toSubBucket:
        transaction.toSubBucket ||
        getFirstSubBucketName(
          activeBuckets,
          activeBuckets[1]?.name || getFirstBucketName(activeBuckets)
        ),
      date: transaction.date,
      note: transaction.note || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function deleteTransaction(id) {
    const confirmed = window.confirm("Delete this transaction?");

    if (!confirmed || !data) {
      return;
    }

    const nextTransactions = normalizeTransactions(data).filter(
      (transaction) => transaction.id !== id
    );

    const nextData = updateData((currentData) => ({
      ...currentData,
      transactions: nextTransactions,
    }));

    setData({
      ...nextData,
      transactions: normalizeTransactions(nextData),
    });

    if (editingId === id) {
      resetForm();
    }
  }

  function transactionTitle(transaction) {
    if (transaction.type === "Paycheck") {
      return "Paycheck auto split";
    }

    if (transaction.type === "Transfer") {
      return `${transaction.fromBucket} / ${transaction.fromSubBucket} → ${transaction.toBucket} / ${transaction.toSubBucket}`;
    }

    return `${transaction.bucket} / ${transaction.subBucket}`;
  }

  function transactionAmountClass(transaction) {
    if (transaction.type === "Expense") {
      return "history-amount history-amount-negative";
    }

    if (transaction.type === "Transfer") {
      return "history-amount history-amount-transfer";
    }

    return "history-amount history-amount-positive";
  }

  function transactionAmountPrefix(transaction) {
    if (transaction.type === "Expense") {
      return "-";
    }

    if (transaction.type === "Transfer") {
      return "";
    }

    return "+";
  }

  if (!data) {
    return (
      <main className="history-page">
        <style>{historyStyles}</style>
        <p className="history-loading">Loading...</p>
      </main>
    );
  }

  return (
    <main className="history-page">
      <style>{historyStyles}</style>

      <header className="history-header">
        <div>
          <p className="history-eyebrow">Family Finance</p>
          <h1>History</h1>
          <p className="history-subtitle">See exactly where your money went.</p>
        </div>

        <Link className="history-home-button" to="/">
          Home
        </Link>
      </header>

      <section className="history-entry-card">
        <div className="history-section-title-row">
          <div>
            <p className="history-eyebrow">Fast Entry</p>
            <h2>{editingId ? "Edit Transaction" : "Add Transaction"}</h2>
          </div>
        </div>

        <form className="history-form" onSubmit={saveTransaction}>
          <label className="history-field">
            <span>Type</span>
            <select
              value={form.type}
              onChange={(event) => updateForm("type", event.target.value)}
            >
              <option value="Paycheck">Paycheck</option>
              <option value="Expense">Expense</option>
              <option value="Deposit">Deposit</option>
              <option value="Transfer">Transfer</option>
            </select>
          </label>

          <label className="history-field">
            <span>Amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => updateForm("amount", event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </label>

          <label className="history-field">
            <span>Date</span>
            <input
              type="date"
              value={form.date}
              onChange={(event) => updateForm("date", event.target.value)}
            />
          </label>

          {(form.type === "Expense" || form.type === "Deposit") && (
            <>
              <label className="history-field">
                <span>Bucket</span>
                <select
                  value={form.bucket}
                  onChange={(event) => updateForm("bucket", event.target.value)}
                >
                  {activeBuckets.map((bucket) => (
                    <option key={bucket.id || bucket.name} value={bucket.name}>
                      {bucket.label || bucket.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="history-field">
                <span>Sub-bucket</span>
                <select
                  value={form.subBucket}
                  onChange={(event) =>
                    updateForm("subBucket", event.target.value)
                  }
                >
                  {getSubBuckets(form.bucket).map((subBucket) => (
                    <option
                      key={subBucket.id || subBucket.name}
                      value={subBucket.name}
                    >
                      {subBucket.label || subBucket.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {form.type === "Transfer" && (
            <>
              <div className="history-transfer-box">
                <h3>From</h3>

                <label className="history-field">
                  <span>Bucket</span>
                  <select
                    value={form.fromBucket}
                    onChange={(event) =>
                      updateForm("fromBucket", event.target.value)
                    }
                  >
                    {activeBuckets.map((bucket) => (
                      <option key={bucket.id || bucket.name} value={bucket.name}>
                        {bucket.label || bucket.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="history-field">
                  <span>Sub-bucket</span>
                  <select
                    value={form.fromSubBucket}
                    onChange={(event) =>
                      updateForm("fromSubBucket", event.target.value)
                    }
                  >
                    {getSubBuckets(form.fromBucket).map((subBucket) => (
                      <option
                        key={subBucket.id || subBucket.name}
                        value={subBucket.name}
                      >
                        {subBucket.label || subBucket.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="history-transfer-box">
                <h3>To</h3>

                <label className="history-field">
                  <span>Bucket</span>
                  <select
                    value={form.toBucket}
                    onChange={(event) =>
                      updateForm("toBucket", event.target.value)
                    }
                  >
                    {activeBuckets.map((bucket) => (
                      <option key={bucket.id || bucket.name} value={bucket.name}>
                        {bucket.label || bucket.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="history-field">
                  <span>Sub-bucket</span>
                  <select
                    value={form.toSubBucket}
                    onChange={(event) =>
                      updateForm("toSubBucket", event.target.value)
                    }
                  >
                    {getSubBuckets(form.toBucket).map((subBucket) => (
                      <option
                        key={subBucket.id || subBucket.name}
                        value={subBucket.name}
                      >
                        {subBucket.label || subBucket.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}

          <label className="history-field history-field-full">
            <span>Note</span>
            <input
              type="text"
              value={form.note}
              onChange={(event) => updateForm("note", event.target.value)}
              placeholder="Optional note"
            />
          </label>

          <div className="history-form-actions">
            <button className="history-primary-button" type="submit">
              {editingId ? "Save Changes" : "Add Transaction"}
            </button>

            {editingId && (
              <button
                type="button"
                className="history-secondary-button"
                onClick={resetForm}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="history-list">
        <div className="history-list-header">
          <div>
            <p className="history-eyebrow">Ledger</p>
            <h2>Transaction History</h2>
          </div>

          <span className="history-count">{transactions.length}</span>
        </div>

        {transactions.length === 0 ? (
          <div className="history-empty-card">
            <strong>No transactions yet.</strong>
            <p>Add your first paycheck, expense, deposit, or transfer above.</p>
          </div>
        ) : (
          <div className="history-card-stack">
            {transactions.map((transaction) => (
              <article key={transaction.id} className="history-transaction-card">
                <div className="history-transaction-main">
                  <div className="history-transaction-left">
                    <span
                      className={`history-type-pill history-type-${transaction.type.toLowerCase()}`}
                    >
                      {transaction.type}
                    </span>

                    <h3>{transactionTitle(transaction)}</h3>

                    <div className="history-transaction-meta">
                      <span>{transaction.date}</span>
                      {transaction.note && <span>{transaction.note}</span>}
                    </div>
                  </div>

                  <span className={transactionAmountClass(transaction)}>
                    {transactionAmountPrefix(transaction)}
                    {formatMoney(transaction.amount)}
                  </span>
                </div>

                <div className="history-transaction-actions">
                  <button
                    type="button"
                    onClick={() => editTransaction(transaction)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="history-danger-button"
                    onClick={() => deleteTransaction(transaction.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const historyStyles = `
  .history-page {
    min-height: 100vh;
    width: 100%;
    background: #f4f6f8;
    color: #111827;
    padding: 16px 12px 34px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .history-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    max-width: 800px;
    margin: 0 auto 12px;
  }

  .history-header h1 {
    margin: 0;
    font-size: 38px;
    line-height: 0.95;
    font-weight: 950;
    letter-spacing: -1.2px;
  }

  .history-subtitle {
    margin: 8px 0 0;
    font-size: 17px;
    line-height: 1.25;
    color: #5b6472;
    font-weight: 700;
  }

  .history-eyebrow {
    margin: 0 0 5px;
    font-size: 12px;
    line-height: 1;
    font-weight: 950;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.09em;
  }

  .history-home-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 46px;
    padding: 0 18px;
    border-radius: 999px;
    background: #111827;
    color: #ffffff;
    text-decoration: none;
    font-size: 16px;
    font-weight: 900;
    box-shadow: 0 8px 20px rgba(17, 24, 39, 0.16);
    flex-shrink: 0;
  }

  .history-entry-card,
  .history-empty-card,
  .history-transaction-card {
    background: #ffffff;
    border: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  }

  .history-entry-card {
    position: sticky;
    top: 0;
    z-index: 5;
    max-width: 800px;
    margin: 0 auto 16px;
    padding: 15px;
    border-radius: 24px;
  }

  .history-section-title-row,
  .history-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .history-section-title-row h2,
  .history-list-header h2 {
    margin: 0;
    font-size: 25px;
    line-height: 1.05;
    font-weight: 950;
    letter-spacing: -0.5px;
  }

  .history-form {
    display: grid;
    grid-template-columns: 1fr;
    gap: 11px;
    margin-top: 13px;
  }

  .history-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
  }

  .history-field span {
    font-size: 15px;
    font-weight: 900;
    color: #334155;
  }

  .history-field input,
  .history-field select {
    width: 100%;
    min-height: 54px;
    border: 1px solid #d7dde6;
    border-radius: 16px;
    background: #f8fafc;
    color: #111827;
    padding: 0 14px;
    box-sizing: border-box;
    font-size: 18px;
    font-weight: 800;
    outline: none;
  }

  .history-field input:focus,
  .history-field select:focus {
    border-color: #111827;
    background: #ffffff;
    box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.08);
  }

  .history-transfer-box {
    display: grid;
    grid-template-columns: 1fr;
    gap: 11px;
    padding: 13px;
    border-radius: 20px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }

  .history-transfer-box h3 {
    margin: 0;
    font-size: 19px;
    font-weight: 950;
    color: #0f172a;
  }

  .history-form-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 2px;
  }

  .history-primary-button,
  .history-secondary-button,
  .history-transaction-actions button {
    border: 0;
    border-radius: 16px;
    min-height: 56px;
    padding: 0 16px;
    font-size: 18px;
    font-weight: 950;
    cursor: pointer;
  }

  .history-primary-button {
    background: #16a34a;
    color: #ffffff;
    box-shadow: 0 10px 20px rgba(22, 163, 74, 0.18);
  }

  .history-secondary-button {
    background: #e2e8f0;
    color: #111827;
  }

  .history-list {
    max-width: 800px;
    margin: 0 auto;
  }

  .history-list-header {
    padding: 3px 2px 11px;
  }

  .history-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 42px;
    height: 42px;
    padding: 0 12px;
    border-radius: 999px;
    background: #e2e8f0;
    color: #111827;
    font-size: 18px;
    font-weight: 950;
  }

  .history-card-stack {
    display: grid;
    gap: 11px;
  }

  .history-empty-card {
    border-radius: 22px;
    padding: 18px;
  }

  .history-empty-card strong {
    display: block;
    font-size: 21px;
    font-weight: 950;
    margin-bottom: 6px;
  }

  .history-empty-card p {
    margin: 0;
    color: #64748b;
    font-size: 16px;
    line-height: 1.35;
    font-weight: 700;
  }

  .history-transaction-card {
    border-radius: 24px;
    padding: 15px;
  }

  .history-transaction-main {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .history-transaction-left {
    min-width: 0;
  }

  .history-type-pill {
    display: inline-flex;
    align-items: center;
    min-height: 29px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .history-type-paycheck {
    background: #dcfce7;
    color: #166534;
  }

  .history-type-deposit {
    background: #e0f2fe;
    color: #075985;
  }

  .history-type-expense {
    background: #fee2e2;
    color: #991b1b;
  }

  .history-type-transfer {
    background: #ede9fe;
    color: #5b21b6;
  }

  .history-transaction-card h3 {
    margin: 9px 0 6px;
    font-size: 20px;
    line-height: 1.2;
    font-weight: 950;
    color: #0f172a;
    word-break: break-word;
  }

  .history-transaction-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .history-transaction-meta span {
    display: inline-flex;
    align-items: center;
    min-height: 29px;
    padding: 0 10px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    font-size: 14px;
    font-weight: 800;
  }

  .history-amount {
    flex-shrink: 0;
    font-size: 21px;
    line-height: 1.1;
    font-weight: 950;
    letter-spacing: -0.5px;
    text-align: right;
    white-space: nowrap;
    margin-top: 2px;
  }

  .history-amount-positive {
    color: #15803d;
  }

  .history-amount-negative {
    color: #dc2626;
  }

  .history-amount-transfer {
    color: #4f46e5;
  }

  .history-transaction-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 14px;
  }

  .history-transaction-actions button {
    min-height: 49px;
    font-size: 16px;
    background: #f1f5f9;
    color: #111827;
  }

  .history-transaction-actions .history-danger-button {
    background: #fee2e2;
    color: #991b1b;
  }

  .history-loading {
    max-width: 800px;
    margin: 40px auto;
    font-size: 20px;
    font-weight: 850;
    color: #475569;
  }

  @media (max-width: 420px) {
    .history-page {
      padding-left: 10px;
      padding-right: 10px;
    }

    .history-header h1 {
      font-size: 34px;
    }

    .history-subtitle {
      font-size: 16px;
    }

    .history-home-button {
      min-height: 44px;
      padding: 0 15px;
    }

    .history-entry-card {
      padding: 13px;
      border-radius: 22px;
    }

    .history-amount {
      font-size: 19px;
    }

    .history-transaction-main {
      gap: 9px;
    }
  }

  @media (min-width: 700px) {
    .history-page {
      padding: 28px 20px 46px;
    }

    .history-header {
      margin-bottom: 20px;
    }

    .history-header h1 {
      font-size: 44px;
    }

    .history-entry-card {
      padding: 20px;
      top: 12px;
    }

    .history-form {
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .history-field-full,
    .history-transfer-box,
    .history-form-actions {
      grid-column: 1 / -1;
    }

    .history-form-actions {
      grid-template-columns: 1fr 1fr;
    }

    .history-transaction-card {
      padding: 18px;
    }

    .history-transaction-card h3 {
      font-size: 22px;
    }

    .history-amount {
      font-size: 24px;
    }
  }
`;