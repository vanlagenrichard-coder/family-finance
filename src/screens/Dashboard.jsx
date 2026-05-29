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

function calculateBalances(
  transactions,
  buckets
) {
  const balances = {};
  const historyMap = {};

  function ensureBucket(
    bucketId,
    subBucketId
  ) {
    if (!balances[bucketId]) {
      balances[bucketId] = {
        total: 0,
        subBuckets: {},
      };
    }

    if (
      subBucketId &&
      balances[bucketId].subBuckets[
        subBucketId
      ] === undefined
    ) {
      balances[bucketId].subBuckets[
        subBucketId
      ] = 0;
    }
  }

  function addAmount(
    bucketId,
    subBucketId,
    amount
  ) {
    if (!bucketId) return;

    ensureBucket(
      bucketId,
      subBucketId
    );

    balances[bucketId].total += Number(
      amount || 0
    );

    if (subBucketId) {
      balances[bucketId].subBuckets[
        subBucketId
      ] += Number(amount || 0);
    }
  }

  function addHistory(
    bucketId,
    subBucketId,
    item
  ) {
    if (
      !bucketId ||
      !subBucketId
    ) {
      return;
    }

    const key = `${bucketId}:::${subBucketId}`;

    if (!historyMap[key]) {
      historyMap[key] = [];
    }

    historyMap[key].push(item);
  }

  transactions.forEach((transaction) => {
    const amount = Number(
      transaction.amount || 0
    );

    /*
      EXPENSE
    */

    if (transaction.type === "expense") {
      addAmount(
        transaction.bucketId,
        transaction.subBucketId,
        -Math.abs(amount)
      );

      addHistory(
        transaction.bucketId,
        transaction.subBucketId,
        {
          type: "Expense",
          amount: -Math.abs(amount),
          date: transaction.date,
        }
      );
    }

    /*
      INCOME / DEPOSIT
    */

    if (
      transaction.type === "income" ||
      transaction.type === "deposit"
    ) {
      addAmount(
        transaction.bucketId,
        transaction.subBucketId,
        Math.abs(amount)
      );

      addHistory(
        transaction.bucketId,
        transaction.subBucketId,
        {
          type: "Deposit",
          amount: Math.abs(amount),
          date: transaction.date,
        }
      );
    }

    /*
      TRANSFER
    */

    if (transaction.type === "transfer") {
      addAmount(
        transaction.fromBucketId,
        transaction.fromSubBucketId,
        -Math.abs(amount)
      );

      addAmount(
        transaction.toBucketId,
        transaction.toSubBucketId,
        Math.abs(amount)
      );

      addHistory(
        transaction.fromBucketId,
        transaction.fromSubBucketId,
        {
          type: "Transfer Out",
          amount: -Math.abs(amount),
          date: transaction.date,
        }
      );

      addHistory(
        transaction.toBucketId,
        transaction.toSubBucketId,
        {
          type: "Transfer In",
          amount: Math.abs(amount),
          date: transaction.date,
        }
      );
    }
  });

  Object.keys(historyMap).forEach(
    (key) => {
      historyMap[key].sort((a, b) =>
        String(
          b.date || ""
        ).localeCompare(
          String(a.date || "")
        )
      );
    }
  );

  return {
    balances,
    historyMap,
  };
}

function getFundedPercent(
  amount,
  target
) {
  if (!target || target <= 0) {
    return amount >= 0 ? 100 : 0;
  }

  return Math.max(
    0,
    Math.round((amount / target) * 100)
  );
}

function getStatusColor(
  amount,
  fundedPercent
) {
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

    return () => {
      window.removeEventListener(
        "focus",
        refresh
      );

      window.removeEventListener(
        "pageshow",
        refresh
      );
    };
  }, []);

  const freshData = loadData();

  const transactions =
    getTransactions(freshData);

  const buckets = useMemo(() => {
    return Array.isArray(
      freshData?.buckets
    )
      ? freshData.buckets
      : [];
  }, [freshData, refreshKey]);

  const {
    balances,
    historyMap,
  } = useMemo(() => {
    return calculateBalances(
      transactions,
      buckets
    );
  }, [transactions, buckets]);

  const totalMoney = useMemo(() => {
    return buckets.reduce(
      (total, bucket) => {
        return (
          total +
          Number(
            balances?.[bucket.id]
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
            balances?.[bucket.id] || {
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
                            subBucket.id
                          ] || 0
                        );

                      const fundedPercent =
                        getFundedPercent(
                          amount,
                          subBucket.target
                        );

                      const status =
                        getStatusColor(
                          amount,
                          fundedPercent
                        );

                      const historyKey = `${bucket.id}:::${subBucket.id}`;

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
                                  {subBucket.target >
                                  0
                                    ? `${formatCurrency(
                                        amount
                                      )} / ${formatCurrency(
                                        subBucket.target
                                      )}`
                                    : "Available"}
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

                            <div className="subbucket-meta">
                              {subBucket.dueDate ? (
                                <span>
                                  Due{" "}
                                  {
                                    subBucket.dueDate
                                  }
                                </span>
                              ) : null}

                              {subBucket.frequency ? (
                                <span>
                                  {
                                    subBucket.frequency
                                  }
                                </span>
                              ) : null}

                              {subBucket.reserveGoal >
                              0 ? (
                                <span>
                                  {
                                    subBucket.reserveGoal
                                  }{" "}
                                  month reserve
                                </span>
                              ) : null}
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

        .subbucket-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .subbucket-meta span {
          background: #f3f4f6;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 11px;
          color: #4b5563;
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