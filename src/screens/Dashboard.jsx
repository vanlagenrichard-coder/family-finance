import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData } from "../services/storage";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));
}

function getSetup(data) {
  return data?.settings?.setup || data?.setup || {};
}

function getTransactions(data) {
  return Array.isArray(data?.transactions)
    ? data.transactions
    : [];
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function isArchived(item) {
  return Boolean(
    item?.archived ||
      item?.isArchived ||
      item?.inactive
  );
}

function getBucketsFromSetup(setup) {
  const bucketGroups = Array.isArray(
    setup?.bucketGroups
  )
    ? setup.bucketGroups
    : [];

  if (bucketGroups.length > 0) {
    return bucketGroups
      .filter((bucket) => !isArchived(bucket))
      .map((bucket) => ({
        id:
          bucket.id ||
          bucket.name ||
          Math.random().toString(),
        name: normalizeText(bucket.name),
        percent: Number(
          bucket.percent ||
            bucket.percentage ||
            0
        ),
        subBuckets: (
          Array.isArray(bucket.subBuckets)
            ? bucket.subBuckets
            : []
        )
          .filter(
            (subBucket) =>
              !isArchived(subBucket)
          )
          .map((subBucket) => ({
            id:
              subBucket.id ||
              subBucket.name ||
              Math.random().toString(),
            name: normalizeText(
              subBucket.name
            ),
            percent: Number(
              subBucket.percent ||
                subBucket.percentage ||
                0
            ),
            target: Number(
              subBucket.target ||
                subBucket.targetAmount ||
                subBucket.monthlyTarget ||
                0
            ),
            dueDate:
              subBucket.dueDate || "",
            frequency:
              subBucket.frequency || "",
            reserveGoal: Number(
              subBucket.reserveGoal || 0
            ),
          })),
      }));
  }

  const setupGroups =
    setup?.groups ||
    setup?.bucketPercentages ||
    setup?.percentages ||
    {};

  return Object.entries(setupGroups)
    .map(([bucketName, bucketValue]) => {
      const subBucketsRaw =
        setup?.subBuckets?.[bucketName] ||
        setup?.subBucketPercentages?.[
          bucketName
        ] ||
        {};

      const subBuckets = Object.entries(
        subBucketsRaw
      )
        .map(
          ([subBucketName, subBucketValue]) => {
            if (
              subBucketValue &&
              typeof subBucketValue ===
                "object"
            ) {
              return {
                id:
                  subBucketValue.id ||
                  subBucketName,
                name: normalizeText(
                  subBucketValue.name ||
                    subBucketName
                ),
                percent: Number(
                  subBucketValue.percent ||
                    subBucketValue.percentage ||
                    0
                ),
                target: Number(
                  subBucketValue.target ||
                    subBucketValue.targetAmount ||
                    subBucketValue.monthlyTarget ||
                    0
                ),
                dueDate:
                  subBucketValue.dueDate ||
                  "",
                frequency:
                  subBucketValue.frequency ||
                  "",
                reserveGoal: Number(
                  subBucketValue.reserveGoal ||
                    0
                ),
                archived:
                  subBucketValue.archived,
              };
            }

            return {
              id: subBucketName,
              name: normalizeText(
                subBucketName
              ),
              percent: Number(
                subBucketValue || 0
              ),
              target: 0,
              dueDate: "",
              frequency: "",
              reserveGoal: 0,
              archived: false,
            };
          }
        )
        .filter(
          (subBucket) =>
            !subBucket.archived
        );

      return {
        id: bucketName,
        name: normalizeText(bucketName),
        percent: Number(
          bucketValue?.percent ||
            bucketValue?.percentage ||
            bucketValue ||
            0
        ),
        subBuckets,
      };
    })
    .filter((bucket) => bucket.name);
}

function createBalanceStructure(buckets) {
  const structure = {};

  buckets.forEach((bucket) => {
    structure[bucket.name] = {
      total: 0,
      subBuckets: {},
    };

    bucket.subBuckets.forEach((subBucket) => {
      structure[bucket.name].subBuckets[
        subBucket.name
      ] = 0;
    });
  });

  return structure;
}

function ensureBucket(
  balances,
  bucketName,
  subBucketName
) {
  if (!bucketName) return;

  if (!balances[bucketName]) {
    balances[bucketName] = {
      total: 0,
      subBuckets: {},
    };
  }

  if (
    subBucketName &&
    balances[bucketName].subBuckets[
      subBucketName
    ] === undefined
  ) {
    balances[bucketName].subBuckets[
      subBucketName
    ] = 0;
  }
}

function addToBalance(
  balances,
  bucketName,
  subBucketName,
  amount
) {
  if (!bucketName) return;

  ensureBucket(
    balances,
    bucketName,
    subBucketName
  );

  balances[bucketName].total += Number(
    amount || 0
  );

  if (subBucketName) {
    balances[bucketName].subBuckets[
      subBucketName
    ] += Number(amount || 0);
  }
}

function calculateBalances(
  transactions,
  buckets
) {
  const balances =
    createBalanceStructure(buckets);

  const historyMap = {};

  function addHistory(
    bucketName,
    subBucketName,
    item
  ) {
    if (
      !bucketName ||
      !subBucketName
    ) {
      return;
    }

    const key = `${bucketName}:::${subBucketName}`;

    if (!historyMap[key]) {
      historyMap[key] = [];
    }

    historyMap[key].push(item);
  }

  transactions.forEach((transaction) => {
    const type = normalizeKey(
      transaction?.type
    );

    const amount = Number(
      transaction?.amount || 0
    );

    if (type === "paycheck") {
      const allocations = Array.isArray(
        transaction?.allocations
      )
        ? transaction.allocations
        : [];

      if (allocations.length > 0) {
        allocations.forEach(
          (allocation) => {
            const bucketName =
              normalizeText(
                allocation.bucket
              );

            const subBucketName =
              normalizeText(
                allocation.subBucket
              );

            const allocationAmount =
              Number(
                allocation.amount || 0
              );

            addToBalance(
              balances,
              bucketName,
              subBucketName,
              allocationAmount
            );

            addHistory(
              bucketName,
              subBucketName,
              {
                type:
                  "Paycheck Funding",
                amount:
                  allocationAmount,
                date:
                  transaction.date,
              }
            );
          }
        );

        return;
      }

      buckets.forEach((bucket) => {
        const bucketAmount =
          amount *
          (Number(
            bucket.percent || 0
          ) /
            100);

        bucket.subBuckets.forEach(
          (subBucket) => {
            const subAmount =
              bucketAmount *
              (Number(
                subBucket.percent || 0
              ) /
                100);

            addToBalance(
              balances,
              bucket.name,
              subBucket.name,
              subAmount
            );

            addHistory(
              bucket.name,
              subBucket.name,
              {
                type:
                  "Paycheck Funding",
                amount: subAmount,
                date:
                  transaction.date,
              }
            );
          }
        );
      });

      return;
    }

    if (type === "expense") {
      const bucketName =
        normalizeText(
          transaction.bucket
        );

      const subBucketName =
        normalizeText(
          transaction.subBucket
        );

      addToBalance(
        balances,
        bucketName,
        subBucketName,
        -Math.abs(amount)
      );

      addHistory(
        bucketName,
        subBucketName,
        {
          type: "Expense",
          amount: -Math.abs(amount),
          date: transaction.date,
        }
      );

      return;
    }

    if (type === "deposit") {
      const bucketName =
        normalizeText(
          transaction.bucket
        );

      const subBucketName =
        normalizeText(
          transaction.subBucket
        );

      addToBalance(
        balances,
        bucketName,
        subBucketName,
        Math.abs(amount)
      );

      addHistory(
        bucketName,
        subBucketName,
        {
          type: "Deposit",
          amount: Math.abs(amount),
          date: transaction.date,
        }
      );

      return;
    }

    if (type === "transfer") {
      const fromBucket =
        normalizeText(
          transaction.fromBucket
        );

      const fromSubBucket =
        normalizeText(
          transaction.fromSubBucket
        );

      const toBucket =
        normalizeText(
          transaction.toBucket
        );

      const toSubBucket =
        normalizeText(
          transaction.toSubBucket
        );

      addToBalance(
        balances,
        fromBucket,
        fromSubBucket,
        -Math.abs(amount)
      );

      addToBalance(
        balances,
        toBucket,
        toSubBucket,
        Math.abs(amount)
      );

      addHistory(
        fromBucket,
        fromSubBucket,
        {
          type: "Transfer Out",
          amount: -Math.abs(amount),
          date: transaction.date,
        }
      );

      addHistory(
        toBucket,
        toSubBucket,
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

  const setup = getSetup(freshData);

  const transactions =
    getTransactions(freshData);

  const buckets = useMemo(() => {
    return getBucketsFromSetup(setup);
  }, [setup, refreshKey]);

  const {
    balances,
    historyMap,
  } = useMemo(() => {
    return calculateBalances(
      transactions,
      buckets
    );
  }, [transactions, buckets, refreshKey]);

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

  function toggleBucket(bucketName) {
    setExpandedBuckets((current) => ({
      ...current,
      [bucketName]:
        !current[bucketName],
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
              bucket.name
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
                    bucket.name
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
                              {subBucket
                                .dueDate ? (
                                <span>
                                  Due{" "}
                                  {
                                    subBucket.dueDate
                                  }
                                </span>
                              ) : null}

                              {subBucket
                                .frequency ? (
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
                                  month
                                  reserve
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

        .top-card span {
          display: block;
          color: #d1d5db;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .top-card strong {
          display: block;
          font-size: 40px;
          line-height: 1;
        }

        .top-card p {
          margin: 10px 0 0;
          color: #d1d5db;
          font-size: 13px;
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

        .bucket-header h2 {
          margin: 0;
          font-size: 22px;
        }

        .bucket-header p {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .bucket-header strong {
          font-size: 22px;
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

        .subbucket-top h3 {
          margin: 0;
          font-size: 18px;
        }

        .subbucket-top p {
          margin: 4px 0 0;
          font-size: 13px;
          color: #6b7280;
        }

        .subbucket-right {
          text-align: right;
        }

        .subbucket-right strong {
          display: block;
          margin-bottom: 6px;
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

        .history-row:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: 0;
        }

        .history-row span {
          display: block;
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
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

        @media (min-width: 768px) {
          .dashboard-page {
            max-width: 960px;
            margin: 0 auto;
          }
        }
      `}</style>
    </div>
  );
}