import React, { useEffect, useMemo, useState } from "react";
import {
  FaBars,
  FaPlus,
  FaPen,
  FaTrashAlt,
  FaHistory,
  FaWallet,
  FaCog,
  FaEllipsisH,
} from "react-icons/fa";

const STORAGE_KEY = "budgetAppData";

const starterBuckets = [
  {
    id: "bills",
    name: "Bills",
    percent: 55,
    archived: false,
    subBuckets: [
      { id: "mortgage", name: "Mortgage", percent: 55.2, monthlyTarget: 2000, archived: false },
      { id: "natural-gas", name: "Natural Gas", percent: 9.5, monthlyTarget: 349.22, archived: false },
      { id: "hydro", name: "Hydro", percent: 8.9, monthlyTarget: 325.57, archived: false },
      { id: "house-insurance", name: "House Insurance", percent: 7.6, monthlyTarget: 279.43, archived: false },
      { id: "property-tax", name: "Property tax", percent: 6.8, monthlyTarget: 3017.59, archived: false },
      { id: "car-insurance", name: "Car Insurance", percent: 5.3, monthlyTarget: 196.85, archived: false },
      { id: "internet", name: "Internet", percent: 2.8, monthlyTarget: 104.04, archived: false },
      { id: "phone", name: "Phone", percent: 2.7, monthlyTarget: 97.6, archived: false },
      { id: "bank-fee", name: "Bank Fee", percent: 0.1, monthlyTarget: 17.95, archived: false },
      { id: "netflix", name: "Netflix", percent: 0.5, monthlyTarget: 7.99, archived: false },
    ],
  },
  {
    id: "savings",
    name: "Savings",
    percent: 10,
    archived: false,
    subBuckets: [
      { id: "emergency", name: "Emergency", percent: 40, monthlyTarget: 10000, archived: false },
      { id: "holiday", name: "Holiday", percent: 10, monthlyTarget: 5000, archived: false },
      { id: "vehicle", name: "Vehicle", percent: 25, monthlyTarget: 500, archived: false },
      { id: "home", name: "Home", percent: 25, monthlyTarget: "", archived: false },
    ],
  },
  {
    id: "giving",
    name: "Giving",
    percent: 5,
    archived: false,
    subBuckets: [
      { id: "church", name: "Church", percent: 100, monthlyTarget: "", archived: false },
    ],
  },
  {
    id: "spending",
    name: "Spending",
    percent: 30,
    archived: false,
    subBuckets: [
      { id: "family", name: "Family", percent: 57, monthlyTarget: "", archived: false },
      { id: "wife", name: "Wife", percent: 17.5, monthlyTarget: "", archived: false },
      { id: "me", name: "Me", percent: 17.5, monthlyTarget: "", archived: false },
      { id: "kids", name: "Kids", percent: 8, monthlyTarget: "", archived: false },
    ],
  },
];

