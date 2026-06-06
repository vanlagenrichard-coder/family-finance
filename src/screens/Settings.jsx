import React, { useEffect, useMemo, useState } from "react";
import {
  loadFamilySetup,
  saveFamilySetup,
  watchFamilySetup,
} from "../firebase/setupService";

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

function readStoredData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeStoredData(nextData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
  window.dispatchEvent(new Event("app-data-updated"));
}

function getFamilyId() {
  return localStorage.getItem("familyId");
}

function normalizeBuckets(rawBuckets) {
  const source =
    Array.isArray(rawBuckets) && rawBuckets.length > 0
      ? rawBuckets
      : defaultSetupBuckets;

  return source.map((bucket) => ({
    ...bucket,
    id: bucket.id || makeId("bucket"),
    name: bucket.name ?? "",
    percent: bucket.percent ?? "",
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
      name: subBucket.name ?? "",
      percent: subBucket.percent ?? "",
      monthlyTarget: subBucket.monthlyTarget ?? "",
      archived: subBucket.archived === true,
    })),
  }));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function isTotalValid(value) {
  return Math.round(Number(value || 0) * 100) / 100 === 100;
}

export default function Settings() {
  const [buckets, setBuckets] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");

  useEffect(() => {
    const familyId = getFamilyId();

    async function loadInitialData() {
      const savedData = readStoredData();
      const localBuckets =
        savedData.setupBuckets || savedData.buckets || defaultSetupBuckets;

      if (!familyId) {
        setBuckets(normalizeBuckets(localBuckets));
        setSyncStatus("Using local storage");
        return;
      }

      try {
        const familySetup = await loadFamilySetup(familyId);
        const firestoreBuckets =
          familySetup.setupBuckets?.length > 0
            ? familySetup.setupBuckets
            : familySetup.buckets;

        if (firestoreBuckets?.length > 0) {
          const normalized = normalizeBuckets(firestoreBuckets);

          setBuckets(normalized);

          writeStoredData({
            ...savedData,
            setupBuckets: normalized,
            buckets: normalized,
          });

          setSyncStatus("Synced with Firebase");
        } else {
          const normalized = normalizeBuckets(localBuckets);

          setBuckets(normalized);

          await saveFamilySetup(familyId, normalized);

          writeStoredData({
            ...savedData,
            setupBuckets: normalized,
            buckets: normalized,
          });

          setSyncStatus("Imported setup to Firebase");
        }
      } catch (err) {
        console.error(err);
        setBuckets(normalizeBuckets(localBuckets));
        setSyncStatus("Firebase unavailable, using local backup");
      }
    }

    loadInitialData();

    if (!familyId) return undefined;

    const unsubscribe = watchFamilySetup(familyId, (familySetup) => {
      const nextBuckets =
        familySetup.setupBuckets?.length > 0
          ? familySetup.setupBuckets
          : familySetup.buckets;

      if (!nextBuckets?.length) return;

      const normalized = normalizeBuckets(nextBuckets);
      const savedData = readStoredData();

      setBuckets(normalized);

      writeStoredData({
        ...savedData,
        setupBuckets: normalized,
        buckets: normalized,
      });

      setSyncStatus("Synced with Firebase");
    });

    return unsubscribe;
  }, []);

  const activeBuckets = useMemo(
    () => buckets.filter((bucket) => bucket.archived !== true),
    [buckets]
  );

  const paycheckTotal = activeBuckets.reduce(
    (total, bucket) => total + Number(bucket.percent || 0),
    0
  );

  const saveBuckets = async (nextBuckets) => {
    const existingData = readStoredData();

    const nextData = {
      ...existingData,
      setupBuckets: nextBuckets,
      buckets: nextBuckets,
    };

    writeStoredData(nextData);
    setBuckets(nextBuckets);

    const familyId = getFamilyId();

    if (!familyId) {
      setSyncStatus("Saved locally");
      return;
    }

    try {
      setIsSaving(true);
      setSyncStatus("Saving...");

      await saveFamilySetup(familyId, nextBuckets);

      setSyncStatus("Saved to Firebase");
    } catch (err) {
      console.error(err);
      setSyncStatus("Saved locally, Firebase save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const updateBucket = (bucketId, field, value) => {
    saveBuckets(
      buckets.map((bucket) =>
        bucket.id === bucketId
          ? { ...bucket, [field]: value, archived: bucket.archived === true }
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
          background: #f5f6f7;
          color: #111;
          font-family: Arial, Helvetica, sans-serif;
          display: flex;
          flex-direction: column;
        }

        .setup-header {
          height: 64px;
          background: #fff;
          border-bottom: 1px solid #d9d9d9;
          display: grid;
          grid-template-columns: 64px 1fr 64px;
          align-items: center;
          flex-shrink: 0;
        }

        .menu-button {
          border: none;
          background: transparent;
          color: #087c30;
          font-size: 30px;
          line-height: 1;
          cursor: pointer;
        }

        .setup-title {
          text-align: center;
          font-size: 22px;
          font-weight: 800;
        }

        .setup-content {
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          padding: 16px 16px 96px;
          box-sizing: border-box;
          flex: 1;
        }

        .sync-status {
          margin: 0 0 10px;
          font-size: 13px;
          font-weight: 800;
          color: #087c30;
        }

        .sync-status.saving {
          color: #9a6200;
        }

        .sheet-card {
          background: #fff;
          border: 1px solid #dcdcdc;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
        }

        .table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .setup-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          min-width: 680px;
          font-size: 15px;
        }

        .setup-table th {
          height: 38px;
          background: #fafafa;
          border-right: 1px solid #dfdfdf;
          border-bottom: 1px solid #d6d6d6;
          text-align: center;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.25px;
        }

        .setup-table td {
          height: 34px;
          border-right: 1px solid #e3e3e3;
          border-bottom: 1px solid #e3e3e3;
          padding: 0 9px;
          background: #fff;
          vertical-align: middle;
        }

        .setup-table th:last-child,
        .setup-table td:last-child {
          border-right: none;
        }

        .section-col {
          width: 22%;
        }

        .item-col {
          width: 30%;
        }

        .percent-col {
          width: 17%;
        }

        .target-col {
          width: 18%;
        }

        .actions-col {
          width: 13%;
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
          gap: 2px;
        }

        .actions {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .delete-button {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 3px 6px;
          color: #555;
          font-size: 15px;
          line-height: 1;
        }

        .delete-button:hover {
          color: #b00020;
        }

        .add-row-button {
          border: none;
          background: transparent;
          color: #087c30;
          font: inherit;
          font-weight: 700;
          padding: 0;
          cursor: pointer;
          text-align: left;
          width: 100%;
        }

        .gap-row td {
          height: 12px;
          background: #fff;
          border-bottom: 1px solid #e8e8e8;
        }

        .total-row td {
          background: #eaf8ef;
          color: #087c30;
          font-weight: 800;
        }

        .sub-total-row td {
          background: #f8f8f8;
          color: #555;
          font-size: 13px;
          font-weight: 700;
        }

        .valid {
          color: #087c30;
        }

        .invalid {
          color: #b36b00;
        }

        .warning-panel {
          padding: 12px 16px;
          border-top: 1px solid #e6e6e6;
          background: #fff;
          display: grid;
          gap: 6px;
          font-size: 14px;
        }

        .warning-line {
          color: #9a6200;
        }

        .success-line {
          color: #087c30;
        }

        .bottom-nav {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          height: 76px;
          background: #fff;
          border-top: 1px solid #dedede;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          z-index: 10;
        }

        .nav-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          text-decoration: none;
          color: #555;
          font-size: 14px;
          font-weight: 600;
        }

        .nav-icon {
          font-size: 20px;
          line-height: 1;
        }

        .nav-link.active {
          color: #087c30;
          font-weight: 800;
        }

        @media (max-width: 600px) {
          .setup-header {
            height: 58px;
            grid-template-columns: 54px 1fr 54px;
          }

          .setup-title {
            font-size: 21px;
          }

          .setup-content {
            padding: 10px 8px 92px;
          }

          .sheet-card {
            border-radius: 0;
          }

          .setup-table {
            font-size: 14px;
            min-width: 620px;
          }

          .setup-table td {
            height: 32px;
            padding: 0 7px;
          }

          .bottom-nav {
            height: 72px;
          }
        }
      `}</style>

      <header className="setup-header">
        <button className="menu-button" type="button" aria-label="Menu">
          ≡
        </button>
        <div className="setup-title">Setup</div>
        <div></div>
      </header>

      <main className="setup-content">
        <p className={`sync-status ${isSaving ? "saving" : ""}`}>
          {syncStatus}
        </p>

        <div className="sheet-card">
          <div className="table-scroll">
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
                        />
                        <span>%</span>
                      </div>
                    </td>
                    <td></td>
                    <td>
                      <div className="actions">
                        <button
                          className="delete-button"
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

                <tr>
                  <td>Paycheck</td>
                  <td>
                    <button className="add-row-button" type="button" onClick={addBucket}>
                      + Add bucket
                    </button>
                  </td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>

                <tr className="total-row">
                  <td></td>
                  <td>Paycheck Total</td>
                  <td className={isTotalValid(paycheckTotal) ? "valid" : "invalid"}>
                    {formatPercent(paycheckTotal)}
                  </td>
                  <td></td>
                  <td></td>
                </tr>

                {activeBuckets.map((bucket) => {
                  const activeSubBuckets = (bucket.subBuckets || []).filter(
                    (subBucket) => subBucket.archived !== true
                  );
                  const subTotal = getSubBucketTotal(bucket);

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
                            />
                          </td>
                          <td>
                            <div className="actions">
                              <button
                                className="delete-button"
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
                            className="add-row-button"
                            type="button"
                            onClick={() => addSubBucket(bucket.id)}
                          >
                            + Add item
                          </button>
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>

                      {activeSubBuckets.length > 0 && (
                        <tr className="sub-total-row">
                          <td></td>
                          <td>{bucket.name} Total</td>
                          <td className={isTotalValid(subTotal) ? "valid" : "invalid"}>
                            {formatPercent(subTotal)}
                          </td>
                          <td></td>
                          <td></td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="warning-panel">
            {isTotalValid(paycheckTotal) ? (
              <div className="success-line">Paycheck buckets total 100%.</div>
            ) : (
              <div className="warning-line">
                Paycheck buckets should total 100%. Current total:{" "}
                {formatPercent(paycheckTotal)}
              </div>
            )}

            {activeBuckets.map((bucket) => {
              const activeSubBuckets = (bucket.subBuckets || []).filter(
                (subBucket) => subBucket.archived !== true
              );

              if (activeSubBuckets.length === 0) return null;

              const subTotal = getSubBucketTotal(bucket);

              return isTotalValid(subTotal) ? (
                <div className="success-line" key={`ok-${bucket.id}`}>
                  {bucket.name} sub-buckets total 100%.
                </div>
              ) : (
                <div className="warning-line" key={`warning-${bucket.id}`}>
                  {bucket.name} sub-buckets should total 100%. Current total:{" "}
                  {formatPercent(subTotal)}
                </div>
              );
            })}
          </div>
        </div>
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
          <span className="nav-icon">⌂</span>
          <span>Home</span>
        </a>
      </nav>
    </div>
  );
}