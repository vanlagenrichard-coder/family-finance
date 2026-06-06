import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData } from "../services/storage";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));
}

function getTransactions(data) {
  return Array.isArray(data?.transactions) ? data.transactions : [];
}

function getSetup(data) {
  if (Array.isArray(data?.setupBuckets)) return data.setupBuckets;
  if (Array.isArray(data?.buckets)) return data.buckets;
  if (Array.isArray(data?.settings?.setup)) return data.settings.setup;
  if (Array.isArray(data?.setup)) return data.setup;
  return [];
}

function getSubBuckets(bucket) {
  if (Array.isArray(bucket?.subBuckets)) return bucket.subBuckets;
  if (Array.isArray(bucket?.subcategories)) return bucket.subcategories;
  if (Array.isArray(bucket?.children)) return bucket.children;
  if (Array.isArray(bucket?.items)) return bucket.items;
  return [];
}

function isActive(item) {
  return item?.archived !== true;
}

function normalizeBuckets(data) {
  return getSetup(data)
    .filter(isActive)
    .map((bucket) => ({
      id: bucket.id || bucket.name,
      name: bucket.name || "",
      percent: Number(bucket.percent || 0),
      subBuckets: getSubBuckets(bucket)
        .filter(isActive)
        .map((subBucket) => ({
          id: subBucket.id || subBucket.name,
          name: subBucket.name || "",
          percent: Number(subBucket.percent || 0),
          targetAmount: Number(
            subBucket.monthlyTarget ?? subBucket.targetAmount ?? 0
          ),
        })),
    }));
}

function calculateBalances(transactions) {
  const balances = {};

  function ensure(bucketName, subBucketName) {
    if (!bucketName) return;

    if (!balances[bucketName]) {
      balances[bucketName] = {
        total: 0,
        subBuckets: {},
      };
    }

    if (
      subBucketName &&
      balances[bucketName].subBuckets[subBucketName] === undefined
    ) {
      balances[bucketName].subBuckets[subBucketName] = 0;
    }
  }

  function add(bucketName, subBucketName, amount) {
    if (!bucketName || !subBucketName) return;

    const value = Number(amount || 0);

    ensure(bucketName, subBucketName);

    balances[bucketName].subBuckets[subBucketName] += value;
  }

  transactions.forEach((transaction) => {
    const amount = Number(transaction.amount || 0);

    if (transaction.type === "Paycheck") {
      if (Array.isArray(transaction.allocations)) {
        transaction.allocations.forEach((allocation) => {
          add(
            allocation.bucket,
            allocation.subBucket,
            Math.abs(Number(allocation.amount || 0))
          );
        });
      }

      return;
    }

    if (transaction.type === "Deposit") {
      add(transaction.bucket, transaction.subBucket, Math.abs(amount));
      return;
    }

    if (transaction.type === "Expense") {
      add(transaction.bucket, transaction.subBucket, -Math.abs(amount));
      return;
    }

    if (transaction.type === "Transfer") {
      add(transaction.fromBucket, transaction.fromSubBucket, -Math.abs(amount));
      add(transaction.toBucket, transaction.toSubBucket, Math.abs(amount));
    }
  });

  Object.keys(balances).forEach((bucketName) => {
    balances[bucketName].total = Object.values(
      balances[bucketName].subBuckets
    ).reduce((sum, value) => sum + Number(value || 0), 0);
  });

  return balances;
}

function isBillsBucket(bucket) {
  return String(bucket?.name || "").trim().toLowerCase() === "bills";
}

function isBillsExtraSubBucket(subBucket) {
  const name = String(subBucket?.name || "").trim().toLowerCase();
  return name === "bills extra" || name === "extra";
}

