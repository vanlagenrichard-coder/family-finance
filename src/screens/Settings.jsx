import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData, saveData, updateData } from "../services/storage";

const DEFAULT_SETUP = {
  paycheckSplit: [
    { id: "bills", name: "Bills", percent: 55, archived: false },
    { id: "savings", name: "Savings", percent: 10, archived: false },
    { id: "giving", name: "Giving", percent: 5, archived: false },
    { id: "spending", name: "Spending", percent: 30, archived: false },
  ],
  bucketGroups: {
    bills: {
      name: "Bills",
      archived: false,
      subBuckets: [
        {
          id: "mortgage",
          name: "Mortgage",
          percent: 45,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          archived: false,
        },
        {
          id: "natural-gas",
          name: "Natural Gas",
          percent: 5,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          archived: false,
        },
        {
          id: "hydro",
          name: "Hydro",
          percent: 5,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          archived: false,
        },
        {
          id: "house-insurance",
          name: "House Insurance",
          percent: 5,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          archived: false,
        },
        {
          id: "property-tax",
          name: "Property Tax",
          percent: 10,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "yearly",
          archived: false,
        },
        {
          id: "car-insurance",
          name: "Car Insurance",
          percent: 8,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          archived: false,
        },
        {
          id: "internet",
          name: "Internet",
          percent: 5,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          archived: false,
        },
        {
          id: "phone",
          name: "Phone",
          percent: 5,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          archived: false,
        },
        {
          id: "bank-fee",
          name: "Bank Fee",
          percent: 1,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          archived: false,
        },
        {
          id: "netflix",
          name: "Netflix",
          percent: 1,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          archived: false,
        },
        {
          id: "bills-buffer",
          name: "Bills Buffer",
          percent: 10,
          monthlyTarget: 0,
          dueDate: "",
          frequency: "monthly",
          archived: false,
          isBuffer: true,
        },
      ],
    },
    savings: {
      name: "Savings",
      archived: false,
      subBuckets: [
        { id: "emergency", name: "Emergency", percent: 20, archived: false },
        { id: "holiday", name: "Holiday", percent: 50, archived: false },
        { id: "home", name: "Home", percent: 30, archived: false },
      ],
    },
    giving: {
      name: "Giving",
      archived: false,
      subBuckets: [
        { id: "church", name: "Church", percent: 100, archived: false },
      ],
    },
    spending: {
      name: "Spending",
      archived: false,
      subBuckets: [
        { id: "family", name: "Family", percent: 55, archived: false },
        { id: "wife", name: "Wife", percent: 15, archived: false },
        { id: "me", name: "Me", percent: 15, archived: false },
        { id: "kids", name: "Kids", percent: 15, archived: false },
      ],
    },
  },
  incomePlanning: {
    baselineWorkChequeAmount: 1200,
    babyBonusExpectedAmount: 0,
    babyBonusExpectedDay: "",
    extraIncomeRule: {
      enabled: true,
      normalSplitLimit: 1200,
      extraSplit: [
        { id: "bills", name: "Bills", percent: 0, archived: false },
        { id: "savings", name: "Savings", percent: 100, archived: false },
        { id: "giving", name: "Giving", percent: 0, archived: false },
        { id: "spending", name: "Spending", percent: 0, archived: false },
      ],
    },
  },
};