function money(value) {
  if (value === "" || value === null || value === undefined) return "";
  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function percent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function normalizeBuckets(rawBuckets) {
  return (rawBuckets || starterBuckets).map((bucket) => ({
    ...bucket,
    id: bucket.id || `bucket-${Date.now()}-${Math.random()}`,
    name: bucket.name || "",
    percent: bucket.percent ?? 0,
    archived: bucket.archived ?? false,
    subBuckets: (bucket.subBuckets || []).map((sub) => ({
      ...sub,
      id: sub.id || `sub-${Date.now()}-${Math.random()}`,
      name: sub.name || "",
      percent: sub.percent ?? 0,
      monthlyTarget: sub.monthlyTarget ?? "",
      archived: sub.archived ?? false,
    })),
  }));
}

export default function Settings() {
  const [data, setData] = useState({});
  const [buckets, setBuckets] = useState(starterBuckets);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const savedBuckets = saved.setupBuckets || saved.buckets || starterBuckets;

    setData(saved);
    setBuckets(normalizeBuckets(savedBuckets));
  }, []);

  const activeBuckets = useMemo(
    () => buckets.filter((bucket) => !bucket.archived),
    [buckets]
  );

  const paycheckTotal = activeBuckets.reduce(
    (sum, bucket) => sum + Number(bucket.percent || 0),
    0
  );

  const saveBuckets = (nextBuckets) => {
    const nextData = {
      ...data,
      setupBuckets: nextBuckets,
      buckets: nextBuckets,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    setData(nextData);
    setBuckets(nextBuckets);
  };

  const updateBucket = (bucketId, field, value) => {
    saveBuckets(
      buckets.map((bucket) =>
        bucket.id === bucketId ? { ...bucket, [field]: value } : bucket
      )
    );
  };

  const updateSubBucket = (bucketId, subId, field, value) => {
    saveBuckets(
      buckets.map((bucket) =>
        bucket.id === bucketId
          ? {
              ...bucket,
              subBuckets: bucket.subBuckets.map((sub) =>
                sub.id === subId ? { ...sub, [field]: value } : sub
              ),
            }
          : bucket
      )
    );
  };

  const addBucket = () => {
    saveBuckets([
      ...buckets,
      {
        id: `bucket-${Date.now()}`,
        name: "New Bucket",
        percent: 0,
        archived: false,
        subBuckets: [],
      },
    ]);
  };

  const addSubBucket = (bucketId) => {
    saveBuckets(
      buckets.map((bucket) =>
        bucket.id === bucketId
          ? {
              ...bucket,
              subBuckets: [
                ...bucket.subBuckets,
                {
                  id: `sub-${Date.now()}`,
                  name: "New Item",
                  percent: 0,
                  monthlyTarget: "",
                  archived: false,
                },
              ],
            }
          : bucket
      )
    );
  };

  const deleteBucket = (bucketId) => {
    saveBuckets(
      buckets.map((bucket) =>
        bucket.id === bucketId ? { ...bucket, archived: true } : bucket
      )
    );
  };

  const deleteSubBucket = (bucketId, subId) => {
    saveBuckets(
      buckets.map((bucket) =>
        bucket.id === bucketId
          ? {
              ...bucket,
              subBuckets: bucket.subBuckets.map((sub) =>
                sub.id === subId ? { ...sub, archived: true } : sub
              ),
            }
          : bucket
      )
    );
  };

  return (
    <div className="phone-page">
      <style>{`
        .phone-page {
          min-height: 100vh;
          background: #f4f4f4;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          font-family: Arial, Helvetica, sans-serif;
          color: #111;
        }

        .phone-shell {
          width: 100%;
          max-width: 430px;
          min-height: 100vh;
          background: #fff;
          display: flex;
          flex-direction: column;
        }

        .status-bar {
          height: 34px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 24px;
          font-size: 14px;
          font-weight: 700;
        }

        .status-icons {
          font-size: 12px;
          letter-spacing: 2px;
        }

        .top-bar {
          height: 58px;
          display: grid;
          grid-template-columns: 60px 1fr 60px;
          align-items: center;
          border-bottom: 1px solid #d9d9d9;
        }

        .top-icon {
          border: 0;
          background: transparent;
          color: #087c30;
          font-size: 22px;
          cursor: pointer;
        }

        .page-title {
          text-align: center;
          font-size: 21px;
          font-weight: 800;
        }

        .sheet {
          flex: 1;
          overflow: auto;
          padding-bottom: 82px;
        }

        .grid {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 17px;
        }

        .grid th {
          height: 32px;
          background: #fafafa;
          border-bottom: 1px solid #dcdcdc;
          border-right: 1px solid #e1e1e1;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: .3px;
          text-align: center;
        }

        .grid td {
          height: 27px;
          border-bottom: 1px solid #e1e1e1;
          border-right: 1px solid #e6e6e6;
          padding: 0 8px;
          background: #fff;
          vertical-align: middle;
        }

        .section-col { width: 29%; }
        .item-col { width: 35%; }
        .percent-col { width: 25%; }
        .action-col { width: 11%; }

        .cell-input {
          width: 100%;
          border: 0;
          outline: none;
          background: transparent;
          font: inherit;
          color: #111;
        }

        .percent-input {
          text-align: right;
        }

        .actions {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 13px;
          color: #555;
          font-size: 13px;
        }

        .action-button {
          border: 0;
          background: transparent;
          color: #555;
          cursor: pointer;
          padding: 0;
          font-size: 13px;
        }

        .gap-row td {
          height: 12px;
          background: #fff;
          border-bottom: 1px solid #e8e8e8;
        }

        .footer-total {
          height: 44px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: center;
          padding: 0 28px 0 58px;
          background: #eaf8ef;
          border-top: 1px solid #d4eddc;
          color: #087c30;
          font-size: 16px;
          font-weight: 700;
        }

        .footer-total span:last-child {
          text-align: right;
        }

        .bottom-nav {
          height: 76px;
          background: #fff;
          border-top: 1px solid #e0e0e0;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 430px;
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 5px;
          color: #555;
          font-size: 16px;
          text-decoration: none;
          font-weight: 500;
        }

        .nav-item svg {
          font-size: 20px;
        }

        .nav-item.active {
          color: #087c30;
          font-weight: 700;
        }
      `}</style>

      <div className="phone-shell">
        <div className="status-bar">
          <span>9:41</span>
          <span className="status-icons">▮▮▮ ᯤ 100</span>
        </div>

        <div className="top-bar">
          <button className="top-icon" type="button">
            <FaBars />
          </button>
          <div className="page-title">Setup</div>
          <button className="top-icon" type="button" onClick={addBucket}>
            <FaPlus />
          </button>
        </div>

        <div className="sheet">
          <table className="grid">
            <thead>
              <tr>
                <th className="section-col">SECTION</th>
                <th className="item-col">ITEM</th>
                <th className="percent-col">PERCENT</th>
                <th className="action-col"></th>
              </tr>
            </thead>

            <tbody>
              {activeBuckets.map((bucket, bucketIndex) => (
                <React.Fragment key={bucket.id}>
                  {bucketIndex > 0 && (
                    <tr className="gap-row">
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  )}

                  <tr>
                    <td>Paycheck</td>
                    <td>
                      <input
                        className="cell-input"
                        value={bucket.name}
                        onChange={(e) =>
                          updateBucket(bucket.id, "name", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="cell-input percent-input"
                        type="number"
                        value={bucket.percent}
                        onChange={(e) =>
                          updateBucket(bucket.id, "percent", e.target.value)
                        }
                        onBlur={(e) =>
                          updateBucket(
                            bucket.id,
                            "percent",
                            Number(e.target.value || 0)
                          )
                        }
                      />
                    </td>
                    <td>
                      <div className="actions">
                        <button className="action-button" type="button">
                          <FaPen />
                        </button>
                        <button
                          className="action-button"
                          type="button"
                          onClick={() => deleteBucket(bucket.id)}
                        >
                          <FaTrashAlt />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {(bucket.subBuckets || [])
                    .filter((sub) => !sub.archived)
                    .map((sub) => (
                      <tr key={sub.id}>
                        <td>{bucket.name}</td>
                        <td>
                          <input
                            className="cell-input"
                            value={sub.name}
                            onChange={(e) =>
                              updateSubBucket(
                                bucket.id,
                                sub.id,
                                "name",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="cell-input percent-input"
                            type="number"
                            value={sub.percent}
                            onChange={(e) =>
                              updateSubBucket(
                                bucket.id,
                                sub.id,
                                "percent",
                                e.target.value
                              )
                            }
                            onBlur={(e) =>
                              updateSubBucket(
                                bucket.id,
                                sub.id,
                                "percent",
                                Number(e.target.value || 0)
                              )
                            }
                          />
                        </td>
                        <td>
                          <div className="actions">
                            <button className="action-button" type="button">
                              <FaPen />
                            </button>
                            <button
                              className="action-button"
                              type="button"
                              onClick={() => deleteSubBucket(bucket.id, sub.id)}
                            >
                              <FaTrashAlt />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  <tr>
                    <td>{bucket.name}</td>
                    <td>
                      <button
                        className="cell-input"
                        type="button"
                        onClick={() => addSubBucket(bucket.id)}
                        style={{ color: "#087c30", textAlign: "left" }}
                      >
                        + Add item
                      </button>
                    </td>
                    <td></td>
                    <td></td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>

          <div className="footer-total">
            <span>Paycheck Total</span>
            <span>{percent(paycheckTotal)}</span>
          </div>
        </div>

        <nav className="bottom-nav">
          <a className="nav-item" href="/history">
            <FaHistory />
            <span>History</span>
          </a>
          <a className="nav-item" href="/balances">
            <FaWallet />
            <span>Balances</span>
          </a>
          <a className="nav-item active" href="/settings">
            <FaCog />
            <span>Setup</span>
          </a>
          <a className="nav-item" href="/more">
            <FaEllipsisH />
            <span>More</span>
          </a>
        </nav>
      </div>
    </div>
  );
}