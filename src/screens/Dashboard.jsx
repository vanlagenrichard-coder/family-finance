import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData } from "../services/storage";

const BUCKETS = [
  {
    id: "bills",
    label: "Bills",
    subBuckets: [
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
  },
  {
    id: "savings",
    label: "Savings",
    subBuckets: ["Emergency", "Holiday", "Home"],
  },
  {
    id: "giving",
    label: "Giving",
    subBuckets: ["Church"],
  },
  {
    id: "spending",
    label: "Spending",
    subBuckets: ["Family", "Wife", "Me", "Kids"],
  },
];

const DEFAULT_SETUP = {
  groups: {
    Bills: 55,
    Savings: 10,
    Giving: 5,
    Spending: 30,
  },
  subBuckets: {
    Bills: {
      Mortgage: 45,
      "Natural Gas": 5,
      Hydro: 7,
      "House Insurance": 6,
      "Property Tax": 10,
      "Car Insurance": 8,
      Internet: 5,
      Phone: 5,
      "Bank Fee": 1,
      Netflix: 1,
      "Bills Buffer": 7,
    },
    Savings: {
      Emergency: 20,
      Holiday: 50,
      Home: 30,
    },
    Giving: {
      Church: 100,
    },
    Spending: {
      Family: 55,
      Wife: 15,
      Me: 15,
      Kids: 15,
    },
  },
  billTargets: {
    Mortgage: 0,
    "Natural Gas": 0,
    Hydro: 0,
    "House Insurance": 0,
    "Property Tax": 0,
    "Car Insurance": 0,
    Internet: 0,
    Phone: 0,
    "Bank Fee": 0,
    Netflix: 0,
    "Bills Buffer": 0,
  },
};

function money(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(value || 0));
}

function normalizeText(value) {
  return String(value || "").trim();
}

function getTransactions(data) {
  return Array.isArray(data?.transactions) ? data.transactions : [];
}

function getSetup(data) {
  const settings = data?.settings || {};
  const setup = data?.setup || {};

  return {
    groups:
      setup.groups ||
      setup.percentages ||
      settings.groups ||
      settings.percentages ||
      DEFAULT_SETUP.groups,
    subBuckets:
      setup.subBuckets ||
      setup.subBucketPercentages ||
      settings.subBuckets ||
      settings.subBucketPercentages ||
      DEFAULT_SETUP.subBuckets,
    billTargets:
      setup.billTargets ||
      settings.billTargets ||
      setup.monthlyTargets ||
      settings.monthlyTargets ||
      DEFAULT_SETUP.billTargets,
  };
}

function getTransactionType(transaction) {
  return normalizeText(transaction.type).toLowerCase();
}

function getTransactionAmount(transaction) {
  return Number(transaction.amount || 0);
}

function getTransactionBucket(transaction) {
  return normalizeText(transaction.bucket || transaction.group || transaction.category);
}

function getTransactionSubBucket(transaction) {
  return normalizeText(
    transaction.subBucket ||
      transaction.subbucket ||
      transaction.subCategory ||
      transaction.bill ||
      transaction.name
  );
}

function getTransactionDate(transaction) {
  return transaction.date || transaction.createdAt || transaction.timestamp || "";
}

function getTransactionNote(transaction) {
  return transaction.note || transaction.description || "";
}

function addHistory(historyMap, bucket, subBucket, entry) {
  const key = `${bucket}|||${subBucket}`;
  if (!historyMap[key]) historyMap[key] = [];
  historyMap[key].push(entry);
}

function addBalance(balances, bucketName, subBucketName, amount) {
  if (!balances[bucketName] || !subBucketName) return;

  if (balances[bucketName].subBuckets[subBucketName] === undefined) {
    balances[bucketName].subBuckets[subBucketName] = 0;
  }

  balances[bucketName].subBuckets[subBucketName] += amount;
  balances[bucketName].total += amount;
}

