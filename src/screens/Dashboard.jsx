import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { watchFamilyTransactions } from "../firebase/transactionService";
import { watchFamilySetup } from "../firebase/setupService";

const STORAGE_KEY = "family_finance_app_data";

function loadDashboardData() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);

    if (!rawData) {
      return {};
    }

    return JSON.parse(rawData) || {};
  } catch {
    return {};
  }
}

function saveDashboardData(nextData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
  window.dispatchEvent(new Event("app-data-updated"));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));
}

function formatPercent(value) {
  const number = Number(value || 0);

  if (!number) return "";

  return `${number}%`;
}

function getSetup(data) {
  if (Array.isArray(data?.setupBuckets)) return data.setupBuckets;
  if (Array.isArray(data?.buckets)) return data.buckets;
  return [];
}

function getTransactions(data) {
  return Array.isArray(data?.transactions) ? data.transactions : [];
}

function getSubBuckets(bucket) {
  return Array.isArray(bucket?.subBuckets) ? bucket.subBuckets : [];
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
          monthlyTarget: Number(subBucket.monthlyTarget || 0),
        })),
    }));
}

function calculateTransactionBalances(transactions) {
  const balances = {};

  function ensure(bucketName, subBucketName) {
    if (!bucketName) return;

    if (!balances[bucketName]) {
      balances[bucketName] = {
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
            Number(allocation.amount || 0)
          );
        });
      }

      return;
    }

    if (transaction.type === "Deposit") {
      if (
        Array.isArray(transaction.allocations) &&
        transaction.allocations.length > 0
      ) {
        transaction.allocations.forEach((allocation) => {
          add(
            allocation.bucket,
            allocation.subBucket,
            Number(allocation.amount || 0)
          );
        });
      } else {
        add(transaction.bucket, transaction.subBucket, amount);
      }

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

  return balances;
}

function getSubBucketBalance(bucket, subBucket, balances) {
  return Number(balances?.[bucket.name]?.subBuckets?.[subBucket.name] || 0);
}

function getBucketBalance(bucket, balances) {
  return bucket.subBuckets.reduce((total, subBucket) => {
    return total + getSubBucketBalance(bucket, subBucket, balances);
  }, 0);
}

function getTotalMoney(buckets, balances) {
  return buckets.reduce((total, bucket) => {
    return total + getBucketBalance(bucket, balances);
  }, 0);
}

