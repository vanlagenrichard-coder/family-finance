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
  return Array.isArray(data?.transactions)
    ? data.transactions
    : [];
}

function calculateBalances(transactions) {
  const balances = {};
  const historyMap = {};

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

    ensure(bucketName, subBucketName);

    balances[bucketName].total += Number(amount || 0);

    if (subBucketName) {
      balances[bucketName].subBuckets[subBucketName] += Number(amount || 0);
    }
  }

  function addHistory(bucketName, subBucketName, item) {
    if (!bucketName || !subBucketName) return;

    const key = `${bucketName}:::${subBucketName}`;

    if (!historyMap[key]) {
      historyMap[key] = [];
    }

    historyMap[key].push(item);
  }

  transactions.forEach((transaction) => {
    const amount = Number(transaction.amount || 0);

    if (transaction.type === "Deposit") {
      add(
        transaction.bucket,
        transaction.subBucket,
        Math.abs(amount)
      );

      addHistory(
        transaction.bucket,
        transaction.subBucket,
        {
          type: "Deposit",
          amount: Math.abs(amount),
          date: transaction.date,
        }
      );
    }

    if (transaction.type === "Expense") {
      add(
        transaction.bucket,
        transaction.subBucket,
        -Math.abs(amount)
      );

      addHistory(
        transaction.bucket,
        transaction.subBucket,
        {
          type: "Expense",
          amount: -Math.abs(amount),
          date: transaction.date,
        }
      );
    }

    if (
      transaction.type === "Paycheck" &&
      Array.isArray(transaction.allocations)
    ) {
      transaction.allocations.forEach((allocation) => {
        const allocationAmount = Number(allocation.amount || 0);

        add(
          allocation.bucket,
          allocation.subBucket,
          Math.abs(allocationAmount)
        );

        addHistory(
          allocation.bucket,
          allocation.subBucket,
          {
            type: "Paycheck",
            amount: Math.abs(allocationAmount),
            date: transaction.date,
          }
        );
      });
    }

    if (transaction.type === "Transfer") {
      add(
        transaction.fromBucket,
        transaction.fromSubBucket,
        -Math.abs(amount)
      );

      add(
        transaction.toBucket,
        transaction.toSubBucket,
        Math.abs(amount)
      );

      addHistory(
        transaction.fromBucket,
        transaction.fromSubBucket,
        {
          type: "Transfer Out",
          amount: -Math.abs(amount),
          date: transaction.date,
        }
      );

      addHistory(
        transaction.toBucket,
        transaction.toSubBucket,
        {
          type: "Transfer In",
          amount: Math.abs(amount),
          date: transaction.date,
        }
      );
    }
  });

  return {
    balances,
    historyMap,
  };
}

function getFundedPercent(amount, target) {
  if (!target || target <= 0) {
    return amount >= 0 ? 100 : 0;
  }

  return Math.max(
    0,
    Math.round((amount / target) * 100)
  );
}

function getStatusColor(amount, fundedPercent) {
  if (amount < 0) {
    return "red";
  }

  if (fundedPercent >= 100) {
    return "green";
  }

  if (fundedPercent >= 75) {
    return "yellow";
  }

  return "red";
}