function calculateBalances(transactions, setup) {
  const balances = {};
  const historyMap = {};

  BUCKETS.forEach((bucket) => {
    balances[bucket.label] = {
      total: 0,
      subBuckets: {},
    };

    bucket.subBuckets.forEach((subBucket) => {
      balances[bucket.label].subBuckets[subBucket] = 0;
    });
  });

  transactions.forEach((transaction) => {
    const type = getTransactionType(transaction);
    const amount = getTransactionAmount(transaction);

    if (!amount) return;

    if (type === "paycheck") {
      Object.entries(setup.groups || {}).forEach(([bucketName, bucketPercent]) => {
        const bucketAmount = amount * (Number(bucketPercent || 0) / 100);
        const subRules = setup.subBuckets?.[bucketName] || {};

        Object.entries(subRules).forEach(([subBucketName, subPercent]) => {
          const subAmount = bucketAmount * (Number(subPercent || 0) / 100);

          addBalance(balances, bucketName, subBucketName, subAmount);

          addHistory(historyMap, bucketName, subBucketName, {
            type: "Paycheck Funding",
            amount: subAmount,
            date: getTransactionDate(transaction),
            note: getTransactionNote(transaction),
          });
        });
      });

      return;
    }

    if (type === "expense") {
      const bucketName = getTransactionBucket(transaction);
      const subBucketName = getTransactionSubBucket(transaction);

      addBalance(balances, bucketName, subBucketName, -amount);

      addHistory(historyMap, bucketName, subBucketName, {
        type: "Expense",
        amount: -amount,
        date: getTransactionDate(transaction),
        note: getTransactionNote(transaction),
      });

      return;
    }

    if (type === "deposit") {
      const bucketName = getTransactionBucket(transaction);
      const subBucketName = getTransactionSubBucket(transaction);

      addBalance(balances, bucketName, subBucketName, amount);

      addHistory(historyMap, bucketName, subBucketName, {
        type: "Deposit",
        amount,
        date: getTransactionDate(transaction),
        note: getTransactionNote(transaction),
      });

      return;
    }

    if (type === "transfer") {
      const fromBucket = normalizeText(transaction.fromBucket);
      const fromSubBucket = normalizeText(transaction.fromSubBucket);
      const toBucket = normalizeText(transaction.toBucket);
      const toSubBucket = normalizeText(transaction.toSubBucket);

      addBalance(balances, fromBucket, fromSubBucket, -amount);
      addBalance(balances, toBucket, toSubBucket, amount);

      addHistory(historyMap, fromBucket, fromSubBucket, {
        type: "Transfer Out",
        amount: -amount,
        date: getTransactionDate(transaction),
        note: getTransactionNote(transaction),
      });

      addHistory(historyMap, toBucket, toSubBucket, {
        type: "Transfer In",
        amount,
        date: getTransactionDate(transaction),
        note: getTransactionNote(transaction),
      });
    }
  });

  Object.keys(historyMap).forEach((key) => {
    historyMap[key].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  });

  return { balances, historyMap };
}

function getFundedPercent(bucketName, subBucketName, amount, setup) {
  if (bucketName !== "Bills") return amount >= 0 ? 100 : 0;

  const target = Number(setup.billTargets?.[subBucketName] || 0);

  if (target <= 0) return amount >= 0 ? 100 : 0;

  return Math.min(999, Math.round((amount / target) * 100));
}

