import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData, saveData, updateData } from "../services/storage";

const BUCKETS = {
  Bills: [
    "Mortgage",
    "Natural Gas",
    "Hydro",
    "House Insurance",
    "Property Tax",
    "Car Insurance",
    "Internet",
    "Phone",
    "Bank Fee",
    "Netflix",
    "Bills Buffer",
  ],
  Savings: ["Emergency", "Holiday", "Home"],
  Giving: ["Church"],
  Spending: ["Family", "Wife", "Me", "Kids"],
};

const EMPTY_FORM = {
  type: "Paycheck",
  amount: "",
  bucket: "Bills",
  subBucket: "Mortgage",
  fromBucket: "Bills",
  fromSubBucket: "Mortgage",
  toBucket: "Savings",
  toSubBucket: "Emergency",
  date: new Date().toISOString().slice(0, 10),
  note: "",
};

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
    date: transaction.date || new Date().toISOString().slice(0, 10),
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
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const loadedData = loadData();
    const normalizedData = {
      ...loadedData,
      transactions: normalizeTransactions(loadedData),
    };

    setData(normalizedData);
    saveData(normalizedData);
  }, []);

  const transactions = useMemo(() => {
    return normalizeTransactions(data).sort((a, b) => {
      const dateCompare = new Date(b.date) - new Date(a.date);

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [data]);

  function updateForm(field, value) {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      if (field === "bucket") {
        next.subBucket = BUCKETS[value]?.[0] || "";
      }

      if (field === "fromBucket") {
        next.fromSubBucket = BUCKETS[value]?.[0] || "";
      }

      if (field === "toBucket") {
        next.toSubBucket = BUCKETS[value]?.[0] || "";
      }

      return next;
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      date: new Date().toISOString().slice(0, 10),
    });
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
      bucket: transaction.bucket || "Bills",
      subBucket: transaction.subBucket || "Mortgage",
      fromBucket: transaction.fromBucket || "Bills",
      fromSubBucket: transaction.fromSubBucket || "Mortgage",
      toBucket: transaction.toBucket || "Savings",
      toSubBucket: transaction.toSubBucket || "Emergency",
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
      return "amount negative";
    }

    if (transaction.type === "Transfer") {
      return "amount neutral";
    }

    return "amount positive";
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
      <main className="page">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>History</h1>
          <p>Transactions are the source of truth.</p>
        </div>

        <Link className="home-button" to="/">
          Home
        </Link>
      </header>

      <section className="card">
        <h2>{editingId ? "Edit Transaction" : "Add Transaction"}</h2>

        <form className="transaction-form" onSubmit={saveTransaction}>
          <label>
            Type
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
            Amount
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

          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(event) => updateForm("date", event.target.value)}
            />
          </label>

          {(form.type === "Expense" || form.type === "Deposit") && (
            <>
              <label>
                Bucket
                <select
                  value={form.bucket}
                  onChange={(event) => updateForm("bucket", event.target.value)}
                >
                  {Object.keys(BUCKETS).map((bucket) => (
                    <option key={bucket} value={bucket}>
                      {bucket}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Sub-bucket
                <select
                  value={form.subBucket}
                  onChange={(event) =>
                    updateForm("subBucket", event.target.value)
                  }
                >
                  {(BUCKETS[form.bucket] || []).map((subBucket) => (
                    <option key={subBucket} value={subBucket}>
                      {subBucket}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {form.type === "Transfer" && (
            <>
              <div className="transfer-group">
                <h3>From</h3>

                <label>
                  Bucket
                  <select
                    value={form.fromBucket}
                    onChange={(event) =>
                      updateForm("fromBucket", event.target.value)
                    }
                  >
                    {Object.keys(BUCKETS).map((bucket) => (
                      <option key={bucket} value={bucket}>
                        {bucket}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Sub-bucket
                  <select
                    value={form.fromSubBucket}
                    onChange={(event) =>
                      updateForm("fromSubBucket", event.target.value)
                    }
                  >
                    {(BUCKETS[form.fromBucket] || []).map((subBucket) => (
                      <option key={subBucket} value={subBucket}>
                        {subBucket}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="transfer-group">
                <h3>To</h3>

                <label>
                  Bucket
                  <select
                    value={form.toBucket}
                    onChange={(event) =>
                      updateForm("toBucket", event.target.value)
                    }
                  >
                    {Object.keys(BUCKETS).map((bucket) => (
                      <option key={bucket} value={bucket}>
                        {bucket}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Sub-bucket
                  <select
                    value={form.toSubBucket}
                    onChange={(event) =>
                      updateForm("toSubBucket", event.target.value)
                    }
                  >
                    {(BUCKETS[form.toBucket] || []).map((subBucket) => (
                      <option key={subBucket} value={subBucket}>
                        {subBucket}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}

          <label>
            Note
            <input
              type="text"
              value={form.note}
              onChange={(event) => updateForm("note", event.target.value)}
              placeholder="Optional note"
            />
          </label>

          <div className="form-actions">
            <button type="submit">
              {editingId ? "Save Changes" : "Add Transaction"}
            </button>

            {editingId && (
              <button type="button" className="secondary" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="history-list">
        <h2>Transaction History</h2>

        {transactions.length === 0 ? (
          <div className="card empty-card">
            <p>No transactions yet.</p>
          </div>
        ) : (
          transactions.map((transaction) => (
            <article key={transaction.id} className="transaction-card">
              <div className="transaction-top">
                <div>
                  <strong>{transaction.type}</strong>
                  <p>{transactionTitle(transaction)}</p>
                </div>

                <span className={transactionAmountClass(transaction)}>
                  {transactionAmountPrefix(transaction)}
                  {formatMoney(transaction.amount)}
                </span>
              </div>

              <div className="transaction-meta">
                <span>{transaction.date}</span>
                {transaction.note && <span>{transaction.note}</span>}
              </div>

              <div className="transaction-actions">
                <button
                  type="button"
                  onClick={() => editTransaction(transaction)}
                >
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
          ))
        )}
      </section>
    </main>
  );
}