export default function Dashboard() {
  const [refreshKey, setRefreshKey] =
    useState(0);

  const [expandedBuckets, setExpandedBuckets] =
    useState({});

  const [expandedHistory, setExpandedHistory] =
    useState("");

  useEffect(() => {
    function refresh() {
      setRefreshKey((value) => value + 1);
    }

    refresh();

    window.addEventListener(
      "focus",
      refresh
    );

    window.addEventListener(
      "pageshow",
      refresh
    );

    window.addEventListener(
      "storage",
      refresh
    );

    window.addEventListener(
      "app-data-updated",
      refresh
    );

    return () => {
      window.removeEventListener(
        "focus",
        refresh
      );

      window.removeEventListener(
        "pageshow",
        refresh
      );

      window.removeEventListener(
        "storage",
        refresh
      );

      window.removeEventListener(
        "app-data-updated",
        refresh
      );
    };
  }, []);

  const freshData = loadData();

  const transactions =
    getTransactions(freshData);

  const buckets = useMemo(() => {
    if (
      Array.isArray(freshData?.setupBuckets)
    ) {
      return freshData.setupBuckets;
    }

    if (Array.isArray(freshData?.buckets)) {
      return freshData.buckets;
    }

    if (
      Array.isArray(
        freshData?.settings?.setup
      )
    ) {
      return freshData.settings.setup;
    }

    if (Array.isArray(freshData?.setup)) {
      return freshData.setup;
    }

    return [];
  }, [freshData, refreshKey]);

  const {
    balances,
    historyMap,
  } = useMemo(() => {
    return calculateBalances(transactions);
  }, [transactions]);

  const totalMoney = useMemo(() => {
    return buckets.reduce(
      (total, bucket) => {
        return (
          total +
          Number(
            balances?.[bucket.name]
              ?.total || 0
          )
        );
      },
      0
    );
  }, [buckets, balances]);

  function toggleBucket(bucketId) {
    setExpandedBuckets((current) => ({
      ...current,
      [bucketId]:
        !current[bucketId],
    }));
  }

  function toggleHistory(key) {
    setExpandedHistory((current) =>
      current === key ? "" : key
    );
  }

  return (
    <div className="dashboard-page">
      <header className="header">
        <Link
          to="/"
          className="home-button"
        >
          Home
        </Link>

        <div>
          <h1>Balances</h1>

          <p>
            Live calculated balances
          </p>
        </div>
      </header>

      <section className="top-card">
        <span>Total Money</span>

        <strong
          className={
            totalMoney < 0
              ? "negative"
              : ""
          }
        >
          {formatCurrency(totalMoney)}
        </strong>

        <p>
          Transactions are the source
          of truth
        </p>
      </section>

      <main className="bucket-list">
        {buckets.map((bucket) => {
          const bucketBalance =
            balances?.[bucket.name] || {
              total: 0,
              subBuckets: {},
            };

          const expanded =
            expandedBuckets[
              bucket.id
            ];

          return (
            <section
              key={bucket.id}
              className="bucket-card"
            >
              <button
                type="button"
                className="bucket-header"
                onClick={() =>
                  toggleBucket(
                    bucket.id
                  )
                }
              >
                <div>
                  <h2>{bucket.name}</h2>

                  <p>
                    {
                      bucket.subBuckets
                        .length
                    }{" "}
                    sub-buckets
                  </p>
                </div>

                <strong
                  className={
                    bucketBalance.total <
                    0
                      ? "negative"
                      : ""
                  }
                >
                  {formatCurrency(
                    bucketBalance.total
                  )}
                </strong>
              </button>

              {expanded && (
                <div className="subbucket-list">
                  {bucket.subBuckets.map(
                    (subBucket) => {
                      const amount =
                        Number(
                          bucketBalance
                            ?.subBuckets?.[
                            subBucket.name
                          ] || 0
                        );

                      const targetAmount =
                        Number(
                          subBucket.monthlyTarget ??
                            subBucket.targetAmount ??
                            0
                        );

                      const fundedPercent =
                        getFundedPercent(
                          amount,
                          targetAmount
                        );

                      const status =
                        getStatusColor(
                          amount,
                          fundedPercent
                        );

                      const historyKey = `${bucket.name}:::${subBucket.name}`;

                      const history =
                        historyMap[
                          historyKey
                        ] || [];

                      const historyExpanded =
                        expandedHistory ===
                        historyKey;

                      return (
                        <article
                          key={
                            subBucket.id
                          }
                          className="subbucket-card"
                        >
                          <button
                            type="button"
                            className="subbucket-button"
                            onClick={() =>
                              toggleHistory(
                                historyKey
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

                                <p>
                                  {fundedPercent}
                                  % funded
                                </p>
                              </div>

                              <div className="subbucket-right">
                                <strong
                                  className={
                                    amount <
                                    0
                                      ? "negative"
                                      : ""
                                  }
                                >
                                  {formatCurrency(
                                    amount
                                  )}
                                </strong>

                                <span
                                  className={`status ${status}`}
                                >
                                  Available
                                </span>
                              </div>
                            </div>

                            <div className="progress-bar">
                              <div
                                className={`progress-fill ${status}`}
                                style={{
                                  width: `${Math.min(
                                    fundedPercent,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </button>

                          {historyExpanded && (
                            <div className="history-panel">
                              {history.length ===
                              0 ? (
                                <p className="empty">
                                  No history
                                </p>
                              ) : (
                                history.map(
                                  (
                                    item,
                                    index
                                  ) => (
                                    <div
                                      key={`${historyKey}-${index}`}
                                      className="history-row"
                                    >
                                      <div>
                                        <strong>
                                          {
                                            item.type
                                          }
                                        </strong>

                                        <span>
                                          {item.date ||
                                            "No date"}
                                        </span>
                                      </div>

                                      <strong
                                        className={
                                          item.amount <
                                          0
                                            ? "negative"
                                            : "positive"
                                        }
                                      >
                                        {formatCurrency(
                                          item.amount
                                        )}
                                      </strong>
                                    </div>
                                  )
                                )
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

        .top-card {
          background: #111827;
          color: white;
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 18px;
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
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .bucket-header {
          width: 100%;
          border: 0;
          background: white;
          padding: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-align: left;
          cursor: pointer;
        }

        .subbucket-list {
          background: #f8fafc;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .subbucket-card {
          background: white;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
        }

        .subbucket-button {
          width: 100%;
          border: 0;
          background: transparent;
          padding: 14px;
          text-align: left;
          cursor: pointer;
        }

        .subbucket-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 24px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
        }

        .green {
          background: #dcfce7;
          color: #166534;
        }

        .yellow {
          background: #fef3c7;
          color: #92400e;
        }

        .red {
          background: #fee2e2;
          color: #991b1b;
        }

        .progress-bar {
          height: 10px;
          background: #e5e7eb;
          border-radius: 999px;
          overflow: hidden;
          margin-top: 12px;
        }

        .progress-fill {
          height: 100%;
        }

        .history-panel {
          border-top: 1px solid #e5e7eb;
          padding: 14px;
          background: white;
        }

        .history-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 10px;
          margin-bottom: 10px;
          border-bottom: 1px solid #f3f4f6;
        }

        .positive {
          color: #166534;
        }

        .negative {
          color: #dc2626;
        }

        .empty {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}