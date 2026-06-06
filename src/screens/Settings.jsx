import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "budgetAppData";

const defaultBuckets = [
  {
    id: "bills",
    name: "Bills",
    percent: "55",
    archived: false,
    expanded: true,
    subBuckets: [],
  },
  {
    id: "savings",
    name: "Savings",
    percent: "10",
    archived: false,
    expanded: true,
    subBuckets: [],
  },
  {
    id: "giving",
    name: "Giving",
    percent: "5",
    archived: false,
    expanded: true,
    subBuckets: [],
  },
  {
    id: "spending",
    name: "Spending",
    percent: "30",
    archived: false,
    expanded: true,
    subBuckets: [],
  },
];

function Settings() {
  const [data, setData] = useState({});
  const [buckets, setBuckets] = useState(defaultBuckets);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const setupBuckets =
      saved.setupBuckets ||
      saved.buckets ||
      saved.settings?.setup ||
      saved.setup ||
      defaultBuckets;

    const normalized = setupBuckets.map((bucket) => ({
      ...bucket,
      id: bucket.id || `bucket_${Date.now()}_${Math.random()}`,
      name: bucket.name || "",
      percent: bucket.percent ?? "",
      archived: bucket.archived ?? false,
      expanded: bucket.expanded ?? true,
      subBuckets: (
        bucket.subBuckets ||
        bucket.subcategories ||
        bucket.children ||
        bucket.items ||
        []
      ).map((sub) => ({
        ...sub,
        id: sub.id || `sub_${Date.now()}_${Math.random()}`,
        name: sub.name || "",
        percent: sub.percent ?? "",
        monthlyTarget: sub.monthlyTarget ?? "",
        archived: sub.archived ?? false,
      })),
    }));

    setData(saved);
    setBuckets(normalized);
  }, []);

  const activeBuckets = useMemo(
    () => buckets.filter((bucket) => !bucket.archived),
    [buckets]
  );

  const mainTotal = activeBuckets.reduce(
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

  const addBucket = () => {
    saveBuckets([
      ...buckets,
      {
        id: `bucket_${Date.now()}`,
        name: "",
        percent: "",
        archived: false,
        expanded: true,
        subBuckets: [],
      },
    ]);
  };

  const deleteBucket = (bucketId) => {
    saveBuckets(
      buckets.map((bucket) =>
        bucket.id === bucketId ? { ...bucket, archived: true } : bucket
      )
    );
  };

  const addSubBucket = (bucketId) => {
    saveBuckets(
      buckets.map((bucket) =>
        bucket.id === bucketId
          ? {
              ...bucket,
              expanded: true,
              subBuckets: [
                ...(bucket.subBuckets || []),
                {
                  id: `sub_${Date.now()}`,
                  name: "",
                  percent: "",
                  monthlyTarget: "",
                  archived: false,
                },
              ],
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
              subBuckets: bucket.subBuckets.map((sub) =>
                sub.id === subBucketId ? { ...sub, [field]: value } : sub
              ),
            }
          : bucket
      )
    );
  };

  const deleteSubBucket = (bucketId, subBucketId) => {
    saveBuckets(
      buckets.map((bucket) =>
        bucket.id === bucketId
          ? {
              ...bucket,
              subBuckets: bucket.subBuckets.map((sub) =>
                sub.id === subBucketId ? { ...sub, archived: true } : sub
              ),
            }
          : bucket
      )
    );
  };

  const getSubTotal = (bucket) => {
    return (bucket.subBuckets || [])
      .filter((sub) => !sub.archived)
      .reduce((sum, sub) => sum + Number(sub.percent || 0), 0);
  };

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <section className="setup-card">
        <div className="setup-header">
          <div>
            <h2>Paycheck Setup</h2>
            <p>Main buckets must total 100%. Each bucket’s sub-buckets must also total 100%.</p>
          </div>

          <div className={mainTotal === 100 ? "total good" : "total bad"}>
            Total: {mainTotal.toFixed(1).replace(".0", "")}%
          </div>
        </div>

        <div className="bucket-table">
          <div className="bucket-row bucket-heading">
            <div>Bucket</div>
            <div>Percent</div>
            <div>Actions</div>
          </div>

          {activeBuckets.map((bucket) => {
            const activeSubs = (bucket.subBuckets || []).filter(
              (sub) => !sub.archived
            );
            const subTotal = getSubTotal(bucket);

            return (
              <div className="bucket-block" key={bucket.id}>
                <div className="bucket-row">
                  <input
                    value={bucket.name}
                    placeholder="Bucket name"
                    onChange={(e) =>
                      updateBucket(bucket.id, "name", e.target.value)
                    }
                  />

                  <input
                    type="number"
                    value={bucket.percent}
                    placeholder="0"
                    onChange={(e) =>
                      updateBucket(bucket.id, "percent", e.target.value)
                    }
                  />

                  <div className="actions">
                    <button
                      type="button"
                      onClick={() =>
                        updateBucket(bucket.id, "expanded", !bucket.expanded)
                      }
                    >
                      {bucket.expanded ? "Hide" : "Edit"}
                    </button>

                    <button type="button" onClick={() => deleteBucket(bucket.id)}>
                      Delete
                    </button>
                  </div>
                </div>

                {bucket.expanded && (
                  <div className="sub-section">
                    <div className="sub-header">
                      <strong>{bucket.name || "Bucket"} sub-buckets</strong>
                      <span className={subTotal === 100 ? "good" : "bad"}>
                        Total: {subTotal.toFixed(1).replace(".0", "")}%
                      </span>
                    </div>

                    <div className="sub-row sub-heading">
                      <div>Sub-bucket</div>
                      <div>Percent</div>
                      <div>Monthly Target</div>
                      <div>Actions</div>
                    </div>

                    {activeSubs.map((sub) => (
                      <div className="sub-row" key={sub.id}>
                        <input
                          value={sub.name}
                          placeholder="Sub-bucket name"
                          onChange={(e) =>
                            updateSubBucket(
                              bucket.id,
                              sub.id,
                              "name",
                              e.target.value
                            )
                          }
                        />

                        <input
                          type="number"
                          value={sub.percent}
                          placeholder="0"
                          onChange={(e) =>
                            updateSubBucket(
                              bucket.id,
                              sub.id,
                              "percent",
                              e.target.value
                            )
                          }
                        />

                        <input
                          type="number"
                          value={sub.monthlyTarget}
                          placeholder="0"
                          onChange={(e) =>
                            updateSubBucket(
                              bucket.id,
                              sub.id,
                              "monthlyTarget",
                              e.target.value
                            )
                          }
                        />

                        <button
                          type="button"
                          onClick={() => deleteSubBucket(bucket.id, sub.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}

                    <button type="button" onClick={() => addSubBucket(bucket.id)}>
                      Add Sub-Bucket
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button type="button" onClick={addBucket}>
          Add Bucket
        </button>
      </section>
    </div>
  );
}

export default Settings;