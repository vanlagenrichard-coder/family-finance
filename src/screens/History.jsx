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

function getSetupBuckets(data) {
  if (Array.isArray(data?.setupBuckets)) return data.setupBuckets;
  if (Array.isArray(data?.buckets)) return data.buckets;

  const setup = data?.settings?.setup || data?.setup || {};

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
      percent: Number(bucket.percent || bucket.percentage || 0),
      subBuckets: Array.isArray(bucket.subBuckets)
        ? bucket.subBuckets
            .filter((subBucket) => !isArchived(subBucket))
            .map((subBucket) => ({
              id: subBucket.id || subBucket.name || makeId(),
              name: cleanText(subBucket.name || subBucket.label || subBucket.id),
              percent: Number(subBucket.percent || subBucket.percentage || 0),
            }))
            .filter((subBucket) => subBucket.name)
        : [],
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

function History() {
  const [data, setData] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() =>
    createEmptyForm(DEFAULT_SETUP_BUCKETS)
  );

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
    setForm(createEmptyForm(buckets));
    saveData(normalizedData);
  }, []);

  useEffect(() => {
    if (!activeBuckets.length) return;

    setForm((current) => {
      const bucket = activeBuckets.some((item) => item.name === current.bucket)
        ? current.bucket
        : firstBucketName(activeBuckets);

      const fromBucket = activeBuckets.some(
        (item) => item.name === current.fromBucket
      )
        ? current.fromBucket
        : firstBucketName(activeBuckets);

      const toBucket = activeBuckets.some((item) => item.name === current.toBucket)
        ? current.toBucket
        : activeBuckets[1]?.name || firstBucketName(activeBuckets);

      const subBucket =
        getSubBucketsForBucket(activeBuckets, bucket).some(
          (item) => item.name === current.subBucket
        )
          ? current.subBucket
          : firstSubBucketName(activeBuckets, bucket);

      const fromSubBucket =
        getSubBucketsForBucket(activeBuckets, fromBucket).some(
          (item) => item.name === current.fromSubBucket
        )
          ? current.fromSubBucket
          : firstSubBucketName(activeBuckets, fromBucket);

      const toSubBucket =
        getSubBucketsForBucket(activeBuckets, toBucket).some(
          (item) => item.name === current.toSubBucket
        )
          ? current.toSubBucket
          : firstSubBucketName(activeBuckets, toBucket);

      return {
        ...current,
        bucket,
        subBucket,
        fromBucket,
        fromSubBucket,
        toBucket,
        toSubBucket,
      };
    });
  }, [activeBuckets]);

  function getSubBuckets(bucketName) {
    return getSubBucketsForBucket(activeBuckets, bucketName);
  }

  function updateForm(field, value) {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      };

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
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm(activeBuckets));
  }

  function buildPaycheckAllocations(amount) {
    const allocations = [];

    activeBuckets.forEach((bucket) => {
      const bucketPercent = Number(bucket.percent || 0);
      const bucketAmount =
        bucketPercent > 0 ? amount * (bucketPercent / 100) : amount;

      if (Array.isArray(bucket.subBuckets) && bucket.subBuckets.length > 0) {
        bucket.subBuckets.forEach((subBucket) => {
          const subPercent = Number(subBucket.percent || 0);
          const subAmount = bucketAmount * (subPercent / 100);

          if (subAmount > 0) {
            allocations.push({
              bucket: bucket.name,
              subBucket: subBucket.name,
              amount: Number(subAmount.toFixed(2)),
            });
          }
        });
      } else if (bucketPercent > 0) {
        allocations.push({
          bucket: bucket.name,
          subBucket: "",
          amount: Number(bucketAmount.toFixed(2)),
        });
      }
    });

    return allocations;
  }

  function buildTransaction() {
    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      alert("Enter a valid amount.");
      return null;
    }

    const now = new Date().toISOString();

    const baseTransaction = {
      id: editingId || makeId(),
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
        allocations: buildPaycheckAllocations(amount),
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
        allocations: [],
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
      allocations: [],
    };
  }

  function saveTransaction(event) {
    event.preventDefault();

    if (!data) return;

    const transaction = buildTransaction();
    if (!transaction) return;

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
      date: transaction.date,
      bucket: transaction.bucket || firstBucketName(activeBuckets),
      subBucket:
        transaction.subBucket ||
        firstSubBucketName(activeBuckets, firstBucketName(activeBuckets)),
      fromBucket: transaction.fromBucket || firstBucketName(activeBuckets),
      fromSubBucket:
        transaction.fromSubBucket ||
        firstSubBucketName(activeBuckets, firstBucketName(activeBuckets)),
      toBucket:
        transaction.toBucket ||
        activeBuckets[1]?.name ||
        firstBucketName(activeBuckets),
      toSubBucket:
        transaction.toSubBucket ||
        firstSubBucketName(
          activeBuckets,
          activeBuckets[1]?.name || firstBucketName(activeBuckets)
        ),
      note: transaction.note || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteTransaction(id) {
    if (!window.confirm("Delete this transaction?")) return;
    if (!data) return;

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

    if (editingId === id) resetForm();
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

  function amountClass(transaction) {
    if (transaction.type === "Expense") return "history-amount negative";
    if (transaction.type === "Transfer") return "history-amount transfer";
    return "history-amount positive";
  }

  function amountPrefix(transaction) {
    if (transaction.type === "Expense") return "-";
    if (transaction.type === "Transfer") return "";
    return "+";
  }

  if (!data) {
    return (
      <main className="history-page">
        <style>{historyStyles}</style>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="history-page">
      <style>{historyStyles}</style>

      <header className="history-header">
        <div>
          <p className="eyebrow">Family Finance</p>
          <h1>History</h1>
          <p className="subtitle">Add paychecks, expenses, deposits, and transfers.</p>
        </div>

        <Link className="home-button" to="/">
          Home
        </Link>
      </header>

      <section className="card">
        <div className="section-title">
          <div>
            <p className="eyebrow">Fast Entry</p>
            <h2>{editingId ? "Edit Transaction" : "Add Transaction"}</h2>
          </div>
        </div>

        <form className="history-form" onSubmit={saveTransaction}>
          <label>
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

          <label>
            <span>Amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => updateForm("amount", event.target.value)}
              placeholder="0.00"
            />
          </label>

          <label>
            <span>Date</span>
            <input
              type="date"
              value={form.date}
              onChange={(event) => updateForm("date", event.target.value)}
            />
          </label>

          {(form.type === "Expense" || form.type === "Deposit") && (
            <>
              <label>
                <span>Bucket</span>
                <select
                  value={form.bucket}
                  onChange={(event) => updateForm("bucket", event.target.value)}
                >
                  {activeBuckets.map((bucket) => (
                    <option key={bucket.id} value={bucket.name}>
                      {bucket.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Sub-bucket</span>
                <select
                  value={form.subBucket}
                  onChange={(event) =>
                    updateForm("subBucket", event.target.value)
                  }
                >
                  {getSubBuckets(form.bucket).map((subBucket) => (
                    <option key={subBucket.id} value={subBucket.name}>
                      {subBucket.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {form.type === "Transfer" && (
            <>
              <div className="transfer-box">
                <h3>From</h3>

                <label>
                  <span>Bucket</span>
                  <select
                    value={form.fromBucket}
                    onChange={(event) =>
                      updateForm("fromBucket", event.target.value)
                    }
                  >
                    {activeBuckets.map((bucket) => (
                      <option key={bucket.id} value={bucket.name}>
                        {bucket.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Sub-bucket</span>
                  <select
                    value={form.fromSubBucket}
                    onChange={(event) =>
                      updateForm("fromSubBucket", event.target.value)
                    }
                  >
                    {getSubBuckets(form.fromBucket).map((subBucket) => (
                      <option key={subBucket.id} value={subBucket.name}>
                        {subBucket.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="transfer-box">
                <h3>To</h3>

                <label>
                  <span>Bucket</span>
                  <select
                    value={form.toBucket}
                    onChange={(event) =>
                      updateForm("toBucket", event.target.value)
                    }
                  >
                    {activeBuckets.map((bucket) => (
                      <option key={bucket.id} value={bucket.name}>
                        {bucket.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Sub-bucket</span>
                  <select
                    value={form.toSubBucket}
                    onChange={(event) =>
                      updateForm("toSubBucket", event.target.value)
                    }
                  >
                    {getSubBuckets(form.toBucket).map((subBucket) => (
                      <option key={subBucket.id} value={subBucket.name}>
                        {subBucket.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}

          <label className="full">
            <span>Note</span>
            <input
              type="text"
              value={form.note}
              onChange={(event) => updateForm("note", event.target.value)}
              placeholder="Optional note"
            />
          </label>

          <div className="actions">
            <button className="primary" type="submit">
              {editingId ? "Save Changes" : "Add Transaction"}
            </button>

            {editingId && (
              <button className="secondary" type="button" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="history-list">
        <div className="list-header">
          <div>
            <p className="eyebrow">Ledger</p>
            <h2>Transaction History</h2>
          </div>

          <strong>{transactions.length}</strong>
        </div>

        {transactions.length === 0 ? (
          <div className="empty-card">
            <h3>No transactions yet.</h3>
            <p>Add your first item above.</p>
          </div>
        ) : (
          <div className="transaction-stack">
            {transactions.map((transaction) => (
              <article className="transaction-card" key={transaction.id}>
                <div className="transaction-main">
                  <div>
                    <span className={`type-pill ${transaction.type.toLowerCase()}`}>
                      {transaction.type}
                    </span>

                    <h3>{transactionTitle(transaction)}</h3>

                    <p>
                      {transaction.date}
                      {transaction.note ? ` • ${transaction.note}` : ""}
                    </p>
                  </div>

                  <strong className={amountClass(transaction)}>
                    {amountPrefix(transaction)}
                    {formatMoney(transaction.amount)}
                  </strong>
                </div>

                <div className="transaction-actions">
                  <button type="button" onClick={() => editTransaction(transaction)}>
                    Edit
                  </button>

                  <button
                    type="button"
                    className="danger"
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

function getSubBucketsForBucket(buckets, bucketName) {
  return buckets.find((bucket) => bucket.name === bucketName)?.subBuckets || [];
}

const historyStyles = `
  .history-page {
    min-height: 100vh;
    background: #f4f6f8;
    color: #111827;
    padding: 16px 12px 36px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .history-header,
  .card,
  .history-list {
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }

  .history-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .eyebrow {
    margin: 0 0 5px;
    color: #64748b;
    font-size: 12px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: 0.09em;
  }

  h1 {
    margin: 0;
    font-size: 38px;
    line-height: 0.95;
    font-weight: 950;
    letter-spacing: -1.2px;
  }

  h2 {
    margin: 0;
    font-size: 25px;
    font-weight: 950;
  }

  .subtitle {
    margin: 8px 0 0;
    color: #5b6472;
    font-size: 16px;
    font-weight: 700;
  }

  .home-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 46px;
    padding: 0 18px;
    border-radius: 999px;
    background: #111827;
    color: white;
    text-decoration: none;
    font-weight: 900;
  }

  .card,
  .empty-card,
  .transaction-card {
    background: white;
    border: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  }

  .card {
    position: sticky;
    top: 0;
    z-index: 5;
    padding: 15px;
    border-radius: 24px;
    margin-bottom: 16px;
  }

  .history-form {
    display: grid;
    grid-template-columns: 1fr;
    gap: 11px;
    margin-top: 13px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
  }

  label span {
    font-size: 15px;
    font-weight: 900;
    color: #334155;
  }

  input,
  select {
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

  input:focus,
  select:focus {
    border-color: #111827;
    background: white;
    box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.08);
  }

  .transfer-box {
    display: grid;
    gap: 11px;
    padding: 13px;
    border-radius: 20px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }

  .transfer-box h3 {
    margin: 0;
    font-size: 19px;
    font-weight: 950;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  button {
    border: 0;
    border-radius: 16px;
    min-height: 52px;
    padding: 0 16px;
    font-size: 17px;
    font-weight: 950;
    cursor: pointer;
  }

  .primary {
    background: #16a34a;
    color: white;
  }

  .secondary {
    background: #e2e8f0;
    color: #111827;
  }

  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 11px;
  }

  .list-header strong {
    min-width: 42px;
    height: 42px;
    border-radius: 999px;
    background: #e2e8f0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .empty-card,
  .transaction-card {
    border-radius: 24px;
    padding: 16px;
  }

  .empty-card h3 {
    margin: 0 0 6px;
    font-size: 21px;
    font-weight: 950;
  }

  .empty-card p {
    margin: 0;
    color: #64748b;
    font-weight: 700;
  }

  .transaction-stack {
    display: grid;
    gap: 11px;
  }

  .transaction-main {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .transaction-card h3 {
    margin: 9px 0 6px;
    font-size: 20px;
    font-weight: 950;
  }

  .transaction-card p {
    margin: 0;
    color: #64748b;
    font-weight: 750;
  }

  .type-pill {
    display: inline-flex;
    min-height: 29px;
    align-items: center;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 950;
    text-transform: uppercase;
  }

  .paycheck {
    background: #dcfce7;
    color: #166534;
  }

  .deposit {
    background: #e0f2fe;
    color: #075985;
  }

  .expense {
    background: #fee2e2;
    color: #991b1b;
  }

  .transfer {
    background: #ede9fe;
    color: #5b21b6;
  }

  .history-amount {
    white-space: nowrap;
    font-size: 21px;
    font-weight: 950;
  }

  .positive {
    color: #15803d;
  }

  .negative {
    color: #dc2626;
  }

  .transfer.history-amount {
    color: #4f46e5;
    background: transparent;
  }

  .transaction-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 14px;
  }

  .transaction-actions button {
    background: #f1f5f9;
    color: #111827;
  }

  .transaction-actions .danger {
    background: #fee2e2;
    color: #991b1b;
  }

  @media (min-width: 700px) {
    .history-page {
      padding: 28px 20px 46px;
    }

    .history-form {
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .full,
    .transfer-box,
    .actions {
      grid-column: 1 / -1;
    }

    .actions {
      grid-template-columns: 1fr 1fr;
    }
  }
`;

export default History;