export default function Balances() {
  const [data, setData] = useState(() => loadData());
  const [openBuckets, setOpenBuckets] = useState({
    Bills: true,
    Savings: true,
    Giving: true,
    Spending: true,
  });
  const [openHistoryKey, setOpenHistoryKey] = useState("");

  useEffect(() => {
    function refreshData() {
      setData(loadData());
    }

    window.addEventListener("focus", refreshData);
    window.addEventListener("pageshow", refreshData);

    return () => {
      window.removeEventListener("focus", refreshData);
      window.removeEventListener("pageshow", refreshData);
    };
  }, []);

  const setup = useMemo(() => getSetup(data || {}), [data]);
  const transactions = useMemo(() => getTransactions(data || {}), [data]);

  const { balances, historyMap } = useMemo(() => {
    return calculateBalances(transactions, setup);
  }, [transactions, setup]);

  function toggleBucket(bucketName) {
    setOpenBuckets((current) => ({
      ...current,
      [bucketName]: !current[bucketName],
    }));
  }

  function toggleHistory(bucketName, subBucketName) {
    const key = `${bucketName}|||${subBucketName}`;
    setOpenHistoryKey((current) => (current === key ? "" : key));
  }

  return (
    <div className="balances-page">
      <header className="balances-header">
        <Link to="/" className="home-button">
          Home
        </Link>

        <div>
          <h1>Balances</h1>
          <p>Calculated from transactions only.</p>
        </div>
      </header>

      <section className="summary-grid">
        {BUCKETS.map((bucket) => (
          <div className="summary-card" key={bucket.id}>
            <span>{bucket.label}</span>
            <strong>{money(balances[bucket.label]?.total || 0)}</strong>
          </div>
        ))}
      </section>

      <main className="bucket-list">
        {BUCKETS.map((bucket) => {
          const bucketBalance = balances[bucket.label];
          const isOpen = openBuckets[bucket.label];

          return (
            <section className="bucket-card" key={bucket.id}>
              <button
                className="bucket-header"
                type="button"
                onClick={() => toggleBucket(bucket.label)}
              >
                <div>
                  <h2>{bucket.label}</h2>
                  <p>{bucket.subBuckets.length} sub-buckets</p>
                </div>

                <div className="bucket-header-right">
                  <strong>{money(bucketBalance?.total || 0)}</strong>
                  <span>{isOpen ? "Collapse" : "Expand"}</span>
                </div>
              </button>

              {isOpen && (
                <div className="subbucket-list">
                  {bucket.subBuckets.map((subBucket) => {
                    const amount = bucketBalance?.subBuckets?.[subBucket] || 0;
                    const target = Number(setup.billTargets?.[subBucket] || 0);
                    const fundedPercent = getFundedPercent(
                      bucket.label,
                      subBucket,
                      amount,
                      setup
                    );
                    const isFunded = fundedPercent >= 100;
                    const historyKey = `${bucket.label}|||${subBucket}`;
                    const history = historyMap[historyKey] || [];
                    const historyOpen = openHistoryKey === historyKey;

                    return (
                      <article className="subbucket-card" key={subBucket}>
                        <button
                          type="button"
                          className="subbucket-main"
                          onClick={() => toggleHistory(bucket.label, subBucket)}
                        >
                          <div className="subbucket-top">
                            <div>
                              <h3>{subBucket}</h3>
                              {bucket.label === "Bills" && target > 0 ? (
                                <p>
                                  Target {money(target)} · {fundedPercent}% funded
                                </p>
                              ) : (
                                <p>{fundedPercent}% funded</p>
                              )}
                            </div>

                            <strong>{money(amount)}</strong>
                          </div>

                          <div className="funding-bar">
                            <div
                              className={isFunded ? "funded green" : "funded red"}
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(fundedPercent, 100)
                                )}%`,
                              }}
                            />
                          </div>

                          <div className={isFunded ? "status green" : "status red"}>
                            {isFunded ? "Funded" : "Underfunded"}
                          </div>
                        </button>

                        {historyOpen && (
                          <div className="history-panel">
                            <h4>History</h4>

                            {history.length === 0 ? (
                              <p className="empty-history">
                                No activity for this sub-bucket yet.
                              </p>
                            ) : (
                              <div className="history-list">
                                {history.map((entry, index) => (
                                  <div
                                    className="history-row"
                                    key={`${historyKey}-${index}`}
                                  >
                                    <div>
                                      <strong>{entry.type}</strong>
                                      <span>{entry.date || "No date"}</span>
                                      {entry.note ? <p>{entry.note}</p> : null}
                                    </div>

                                    <strong
                                      className={
                                        Number(entry.amount) >= 0
                                          ? "amount-positive"
                                          : "amount-negative"
                                      }
                                    >
                                      {money(entry.amount)}
                                    </strong>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </main>

      <style>{`
        .balances-page {
          min-height: 100vh;
          padding: 16px;
          background: #f4f6f8;
          color: #1f2937;
        }

        .balances-header {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
        }

        .balances-header h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.1;
        }

        .balances-header p {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .home-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 14px;
          border-radius: 12px;
          background: #111827;
          color: white;
          text-decoration: none;
          font-weight: 700;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }

        .summary-card {
          background: white;
          border-radius: 16px;
          padding: 14px;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
        }

        .summary-card span {
          display: block;
          color: #6b7280;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .summary-card strong {
          font-size: 20px;
        }

        .bucket-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .bucket-card {
          background: white;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 1px 5px rgba(15, 23, 42, 0.1);
        }

        .bucket-header {
          width: 100%;
          border: 0;
          background: white;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-align: left;
          cursor: pointer;
        }

        .bucket-header h2 {
          margin: 0;
          font-size: 21px;
        }

        .bucket-header p {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .bucket-header-right {
          text-align: right;
        }

        .bucket-header-right strong {
          display: block;
          font-size: 18px;
          margin-bottom: 4px;
        }

        .bucket-header-right span {
          color: #6b7280;
          font-size: 12px;
        }

        .subbucket-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 0 12px 12px;
        }

        .subbucket-card {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow: hidden;
          background: #fafafa;
        }

        .subbucket-main {
          width: 100%;
          border: 0;
          background: transparent;
          padding: 12px;
          text-align: left;
          cursor: pointer;
        }

        .subbucket-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .subbucket-top h3 {
          margin: 0;
          font-size: 16px;
        }

        .subbucket-top p {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .subbucket-top strong {
          white-space: nowrap;
          font-size: 16px;
        }

        .funding-bar {
          height: 9px;
          border-radius: 999px;
          background: #e5e7eb;
          overflow: hidden;
          margin-top: 12px;
        }

        .funded {
          height: 100%;
          border-radius: 999px;
        }

        .green {
          background: #16a34a;
          color: #166534;
        }

        .red {
          background: #dc2626;
          color: #991b1b;
        }

        .status {
          display: inline-flex;
          margin-top: 8px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: #f3f4f6;
        }

        .status.green {
          background: #dcfce7;
        }

        .status.red {
          background: #fee2e2;
        }

        .history-panel {
          border-top: 1px solid #e5e7eb;
          padding: 12px;
          background: white;
        }

        .history-panel h4 {
          margin: 0 0 10px;
          font-size: 15px;
        }

        .empty-history {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .history-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #f1f5f9;
        }

        .history-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .history-row strong {
          display: block;
          font-size: 14px;
        }

        .history-row span {
          display: block;
          color: #6b7280;
          font-size: 12px;
          margin-top: 2px;
        }

        .history-row p {
          margin: 4px 0 0;
          color: #4b5563;
          font-size: 13px;
        }

        .amount-positive {
          color: #166534;
          white-space: nowrap;
        }

        .amount-negative {
          color: #991b1b;
          white-space: nowrap;
        }

        @media (min-width: 720px) {
          .balances-page {
            max-width: 980px;
            margin: 0 auto;
          }

          .summary-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
      `}</style>
    </div>
  );
}