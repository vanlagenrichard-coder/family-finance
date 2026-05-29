import React, { useEffect, useMemo, useState } from "react";

function History() {
  const [data, setData] = useState(() => {
    const savedData = localStorage.getItem("budgetData");
    return savedData ? JSON.parse(savedData) : {};
  });

  const [transactions, setTransactions] = useState(() => {
    return Array.isArray(data.transactions) ? data.transactions : [];
  });

  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    type: "Expense",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    note: "",
    bucket: "",
    subBucket: "",
    fromBucket: "",
    fromSubBucket: "",
    toBucket: "",
    toSubBucket: "",
  });

  const setupBuckets = useMemo(() => {
    const buckets =
      data.setupBuckets ||
      data.buckets ||
      data.settings?.setup ||
      data.setup ||
      [];

    return Array.isArray(buckets) ? buckets : [];
  }, [data]);

  const activeBuckets = useMemo(() => {
    return setupBuckets.filter((bucket) => !bucket.archived);
  }, [setupBuckets]);

  useEffect(() => {
    const updatedData = {
      ...data,
      transactions,
    };

    setData(updatedData);
    localStorage.setItem("budgetData", JSON.stringify(updatedData));
  }, [transactions]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
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
      const allocations = [];

      activeBuckets.forEach((bucket) => {
        const bucketPercent = Number(bucket.percent || 0);
        const bucketAmount = amount * (bucketPercent / 100);

        const activeSubBuckets = Array.isArray(bucket.subBuckets)
          ? bucket.subBuckets.filter((subBucket) => !subBucket.archived)
          : [];

        if (activeSubBuckets.length > 0) {
          activeSubBuckets.forEach((subBucket) => {
            const subPercent = Number(subBucket.percent || 0);
            const subAmount = bucketAmount * (subPercent / 100);

            allocations.push({
              bucket: bucket.name,
              subBucket: subBucket.name,
              amount: Number(subAmount.toFixed(2)),
            });
          });
        } else {
          allocations.push({
            bucket: bucket.name,
            subBucket: "",
            amount: Number(bucketAmount.toFixed(2)),
          });
        }
      });

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

  function handleSubmit(event) {
    event.preventDefault();

    const transaction = buildTransaction();

    if (!transaction) return;

    if (editingId) {
      setTransactions((currentTransactions) =>
        currentTransactions.map((currentTransaction) =>
          currentTransaction.id === editingId ? transaction : currentTransaction
        )
      );
    } else {
      setTransactions((currentTransactions) => [
        transaction,
        ...currentTransactions,
      ]);
    }

    setEditingId(null);

    setForm({
      type: "Expense",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      note: "",
      bucket: "",
      subBucket: "",
      fromBucket: "",
      fromSubBucket: "",
      toBucket: "",
      toSubBucket: "",
    });
  }

  return (
    <div>
      <h1>History</h1>

      <form onSubmit={handleSubmit}>
        <select name="type" value={form.type} onChange={handleChange}>
          <option value="Expense">Expense</option>
          <option value="Deposit">Deposit</option>
          <option value="Transfer">Transfer</option>
          <option value="Paycheck">Paycheck</option>
        </select>

        <input
          name="amount"
          type="number"
          value={form.amount}
          onChange={handleChange}
          placeholder="Amount"
        />

        <input
          name="date"
          type="date"
          value={form.date}
          onChange={handleChange}
        />

        <input
          name="note"
          value={form.note}
          onChange={handleChange}
          placeholder="Note"
        />

        <button type="submit">
          {editingId ? "Update Transaction" : "Add Transaction"}
        </button>
      </form>

      <div>
        {transactions.map((transaction) => (
          <div key={transaction.id}>
            <strong>{transaction.type}</strong> - ${transaction.amount}
          </div>
        ))}
      </div>
    </div>
  );
}

export default History;