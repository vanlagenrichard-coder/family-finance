import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "family_finance_app_data";

const defaultSetupBuckets = [
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

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePercent(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTarget(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPercent(value) {
  const num = Number(value || 0);
  return `${num.toFixed(2)}%`;
}

function normalizeBuckets(rawBuckets) {
  const source = Array.isArray(rawBuckets) && rawBuckets.length > 0 ? rawBuckets : defaultSetupBuckets;

  return source.map((bucket) => ({
    ...bucket,
    id: bucket.id || makeId("bucket"),
    name: bucket.name || "",
    percent: normalizePercent(bucket.percent),
    archived: bucket.archived === true,
    subBuckets: (
      bucket.subBuckets ||
      bucket.subcategories ||
      bucket.children ||
      bucket.items ||
      []
    ).map((subBucket) => ({
      ...subBucket,
      id: subBucket.id || makeId("sub"),
      name: subBucket.name || "",
      percent: normalizePercent(subBucket.percent),
      monthlyTarget: normalizeTarget(subBucket.monthlyTarget),
      archived: subBucket.archived === true,
    })),
  }));
}

export default function Settings() {
  const [data, setData] = useState({});
  const [buckets, setBuckets] = useState(defaultSetupBuckets);

  useEffect(() => {
    const savedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const savedBuckets = savedData.setupBuckets || savedData.buckets || defaultSetupBuckets;

    setData(savedData);
    setBuckets(normalizeBuckets(savedBuckets));
  }, []);

  const activeBuckets = useMemo(
    () => buckets.filter((bucket) => bucket.archived !== true),
    [buckets]
  );

  const paycheckTotal = activeBuckets.reduce(
    (total, bucket) => total + Number(bucket.percent || 0),
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
        bucket.id === bucketId
          ? {
              ...bucket,
              [field]: field === "percent" ? value : value,
              archived: bucket.archived === true,
            }
          : bucket
      )
    );
  };

  const updateSubBucket = (bucketId, subBucketId, field, value) => {
    saveBuckets(
      buckets.map((bucket) =>
        bucket.id === bucketId
          ? {
              ...bucket,
              subBuckets: (bucket.subBuckets || []).map((subBucket) =>
                subBucket.id === subBucketId
                  ? {
                      ...subBucket,
                      [field]: value,
                      archived: subBucket.archived === true,
                    }
                  : subBucket
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
        id: makeId("bucket"),
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
                ...(bucket.subBuckets || []),
                {
                  id: makeId("sub"),
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

  const deleteSubBucket = (bucketId, subBucketId) => {
    saveBuckets(
      buckets.map((bucket) =>
        bucket.id === bucketId
          ? {
              ...bucket,
              subBuckets: (bucket.subBuckets || []).map((subBucket) =>
                subBucket.id === subBucketId
                  ? { ...subBucket, archived: true }
                  : subBucket
              ),
            }
          : bucket
      )
    );
  };

  const getSubBucketTotal = (bucket) => {
    return (bucket.subBuckets || [])
      .filter((subBucket) => subBucket.archived !== true)
      .reduce((total, subBucket) => total + Number(subBucket.percent || 0), 0);
  };

  return (
    <div className="setup-page">
      <style>{`
        .setup-page {
          min-height: 100vh;
          background: #f4f4f4;
          display: flex;
          justify-content: center;
          font-family: Arial, Helvetica, sans-serif;
          color: #111;
        }

        .setup-shell {
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
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          font-size: 14px;
          font-weight: 700;
        }

        .top-bar {
          height: 58px;
          display: grid;
          grid-template-columns: 60px 1fr 60px;
          align-items: center;
          border-bottom: 1px solid #d9d9d9;
          background: #fff;
        }

        .top-button {
          border: none;
          background: transparent;
          color: #087c30;
          font-size: 28px;
          line-height: 1;
          cursor: pointer;
        }

        .page-title {
          text-align: center;
          font-size: 21px;
          font-weight: 800;
        }

        .sheet-wrap {
          flex: 1;
          overflow: auto;
          padding-bottom: 82px;
        }

        .setup-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 15px;
        }

        .setup-table th {
          height: 34px;
          background: #fafafa;
          border-right: 1px solid #dfdfdf;
          border-bottom: 1px solid #d6d6d6;
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .setup-table td {
          height: 29px;
          border-right: 1px solid #e3e3e3;
          border-bottom: 1px solid #e3e3e3;
          padding: 0 7px;
          background: #fff;
          vertical-align: middle;
        }

        .section-col {
          width: 23%;
        }

        .item-col {
          width: 27%;
        }

        .percent-col {
          width: 17%;
        }

        .target-col {
          width: 18%;
        }

        .actions-col {
          width: 15%;
        }

        .cell-input {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          color: #111;
          font: inherit;
          padding: 0;
        }

        .number-input {
          text-align: right;
        }

        .number-input::-webkit-outer-spin-button,
        .number-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .number-input {
          -moz-appearance: textfield;
        }

        .percent-cell {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 1px;
        }

        .target-cell {
          text-align: right;
        }

        .actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
        }

        .action-button {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 0;
          color: #555;
          font-size: 14px;
          line-height: 1;
        }

        .add-item-button {
          border: none;
          background: transparent;
          color: #087c30;
          font: inherit;
          padding: 0;
          cursor: pointer;
          text-align: left;
          width: 100%;
        }

        .gap-row td {
          height: 12px;
          background: #fff;
        }

        .total-strip {
          min-height: 44px;
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 16px;
          padding: 0 26px;
          border-top: 1px solid #d4eddc;
          background: #eaf8ef;
          color: #087c30;
          font-size: 16px;
          font-weight: 700;
        }

        .warning-strip {
          background: #fff7e6;
          color: #9a6200;
          border-top: 1px solid #f1d39a;
          padding: 8px 18px;
          font-size: 12px;
          line-height: 1.35;
        }

        .bottom-nav {
          position: fixed;
          left: 50%;
          bottom: 0;
          transform: translateX(-50%);
          width: 100%;
          max-width: 430px;
          height: 76px;
          background: #fff;
          border-top: 1px solid #dedede;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }

        .nav-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          text-decoration: none;
          color: #555;
          font-size: 15px;
          font-weight: 500;
        }

        .nav-icon {
          font-size: 21px;
          line-height: 1;
        }

        .nav-link.active {
          color: #087c30;
          font-weight: 800;
        }
      `}</style>

      <div className="setup-shell">
        <div className="status-bar">
          <span>9:41</span>
          <span>▮▮▮ ᯤ 100</span>
        </div>

        <header className="top-bar">
          <button className="top-button" type="button" aria-label="Menu">
            ≡
          </button>
          <div className="page-title">Setup</div>
          <button className="top-button" type="button" onClick={addBucket} aria-label="Add bucket">
            +
          </button>
        </header>

        <main className="sheet-wrap">
          <table className="setup-table">
            <thead>
              <tr>
                <th className="section-col">SECTION</th>
                <th className="item-col">ITEM</th>
                <th className="percent-col">PERCENT</th>
                <th className="target-col">TARGET</th>
                <th className="actions-col">ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {activeBuckets.map((bucket) => (
                <tr key={`paycheck-${bucket.id}`}>
                  <td>Paycheck</td>
                  <td>
                    <input
                      className="cell-input"
                      value={bucket.name}
                      onChange={(event) =>
                        updateBucket(bucket.id, "name", event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <div className="percent-cell">
                      <input
                        className="cell-input number-input"
                        type="number"
                        value={bucket.percent}
                        onChange={(event) =>
                          updateBucket(bucket.id, "percent", event.target.value)
                        }
                        onBlur={(event) =>
                          updateBucket(
                            bucket.id,
                            "percent",
                            normalizePercent(event.target.value)
                          )
                        }
                      />
                      <span>%</span>
                    </div>
                  </td>
                  <td></td>
                  <td>
                    <div className="actions">
                      <button className="action-button" type="button" title="Edit">
                        ✎
                      </button>
                      <button
                        className="action-button"
                        type="button"
                        title="Delete"
                        onClick={() => deleteBucket(bucket.id)}
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {activeBuckets.map((bucket) => {
                const activeSubBuckets = (bucket.subBuckets || []).filter(
                  (subBucket) => subBucket.archived !== true
                );

                return (
                  <React.Fragment key={`section-${bucket.id}`}>
                    <tr className="gap-row">
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>

                    {activeSubBuckets.map((subBucket) => (
                      <tr key={subBucket.id}>
                        <td>{bucket.name}</td>
                        <td>
                          <input
                            className="cell-input"
                            value={subBucket.name}
                            onChange={(event) =>
                              updateSubBucket(
                                bucket.id,
                                subBucket.id,
                                "name",
                                event.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <div className="percent-cell">
                            <input
                              className="cell-input number-input"
                              type="number"
                              value={subBucket.percent}
                              onChange={(event) =>
                                updateSubBucket(
                                  bucket.id,
                                  subBucket.id,
                                  "percent",
                                  event.target.value
                                )
                              }
                              onBlur={(event) =>
                                updateSubBucket(
                                  bucket.id,
                                  subBucket.id,
                                  "percent",
                                  normalizePercent(event.target.value)
                                )
                              }
                            />
                            <span>%</span>
                          </div>
                        </td>
                        <td>
                          <input
                            className="cell-input number-input"
                            type="number"
                            value={subBucket.monthlyTarget}
                            onChange={(event) =>
                              updateSubBucket(
                                bucket.id,
                                subBucket.id,
                                "monthlyTarget",
                                event.target.value
                              )
                            }
                            onBlur={(event) =>
                              updateSubBucket(
                                bucket.id,
                                subBucket.id,
                                "monthlyTarget",
                                normalizeTarget(event.target.value)
                              )
                            }
                          />
                        </td>
                        <td>
                          <div className="actions">
                            <button className="action-button" type="button" title="Edit">
                              ✎
                            </button>
                            <button
                              className="action-button"
                              type="button"
                              title="Delete"
                              onClick={() => deleteSubBucket(bucket.id, subBucket.id)}
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    <tr>
                      <td>{bucket.name}</td>
                      <td>
                        <button
                          className="add-item-button"
                          type="button"
                          onClick={() => addSubBucket(bucket.id)}
                        >
                          + Add item
                        </button>
                      </td>
                      <td>{formatPercent(getSubBucketTotal(bucket))}</td>
                      <td></td>
                      <td></td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          <div className="total-strip">
            <span>Paycheck Total</span>
            <span>{formatPercent(paycheckTotal)}</span>
          </div>

          {Math.round(paycheckTotal * 100) / 100 !== 100 && (
            <div className="warning-strip">
              Paycheck buckets should total 100%.
            </div>
          )}

          {activeBuckets
            .filter((bucket) => {
              const activeSubBuckets = (bucket.subBuckets || []).filter(
                (subBucket) => subBucket.archived !== true
              );
              if (activeSubBuckets.length === 0) return false;
              return Math.round(getSubBucketTotal(bucket) * 100) / 100 !== 100;
            })
            .map((bucket) => (
              <div className="warning-strip" key={`warning-${bucket.id}`}>
                {bucket.name} sub-buckets should total 100%. Current total:{" "}
                {formatPercent(getSubBucketTotal(bucket))}
              </div>
            ))}
        </main>

        <nav className="bottom-nav">
          <a className="nav-link" href="/history">
            <span className="nav-icon">▤</span>
            <span>History</span>
          </a>
          <a className="nav-link" href="/balances">
            <span className="nav-icon">▥</span>
            <span>Balances</span>
          </a>
          <a className="nav-link active" href="/setup">
            <span className="nav-icon">⚙</span>
            <span>Setup</span>
          </a>
          <a className="nav-link" href="/">
            <span className="nav-icon">•••</span>
            <span>Home</span>
          </a>
        </nav>
      </div>
    </div>
  );
}