function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/history">History</NavLink>
      <NavLink to="/balances">Balances</NavLink>
      <NavLink to="/setup">Setup</NavLink>
      <NavLink to="/">Home</NavLink>
    </nav>
  );
}

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    function refresh() {
      setRefreshKey((current) => current + 1);
    }

    refresh();

    const familyId = localStorage.getItem("familyId");

    let unsubscribeTransactions = null;
    let unsubscribeSetup = null;

    if (familyId) {
      unsubscribeTransactions = watchFamilyTransactions(
        familyId,
        (transactions) => {
          const currentData = loadDashboardData();

          const nextData = {
            ...currentData,
            transactions,
          };

          saveDashboardData(nextData);
          refresh();
        }
      );

      unsubscribeSetup = watchFamilySetup(familyId, (familySetup) => {
        const currentData = loadDashboardData();

        const setupBuckets = Array.isArray(familySetup?.setupBuckets)
          ? familySetup.setupBuckets
          : [];

        const buckets = Array.isArray(familySetup?.buckets)
          ? familySetup.buckets
          : setupBuckets;

        const nextData = {
          ...currentData,
          setupBuckets,
          buckets,
        };

        saveDashboardData(nextData);
        refresh();
      });
    }

    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("app-data-updated", refresh);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("app-data-updated", refresh);

      if (unsubscribeTransactions) {
        unsubscribeTransactions();
      }

      if (unsubscribeSetup) {
        unsubscribeSetup();
      }
    };
  }, []);

  const data = useMemo(() => {
    return loadDashboardData();
  }, [refreshKey]);

  const buckets = useMemo(() => {
    return normalizeBuckets(data);
  }, [data]);

  const transactions = useMemo(() => {
    return getTransactions(data);
  }, [data]);

  const balances = useMemo(() => {
    return calculateTransactionBalances(transactions);
  }, [transactions]);

  const totalMoney = useMemo(() => {
    return getTotalMoney(buckets, balances);
  }, [buckets, balances]);

  const rows = useMemo(() => {
    const bucketRows = buckets.flatMap((bucket) => {
      const bucketBalance = getBucketBalance(bucket, balances);

      const subBucketRows = bucket.subBuckets.map((subBucket) => {
        const amount = getSubBucketBalance(bucket, subBucket, balances);
        const target = Number(subBucket.monthlyTarget || 0);

        return {
          type: "sub",
          section: bucket.name,
          item: subBucket.name,
          percent: formatPercent(subBucket.percent),
          target,
          amount,
        };
      });

      return [
        {
          type: "bucket",
          section: "Paycheck",
          item: bucket.name,
          percent: formatPercent(bucket.percent),
          target: 0,
          amount: bucketBalance,
        },
        ...subBucketRows,
      ];
    });

    return [
      {
        type: "total",
        section: "TOTAL",
        item: "Total Money",
        percent: "",
        target: 0,
        amount: totalMoney,
      },
      ...bucketRows,
    ];
  }, [buckets, balances, totalMoney]);

  return (
    <div className="dashboard-page">
      <header className="header">
        <div>
          <h1>Balances</h1>
          <p>Live calculated balances</p>
        </div>
      </header>

      <main className="sheet-card">
        <div className="sheet-header">
          <div>SECTION</div>
          <div>ITEM</div>
          <div>PERCENT</div>
          <div>TARGET</div>
          <div>AMOUNT</div>
        </div>

        <div className="sheet-body">
          {rows.map((row, index) => {
            const rowHasTarget = row.type === "sub" && Number(row.target || 0) > 0;
            const isComplete = rowHasTarget && row.amount >= row.target;

            return (
              <div
                key={`${row.type}-${row.section}-${row.item}-${index}`}
                className={`sheet-row ${row.type}`}
              >
                <div className="section-cell">{row.section}</div>

                <div className="item-cell">
                  {row.item}
                  {isComplete && <span className="checkmark">✓</span>}
                </div>

                <div className="percent-cell">{row.percent}</div>

                <div className="target-cell">
                  {rowHasTarget ? formatCurrency(row.target) : ""}
                </div>

                <div className={row.amount < 0 ? "amount negative" : "amount"}>
                  {rowHasTarget
                    ? `${formatCurrency(row.amount)} / ${formatCurrency(row.target)}`
                    : formatCurrency(row.amount)}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <BottomNav />

      <style>{`
        .dashboard-page {
          min-height: 100vh;
          background: #f3f4f6;
          padding: 16px 16px 92px;
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
          grid-template-columns: 1fr 1.3fr 0.8fr 1fr 1.4fr;
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
          overflow-wrap: anywhere;
        }

        .item-cell {
          font-weight: 700;
          overflow-wrap: anywhere;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .sheet-row.sub .item-cell {
          font-weight: 600;
          color: #374151;
        }

        .percent-cell,
        .target-cell {
          font-weight: 700;
          color: #374151;
          white-space: nowrap;
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

        .checkmark {
          color: #166534;
          font-weight: 900;
        }

        .bottom-nav {
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: 12px;
          z-index: 50;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          padding: 10px;
          background: #111827;
          border-radius: 22px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.22);
        }

        .bottom-nav a {
          min-height: 44px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          color: #d1d5db;
          font-size: 13px;
          font-weight: 800;
        }

        .bottom-nav a.active {
          background: white;
          color: #111827;
        }

        @media (max-width: 720px) {
          .dashboard-page {
            padding: 12px 12px 92px;
          }

          .header h1 {
            font-size: 26px;
          }

          .sheet-card {
            overflow-x: auto;
          }

          .sheet-header,
          .sheet-row {
            grid-template-columns: 86px 120px 76px 100px 145px;
            min-width: 527px;
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

          .bottom-nav {
            left: 10px;
            right: 10px;
            bottom: 10px;
            gap: 6px;
            padding: 8px;
          }

          .bottom-nav a {
            min-height: 42px;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}