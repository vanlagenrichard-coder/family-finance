import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData } from "../services/storage";

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

function formatTarget(value) {
  const number = Number(value || 0);

  if (!number) return "";

  return formatCurrency(number);
}

function isAtTarget(amount, target) {
  return Number(target || 0) > 0 && Number(amount || 0) >= Number(target || 0);
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
    if (!bucketName) return;

    const value = Number(amount || 0);

    ensure(bucketName, subBucketName);

    if (subBucketName) {
      balances[bucketName].subBuckets[subBucketName] += value;
    } else {
      balances[bucketName].total += value;
    }
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
      if (Array.isArray(transaction.allocations)) {
        transaction.allocations.forEach((allocation) => {
          add(
            allocation.bucket,
            allocation.subBucket,
            Math.abs(Number(allocation.amount || 0))
          );
        });
      } else {
        add(transaction.bucket, transaction.subBucket, Math.abs(amount));
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

  Object.keys(balances).forEach((bucketName) => {
    const subBucketTotal = Object.values(
      balances[bucketName].subBuckets
    ).reduce((sum, value) => sum + Number(value || 0), 0);

    balances[bucketName].total += subBucketTotal;
  });

  return balances;
}

function getBucketAmount(bucket, balances) {
  if (!bucket.subBuckets.length) {
    return Number(balances?.[bucket.name]?.total || 0);
  }

  return bucket.subBuckets.reduce((sum, subBucket) => {
    return (
      sum +
      Number(balances?.[bucket.name]?.subBuckets?.[subBucket.name] || 0)
    );
  }, 0);
}

function getSubBucketAmount(bucket, subBucket, balances) {
  return Number(balances?.[bucket.name]?.subBuckets?.[subBucket.name] || 0);
}

function getMainBucketPercentTotal(buckets) {
  return buckets.reduce((sum, bucket) => sum + Number(bucket.percent || 0), 0);
}

function getSubBucketPercentTotal(bucket) {
  return bucket.subBuckets.reduce(
    (sum, subBucket) => sum + Number(subBucket.percent || 0),
    0
  );
}

function isPercentTotalValid(total) {
  return Math.abs(Number(total || 0) - 100) < 0.01;
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

  const mainBucketPercentTotal = useMemo(() => {
    return getMainBucketPercentTotal(buckets);
  }, [buckets]);

  const rows = useMemo(() => {
    const bucketRows = buckets.flatMap((bucket) => {
      const bucketAmount = getBucketAmount(bucket, balances);

      const subRows = bucket.subBuckets.map((subBucket) => {
        const amount = getSubBucketAmount(bucket, subBucket, balances);
        const target = Number(subBucket.targetAmount || 0);

        return {
          section: bucket.name,
          item: subBucket.name,
          percent: formatPercent(subBucket.percent),
          target: formatTarget(target),
          amount,
          targetAmount: target,
          type: "sub",
        };
      });

      return [
        {
          section: "Paycheck",
          item: bucket.name,
          percent: formatPercent(bucket.percent),
          target: "",
          amount: bucketAmount,
          targetAmount: 0,
          type: "bucket",
        },
        ...subRows,
      ];
    });

    const totalMoney = buckets.reduce((sum, bucket) => {
      return sum + getBucketAmount(bucket, balances);
    }, 0);

    return [
      {
        section: "TOTAL",
        item: "Total Money",
        percent: "",
        target: "",
        amount: totalMoney,
        targetAmount: 0,
        type: "total",
      },
      ...bucketRows,
    ];
  }, [buckets, balances]);

  const subBucketWarnings = useMemo(() => {
    return buckets
      .filter((bucket) => bucket.subBuckets.length > 0)
      .map((bucket) => ({
        bucketName: bucket.name,
        total: getSubBucketPercentTotal(bucket),
      }))
      .filter((item) => !isPercentTotalValid(item.total));
  }, [buckets]);

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

      <section className="warnings">
        {!isPercentTotalValid(mainBucketPercentTotal) && (
          <div className="warning">
            Main bucket percentages must total 100%. Current total:{" "}
            {mainBucketPercentTotal}%.
          </div>
        )}

        {subBucketWarnings.map((warning) => (
          <div key={warning.bucketName} className="warning">
            Sub-bucket percentages must total 100%. {warning.bucketName} total:{" "}
            {warning.total}%.
          </div>
        ))}
      </section>

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
            const atTarget = isAtTarget(row.amount, row.targetAmount);

            return (
              <div
                key={`${row.section}-${row.item}-${index}`}
                className={`sheet-row ${row.type}`}
              >
                <div className="section-cell">{row.section}</div>

                <div className="item-cell">
                  {row.item}
                  {atTarget && <span className="checkmark">✓</span>}
                </div>

                <div className="percent-cell">{row.percent}</div>

                <div className="target-cell">{row.target}</div>

                <div className={row.amount < 0 ? "amount negative" : "amount"}>
                  {row.targetAmount > 0 ? (
                    <>
                      {formatCurrency(row.amount)} /{" "}
                      {formatCurrency(row.targetAmount)}
                    </>
                  ) : (
                    formatCurrency(row.amount)
                  )}
                </div>
              </div>
            );
          })}
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

        .warnings {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
        }

        .warning {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 13px;
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

        @media (max-width: 720px) {
          .dashboard-page {
            padding: 12px;
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
        }
      `}</style>
    </div>
  );
}