function makeId(name) {
  return `${name || "item"}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .concat(`-${Date.now()}`);
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function activeItems(items) {
  return items.filter((item) => !item.archived);
}

function totalPercent(items) {
  return activeItems(items).reduce(
    (sum, item) => sum + numberValue(item.percent),
    0
  );
}

function isValidTotal(total) {
  return Math.abs(total - 100) < 0.01;
}

function mergeSetup(existingSetup) {
  const setup = existingSetup || {};

  return {
    ...DEFAULT_SETUP,
    ...setup,
    paycheckSplit: setup.paycheckSplit || DEFAULT_SETUP.paycheckSplit,
    bucketGroups: {
      ...DEFAULT_SETUP.bucketGroups,
      ...(setup.bucketGroups || {}),
    },
    incomePlanning: {
      ...DEFAULT_SETUP.incomePlanning,
      ...(setup.incomePlanning || {}),
      extraIncomeRule: {
        ...DEFAULT_SETUP.incomePlanning.extraIncomeRule,
        ...((setup.incomePlanning && setup.incomePlanning.extraIncomeRule) ||
          {}),
        extraSplit:
          (setup.incomePlanning &&
            setup.incomePlanning.extraIncomeRule &&
            setup.incomePlanning.extraIncomeRule.extraSplit) ||
          DEFAULT_SETUP.incomePlanning.extraIncomeRule.extraSplit,
      },
    },
  };
}

export default function Setup() {
  const [setup, setSetup] = useState(DEFAULT_SETUP);
  const [savedMessage, setSavedMessage] = useState("");
  const [newBucketName, setNewBucketName] = useState("");
  const [newSubBucketNames, setNewSubBucketNames] = useState({});

  useEffect(() => {
    const data = loadData();
    const mergedSetup = mergeSetup(data.setup);
    setSetup(mergedSetup);

    if (!data.setup) {
      saveData({
        ...data,
        setup: mergedSetup,
      });
    }
  }, []);

  const validation = useMemo(() => {
    const paycheckTotal = totalPercent(setup.paycheckSplit);
    const billsTotal = totalPercent(setup.bucketGroups.bills.subBuckets);
    const savingsTotal = totalPercent(setup.bucketGroups.savings.subBuckets);
    const givingTotal = totalPercent(setup.bucketGroups.giving.subBuckets);
    const spendingTotal = totalPercent(setup.bucketGroups.spending.subBuckets);
    const extraTotal = totalPercent(
      setup.incomePlanning.extraIncomeRule.extraSplit
    );

    return {
      paycheckTotal,
      billsTotal,
      savingsTotal,
      givingTotal,
      spendingTotal,
      extraTotal,
      valid:
        isValidTotal(paycheckTotal) &&
        isValidTotal(billsTotal) &&
        isValidTotal(savingsTotal) &&
        isValidTotal(givingTotal) &&
        isValidTotal(spendingTotal) &&
        isValidTotal(extraTotal),
    };
  }, [setup]);

  function updatePaycheckItem(id, field, value) {
    setSetup((current) => ({
      ...current,
      paycheckSplit: current.paycheckSplit.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === "percent" ? numberValue(value) : value,
            }
          : item
      ),
    }));
  }

  function updateExtraSplitItem(id, value) {
    setSetup((current) => ({
      ...current,
      incomePlanning: {
        ...current.incomePlanning,
        extraIncomeRule: {
          ...current.incomePlanning.extraIncomeRule,
          extraSplit: current.incomePlanning.extraIncomeRule.extraSplit.map(
            (item) =>
              item.id === id ? { ...item, percent: numberValue(value) } : item
          ),
        },
      },
    }));
  }

  function updateGroupName(groupId, value) {
    setSetup((current) => ({
      ...current,
      bucketGroups: {
        ...current.bucketGroups,
        [groupId]: {
          ...current.bucketGroups[groupId],
          name: value,
        },
      },
      paycheckSplit: current.paycheckSplit.map((item) =>
        item.id === groupId ? { ...item, name: value } : item
      ),
      incomePlanning: {
        ...current.incomePlanning,
        extraIncomeRule: {
          ...current.incomePlanning.extraIncomeRule,
          extraSplit: current.incomePlanning.extraIncomeRule.extraSplit.map(
            (item) => (item.id === groupId ? { ...item, name: value } : item)
          ),
        },
      },
    }));
  }

  function archiveGroup(groupId) {
    setSetup((current) => ({
      ...current,
      bucketGroups: {
        ...current.bucketGroups,
        [groupId]: {
          ...current.bucketGroups[groupId],
          archived: true,
        },
      },
      paycheckSplit: current.paycheckSplit.map((item) =>
        item.id === groupId ? { ...item, archived: true, percent: 0 } : item
      ),
      incomePlanning: {
        ...current.incomePlanning,
        extraIncomeRule: {
          ...current.incomePlanning.extraIncomeRule,
          extraSplit: current.incomePlanning.extraIncomeRule.extraSplit.map(
            (item) =>
              item.id === groupId
                ? { ...item, archived: true, percent: 0 }
                : item
          ),
        },
      },
    }));
  }

  function addBucket() {
    const name = newBucketName.trim();

    if (!name) return;

    const id = makeId(name);

    setSetup((current) => ({
      ...current,
      paycheckSplit: [
        ...current.paycheckSplit,
        { id, name, percent: 0, archived: false },
      ],
      bucketGroups: {
        ...current.bucketGroups,
        [id]: {
          name,
          archived: false,
          subBuckets: [
            {
              id: makeId(`${name}-general`),
              name: "General",
              percent: 100,
              archived: false,
            },
          ],
        },
      },
      incomePlanning: {
        ...current.incomePlanning,
        extraIncomeRule: {
          ...current.incomePlanning.extraIncomeRule,
          extraSplit: [
            ...current.incomePlanning.extraIncomeRule.extraSplit,
            { id, name, percent: 0, archived: false },
          ],
        },
      },
    }));

    setNewBucketName("");
  }

  function updateSubBucket(groupId, subBucketId, field, value) {
    setSetup((current) => ({
      ...current,
      bucketGroups: {
        ...current.bucketGroups,
        [groupId]: {
          ...current.bucketGroups[groupId],
          subBuckets: current.bucketGroups[groupId].subBuckets.map(
            (subBucket) => {
              if (subBucket.id !== subBucketId) return subBucket;

              const numberFields = ["percent", "monthlyTarget"];

              return {
                ...subBucket,
                [field]: numberFields.includes(field)
                  ? numberValue(value)
                  : value,
              };
            }
          ),
        },
      },
    }));
  }

  function archiveSubBucket(groupId, subBucketId) {
    setSetup((current) => ({
      ...current,
      bucketGroups: {
        ...current.bucketGroups,
        [groupId]: {
          ...current.bucketGroups[groupId],
          subBuckets: current.bucketGroups[groupId].subBuckets.map(
            (subBucket) =>
              subBucket.id === subBucketId
                ? { ...subBucket, archived: true, percent: 0 }
                : subBucket
          ),
        },
      },
    }));
  }

  function addSubBucket(groupId) {
    const name = (newSubBucketNames[groupId] || "").trim();

    if (!name) return;

    setSetup((current) => ({
      ...current,
      bucketGroups: {
        ...current.bucketGroups,
        [groupId]: {
          ...current.bucketGroups[groupId],
          subBuckets: [
            ...current.bucketGroups[groupId].subBuckets,
            {
              id: makeId(name),
              name,
              percent: 0,
              monthlyTarget: groupId === "bills" ? 0 : undefined,
              dueDate: groupId === "bills" ? "" : undefined,
              frequency: groupId === "bills" ? "monthly" : undefined,
              archived: false,
            },
          ],
        },
      },
    }));

    setNewSubBucketNames((current) => ({
      ...current,
      [groupId]: "",
    }));
  }

  function updateIncomePlanning(field, value) {
    setSetup((current) => ({
      ...current,
      incomePlanning: {
        ...current.incomePlanning,
        [field]: field === "babyBonusExpectedDay" ? value : numberValue(value),
      },
    }));
  }

  function updateExtraIncomeRule(field, value) {
    setSetup((current) => ({
      ...current,
      incomePlanning: {
        ...current.incomePlanning,
        extraIncomeRule: {
          ...current.incomePlanning.extraIncomeRule,
          [field]: field === "enabled" ? value : numberValue(value),
        },
      },
    }));
  }

  function handleSave() {
    if (!validation.valid) return;

    updateData((currentData) => ({
      ...currentData,
      setup,
    }));

    setSavedMessage("Setup saved. Future paychecks will use these rules.");
    window.setTimeout(() => setSavedMessage(""), 3000);
  }

  function TotalBadge({ total }) {
    const valid = isValidTotal(total);

    return (
      <span className={`total-badge ${valid ? "valid" : "invalid"}`}>
        {total.toFixed(2).replace(".00", "")}% / 100%
      </span>
    );
  }

  function PercentCard({ title, total, children }) {
    return (
      <section className="setup-card">
        <div className="card-header">
          <h2>{title}</h2>
          <TotalBadge total={total} />
        </div>
        {children}
      </section>
    );
  }

  const activeGroups = Object.entries(setup.bucketGroups).filter(
    ([, group]) => !group.archived
  );

  return (
    <main className="setup-page">
      <style>{`
        .setup-page {
          min-height: 100vh;
          background: #f5f7fb;
          color: #172033;
          padding: 16px;
          box-sizing: border-box;
        }

        .setup-wrap {
          width: 100%;
          max-width: 860px;
          margin: 0 auto;
        }

        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .home-link {
          color: white;
          background: #172033;
          border-radius: 12px;
          padding: 10px 14px;
          text-decoration: none;
          font-weight: 700;
          font-size: 14px;
        }

        h1 {
          margin: 0;
          font-size: 28px;
        }

        h2 {
          margin: 0;
          font-size: 19px;
        }

        h3 {
          margin: 0 0 10px;
          font-size: 16px;
        }

        .subtitle {
          margin: 6px 0 0;
          color: #5d687b;
          font-size: 14px;
          line-height: 1.4;
        }

        .setup-card {
          background: white;
          border-radius: 18px;
          padding: 16px;
          margin-bottom: 14px;
          box-shadow: 0 8px 24px rgba(23, 32, 51, 0.08);
          border: 1px solid #e4e8f0;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 14px;
        }

        .total-badge {
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .total-badge.valid {
          background: #dcfce7;
          color: #166534;
        }

        .total-badge.invalid {
          background: #fee2e2;
          color: #991b1b;
        }

        .row {
          display: grid;
          grid-template-columns: 1fr 96px;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
        }

        .bucket-row {
          display: grid;
          grid-template-columns: 1fr 90px;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
        }

        .bill-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          padding: 12px;
          margin-bottom: 10px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #e4e8f0;
        }

        .bill-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          color: #5d687b;
          margin-bottom: 5px;
        }

        input,
        select {
          width: 100%;
          min-height: 42px;
          border-radius: 12px;
          border: 1px solid #cfd6e3;
          padding: 9px 10px;
          box-sizing: border-box;
          font-size: 16px;
          background: white;
          color: #172033;
        }

        input:disabled {
          background: #f1f5f9;
          color: #64748b;
        }

        input:focus,
        select:focus {
          outline: 2px solid #93c5fd;
          border-color: #2563eb;
        }

        .small-button,
        .danger-button,
        .save-button {
          min-height: 42px;
          border: 0;
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .small-button {
          background: #e0ecff;
          color: #1d4ed8;
        }

        .danger-button {
          background: #fee2e2;
          color: #991b1b;
        }

        .save-button {
          width: 100%;
          background: #166534;
          color: white;
          font-size: 16px;
          margin-top: 4px;
        }

        .save-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .add-row {
          display: grid;
          grid-template-columns: 1fr 90px;
          gap: 10px;
          margin-top: 12px;
        }

        .section-divider {
          height: 1px;
          background: #e4e8f0;
          margin: 14px 0;
        }

        .income-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .toggle-row input {
          width: 24px;
          min-height: 24px;
        }

        .save-message {
          background: #dcfce7;
          color: #166534;
          border-radius: 12px;
          padding: 10px;
          font-weight: 800;
          margin-top: 10px;
          text-align: center;
        }

        .warning {
          background: #fee2e2;
          color: #991b1b;
          border-radius: 12px;
          padding: 10px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        @media (min-width: 720px) {
          .income-grid {
            grid-template-columns: 1fr 1fr;
          }

          .bill-row {
            grid-template-columns: 1.2fr 1fr;
            align-items: end;
          }
        }
      `}</style>

      <div className="setup-wrap">
        <div className="top-bar">
          <div>
            <h1>Setup</h1>
            <p className="subtitle">
              Rules only. These settings affect future paychecks and future
              entries only.
            </p>
          </div>
          <Link className="home-link" to="/">
            Home
          </Link>
        </div>

        {!validation.valid && (
          <div className="warning">
            Every active percentage group must equal 100% before saving.
          </div>
        )}

        <PercentCard title="Paycheck Split" total={validation.paycheckTotal}>
          {activeItems(setup.paycheckSplit).map((item) => (
            <div className="row" key={item.id}>
              <input
                value={item.name}
                onChange={(event) => updateGroupName(item.id, event.target.value)}
                aria-label={`${item.name} name`}
              />
              <input
                type="number"
                value={item.percent}
                onChange={(event) =>
                  updatePaycheckItem(item.id, "percent", event.target.value)
                }
                aria-label={`${item.name} percent`}
              />
            </div>
          ))}
        </PercentCard>

        <section className="setup-card">
          <div className="card-header">
            <h2>Bucket Management</h2>
          </div>

          {activeGroups.map(([groupId, group]) => (
            <div className="bucket-row" key={groupId}>
              <input
                value={group.name}
                onChange={(event) => updateGroupName(groupId, event.target.value)}
                aria-label={`${group.name} bucket name`}
              />
              <button
                className="danger-button"
                type="button"
                onClick={() => archiveGroup(groupId)}
              >
                Archive
              </button>
            </div>
          ))}

          <div className="add-row">
            <input
              value={newBucketName}
              onChange={(event) => setNewBucketName(event.target.value)}
              placeholder="New bucket name"
              aria-label="New bucket name"
            />
            <button className="small-button" type="button" onClick={addBucket}>
              Add
            </button>
          </div>
        </section>

        {activeGroups.map(([groupId, group]) => {
          const total = totalPercent(group.subBuckets);
          const isBillsGroup = groupId === "bills";

          return (
            <PercentCard key={groupId} title={`${group.name} Split`} total={total}>
              {activeItems(group.subBuckets).map((subBucket) =>
                isBillsGroup ? (
                  <div className="bill-row" key={subBucket.id}>
                    <div>
                      <label className="label">Bill Name</label>
                      <input
                        value={subBucket.name}
                        onChange={(event) =>
                          updateSubBucket(
                            groupId,
                            subBucket.id,
                            "name",
                            event.target.value
                          )
                        }
                        aria-label={`${subBucket.name} name`}
                      />
                    </div>

                    <div className="bill-grid">
                      <div>
                        <label className="label">Percent</label>
                        <input
                          type="number"
                          value={subBucket.percent}
                          onChange={(event) =>
                            updateSubBucket(
                              groupId,
                              subBucket.id,
                              "percent",
                              event.target.value
                            )
                          }
                          aria-label={`${subBucket.name} percent`}
                        />
                      </div>

                      <div>
                        <label className="label">Monthly Target</label>
                        <input
                          type="number"
                          value={subBucket.monthlyTarget || 0}
                          onChange={(event) =>
                            updateSubBucket(
                              groupId,
                              subBucket.id,
                              "monthlyTarget",
                              event.target.value
                            )
                          }
                          aria-label={`${subBucket.name} monthly target`}
                        />
                      </div>

                      <div>
                        <label className="label">Due Date</label>
                        <input
                          type="date"
                          value={subBucket.dueDate || ""}
                          onChange={(event) =>
                            updateSubBucket(
                              groupId,
                              subBucket.id,
                              "dueDate",
                              event.target.value
                            )
                          }
                          aria-label={`${subBucket.name} due date`}
                        />
                      </div>

                      <div>
                        <label className="label">Frequency</label>
                        <select
                          value={subBucket.frequency || "monthly"}
                          onChange={(event) =>
                            updateSubBucket(
                              groupId,
                              subBucket.id,
                              "frequency",
                              event.target.value
                            )
                          }
                          aria-label={`${subBucket.name} frequency`}
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>

                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => archiveSubBucket(groupId, subBucket.id)}
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bucket-row" key={subBucket.id}>
                    <div className="row" style={{ marginBottom: 0 }}>
                      <input
                        value={subBucket.name}
                        onChange={(event) =>
                          updateSubBucket(
                            groupId,
                            subBucket.id,
                            "name",
                            event.target.value
                          )
                        }
                        aria-label={`${subBucket.name} name`}
                      />
                      <input
                        type="number"
                        value={subBucket.percent}
                        onChange={(event) =>
                          updateSubBucket(
                            groupId,
                            subBucket.id,
                            "percent",
                            event.target.value
                          )
                        }
                        aria-label={`${subBucket.name} percent`}
                      />
                    </div>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => archiveSubBucket(groupId, subBucket.id)}
                    >
                      Archive
                    </button>
                  </div>
                )
              )}

              <div className="add-row">
                <input
                  value={newSubBucketNames[groupId] || ""}
                  onChange={(event) =>
                    setNewSubBucketNames((current) => ({
                      ...current,
                      [groupId]: event.target.value,
                    }))
                  }
                  placeholder={`New ${group.name} sub-bucket`}
                  aria-label={`New ${group.name} sub-bucket`}
                />
                <button
                  className="small-button"
                  type="button"
                  onClick={() => addSubBucket(groupId)}
                >
                  Add
                </button>
              </div>
            </PercentCard>
          );
        })}

        <section className="setup-card">
          <div className="card-header">
            <h2>Bills Buffer Logic</h2>
          </div>
          <p className="subtitle">
            Bill targets and due dates are stored here for future paycheck
            logic. Balances are not stored here. History transactions remain the
            source of truth.
          </p>
        </section>

        <section className="setup-card">
          <div className="card-header">
            <h2>Income Planning</h2>
          </div>

          <div className="income-grid">
            <div>
              <label className="label">Baseline Work Cheque</label>
              <input
                type="number"
                value={setup.incomePlanning.baselineWorkChequeAmount}
                onChange={(event) =>
                  updateIncomePlanning(
                    "baselineWorkChequeAmount",
                    event.target.value
                  )
                }
              />
            </div>

            <div>
              <label className="label">Baby Bonus Expected Amount</label>
              <input
                type="number"
                value={setup.incomePlanning.babyBonusExpectedAmount}
                onChange={(event) =>
                  updateIncomePlanning(
                    "babyBonusExpectedAmount",
                    event.target.value
                  )
                }
              />
            </div>

            <div>
              <label className="label">Baby Bonus Expected Day</label>
              <input
                type="number"
                min="1"
                max="31"
                value={setup.incomePlanning.babyBonusExpectedDay}
                onChange={(event) =>
                  updateIncomePlanning("babyBonusExpectedDay", event.target.value)
                }
              />
            </div>
          </div>

          <div className="section-divider" />

          <div className="toggle-row">
            <div>
              <h3>Extra Income Rule</h3>
              <p className="subtitle">
                First amount uses normal split. Extra above that uses extra
                split.
              </p>
            </div>
            <input
              type="checkbox"
              checked={setup.incomePlanning.extraIncomeRule.enabled}
              onChange={(event) =>
                updateExtraIncomeRule("enabled", event.target.checked)
              }
              aria-label="Enable extra income rule"
            />
          </div>

          <div>
            <label className="label">Normal Split Limit</label>
            <input
              type="number"
              value={setup.incomePlanning.extraIncomeRule.normalSplitLimit}
              onChange={(event) =>
                updateExtraIncomeRule("normalSplitLimit", event.target.value)
              }
            />
          </div>
        </section>

        <PercentCard title="Extra Income Split" total={validation.extraTotal}>
          {activeItems(setup.incomePlanning.extraIncomeRule.extraSplit).map(
            (item) => (
              <div className="row" key={item.id}>
                <input value={item.name} disabled aria-label={`${item.name} name`} />
                <input
                  type="number"
                  value={item.percent}
                  onChange={(event) =>
                    updateExtraSplitItem(item.id, event.target.value)
                  }
                  aria-label={`${item.name} extra income percent`}
                />
              </div>
            )
          )}
        </PercentCard>

        <button
          className="save-button"
          type="button"
          disabled={!validation.valid}
          onClick={handleSave}
        >
          Save Setup
        </button>

        {savedMessage && <div className="save-message">{savedMessage}</div>}
      </div>
    </main>
  );
}