function applyBillsExtraLogic(bucket, balances) {
  const rawSubBalances = balances?.[bucket.name]?.subBuckets || {};

  if (!isBillsBucket(bucket)) {
    const subBuckets = bucket.subBuckets.map((subBucket) => ({
      ...subBucket,
      displayAmount: Number(rawSubBalances?.[subBucket.name] || 0),
    }));

    const total = subBuckets.reduce(
      (sum, subBucket) => sum + Number(subBucket.displayAmount || 0),
      0
    );

    return {
      ...bucket,
      subBuckets,
      total,
    };
  }

  const regularBills = bucket.subBuckets.filter(
    (subBucket) => !isBillsExtraSubBucket(subBucket)
  );

  const existingExtra = bucket.subBuckets.find(isBillsExtraSubBucket);

  let billsExtraAmount = existingExtra
    ? Number(rawSubBalances?.[existingExtra.name] || 0)
    : 0;

  const cappedBills = regularBills.map((subBucket) => {
    const rawAmount = Number(rawSubBalances?.[subBucket.name] || 0);
    const targetAmount = Number(subBucket.targetAmount || 0);

    if (targetAmount > 0 && rawAmount > targetAmount) {
      billsExtraAmount += rawAmount - targetAmount;

      return {
        ...subBucket,
        displayAmount: targetAmount,
      };
    }

    return {
      ...subBucket,
      displayAmount: rawAmount,
    };
  });

  const filledBills = cappedBills.map((subBucket) => {
    const targetAmount = Number(subBucket.targetAmount || 0);
    const currentAmount = Number(subBucket.displayAmount || 0);

    if (
      targetAmount <= 0 ||
      currentAmount >= targetAmount ||
      billsExtraAmount <= 0
    ) {
      return subBucket;
    }

    const needed = targetAmount - currentAmount;
    const amountToUse = Math.min(needed, billsExtraAmount);

    billsExtraAmount -= amountToUse;

    return {
      ...subBucket,
      displayAmount: currentAmount + amountToUse,
    };
  });

  const billsExtraSubBucket = {
    id: existingExtra?.id || "virtual-bills-extra",
    name: existingExtra?.name || "Bills Extra",
    percent: Number(existingExtra?.percent || 0),
    targetAmount: Number(existingExtra?.targetAmount || 0),
    displayAmount: billsExtraAmount,
  };

  const subBuckets = [...filledBills, billsExtraSubBucket];

  const total = subBuckets.reduce(
    (sum, subBucket) => sum + Number(subBucket.displayAmount || 0),
    0
  );

  return {
    ...bucket,
    subBuckets,
    total,
  };
}

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    function refresh() {
      setRefreshKey((value) => value + 1);
    }

    refresh();

    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("app-data-updated", refresh);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("app-data-updated", refresh);
    };
  }, []);

  const freshData = loadData();

  const transactions = useMemo(() => {
    return getTransactions(freshData);
  }, [freshData, refreshKey]);

  const buckets = useMemo(() => {
    return normalizeBuckets(freshData);
  }, [freshData, refreshKey]);

  const balances = useMemo(() => {
    return calculateBalances(transactions);
  }, [transactions]);

  const displayBuckets = useMemo(() => {
    return buckets.map((bucket) => applyBillsExtraLogic(bucket, balances));
  }, [buckets, balances]);

  const rows = useMemo(() => {
    const bucketRows = displayBuckets.flatMap((bucket) => {
      const subRows = bucket.subBuckets.map((subBucket) => ({
        section: "",
        item: subBucket.name,
        amount: Number(subBucket.displayAmount || 0),
        type: "sub",
      }));

      return [
        {
          section: bucket.name.toUpperCase(),
          item: `${bucket.name} Total`,
          amount: Number(bucket.total || 0),
          type: "bucket",
        },
        ...subRows,
      ];
    });

    const totalMoney = displayBuckets.reduce(
      (sum, bucket) => sum + Number(bucket.total || 0),
      0
    );

    return [
      {
        section: "TOTAL",
        item: "Total Money",
        amount: totalMoney,
        type: "total",
      },
      ...bucketRows,
    ];
  }, [displayBuckets]);

  return (
    <div className="dashboard-page">
      <header className="header">
        <Link to="/" className="home-button">
          Home
        </Link>

        <div>
          <h1>Balances</h1>
          <p>Live calculated balances</p>
        </div>
      </header>

      <main className="sheet-card">
        <div className="sheet-header">
          <div>SECTION</div>
          <div>ITEM</div>
          <div>AMOUNT</div>
        </div>

        <div className="sheet-body">
          {rows.map((row, index) => (
            <div
              key={`${row.section}-${row.item}-${index}`}
              className={`sheet-row ${row.type}`}
            >
              <div className="section-cell">{row.section}</div>

              <div className="item-cell">{row.item}</div>

              <div className={row.amount < 0 ? "amount negative" : "amount"}>
                {formatCurrency(row.amount)}
              </div>
            </div>
          ))}
        </div>
      </main>

      <style>{`
        .dashboard-page {
          min-height: 100vh;
          background: #f3f4f6;
          padding: 16px;
          color: #111827;
        }

        .header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .header h1 {
          margin: 0;
          font-size: 30px;
        }

        .header p {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .home-button {
          height: 44px;
          padding: 0 16px;
          border-radius: 14px;
          background: #111827;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          font-weight: 700;
        }

        .sheet-card {
          background: white;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          border: 1px solid #e5e7eb;
        }

        .sheet-header,
        .sheet-row {
          display: grid;
          grid-template-columns: 1fr 1.5fr 1fr;
          align-items: center;
        }

        .sheet-header {
          background: #111827;
          color: white;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .sheet-header div {
          padding: 12px;
        }

        .sheet-row {
          border-bottom: 1px solid #e5e7eb;
        }

        .sheet-row:last-child {
          border-bottom: 0;
        }

        .sheet-row div {
          padding: 14px 12px;
          min-width: 0;
        }

        .sheet-row.total {
          background: #f9fafb;
          font-weight: 900;
          font-size: 17px;
        }

        .sheet-row.bucket {
          background: #f3f4f6;
          font-weight: 800;
        }

        .sheet-row.sub {
          background: white;
        }

        .section-cell {
          font-size: 12px;
          font-weight: 900;
          color: #374151;
          letter-spacing: 0.04em;
        }

        .item-cell {
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .sheet-row.sub .item-cell {
          font-weight: 600;
          color: #374151;
        }

        .amount {
          text-align: right;
          font-weight: 900;
          white-space: nowrap;
          color: #166534;
        }

        .negative {
          color: #dc2626;
        }

        @media (max-width: 520px) {
          .dashboard-page {
            padding: 12px;
          }

          .header h1 {
            font-size: 26px;
          }

          .sheet-header,
          .sheet-row {
            grid-template-columns: 0.8fr 1.3fr 1fr;
          }

          .sheet-header div {
            padding: 10px 8px;
            font-size: 10px;
          }

          .sheet-row div {
            padding: 12px 8px;
            font-size: 13px;
          }

          .sheet-row.total {
            font-size: 14px;
          }

          .amount {
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}