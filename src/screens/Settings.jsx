import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData, updateData } from "../services/storage";

const FIXED_BUCKETS = ["Bills", "Savings", "Giving", "Spending", "Goals"];

const DEFAULT_SETUP = FIXED_BUCKETS.map((bucket) => ({
  id: bucket.toLowerCase(),
  name: bucket,
  expanded: true,
  subBuckets: [],
}));

const FREQUENCIES = ["Monthly", "Weekly", "Bi-weekly", "Yearly", "One-time"];

function makeId(prefix = "item") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizePercent(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;
  return number;
}

function getSetup(data) {
  const existing = Array.isArray(data?.setupBuckets) ? data.setupBuckets : [];

  return FIXED_BUCKETS.map((bucketName) => {
    const id = bucketName.toLowerCase();
    const oldBucket = existing.find(
      (bucket) => bucket.id === id || bucket.name === bucketName
    );

    return {
      id,
      name: bucketName,
      expanded: oldBucket?.expanded ?? true,
      subBuckets: Array.isArray(oldBucket?.subBuckets)
        ? oldBucket.subBuckets.map((sub) => ({
            id: sub.id || makeId("sub"),
            name: sub.name || "",
            percent: sub.percent ?? "",
            archived: Boolean(sub.archived),
            monthlyTarget: sub.monthlyTarget ?? "",
            dueDate: sub.dueDate ?? "",
            frequency: sub.frequency ?? "Monthly",
            reserveGoal: sub.reserveGoal ?? "",
            targetAmount: sub.targetAmount ?? "",
            targetDate: sub.targetDate ?? "",
          }))
        : [],
    };
  });
}

export default function Settings() {
  const [setupBuckets, setSetupBuckets] = useState(DEFAULT_SETUP);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const data = loadData();
    setSetupBuckets(getSetup(data));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;

    updateData((data) => ({
      ...data,
      setupBuckets,
      buckets: setupBuckets,
    }));
  }, [setupBuckets, loaded]);

  const totals = useMemo(() => {
    return setupBuckets.reduce((result, bucket) => {
      const total = bucket.subBuckets
        .filter((sub) => !sub.archived)
        .reduce((sum, sub) => sum + normalizePercent(sub.percent), 0);

      result[bucket.id] = total;
      return result;
    }, {});
  }, [setupBuckets]);

  function updateBucket(bucketId, updater) {
    setSetupBuckets((current) =>
      current.map((bucket) =>
        bucket.id === bucketId ? updater(bucket) : bucket
      )
    );
  }

  function addSubBucket(bucketId) {
    updateBucket(bucketId, (bucket) => ({
      ...bucket,
      expanded: true,
      subBuckets: [
        ...bucket.subBuckets,
        {
          id: makeId("sub"),
          name: "",
          percent: "",
          archived: false,
          monthlyTarget: "",
          dueDate: "",
          frequency: "Monthly",
          reserveGoal: "",
          targetAmount: "",
          targetDate: "",
        },
      ],
    }));
  }

  function updateSubBucket(bucketId, subId, field, value) {
    updateBucket(bucketId, (bucket) => ({
      ...bucket,
      subBuckets: bucket.subBuckets.map((sub) =>
        sub.id === subId ? { ...sub, [field]: value } : sub
      ),
    }));
  }

  function archiveSubBucket(bucketId, subId) {
    updateBucket(bucketId, (bucket) => ({
      ...bucket,
      subBuckets: bucket.subBuckets.map((sub) =>
        sub.id === subId ? { ...sub, archived: true } : sub
      ),
    }));
  }

  function toggleBucket(bucketId) {
    updateBucket(bucketId, (bucket) => ({
      ...bucket,
      expanded: !bucket.expanded,
    }));
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-400">Family Finance</p>
            <h1 className="text-3xl font-bold tracking-tight">Setup</h1>
          </div>

          <Link
            to="/"
            className="rounded-2xl bg-slate-800 px-4 py-3 text-sm font-bold text-white shadow-lg active:scale-95"
          >
            Home
          </Link>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
          <h2 className="text-lg font-bold">Rules engine</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Setup controls every active sub-bucket used by History and Balances.
            Archived sub-buckets stay saved for old history but disappear from
            active choices.
          </p>
        </section>

        <div className="flex flex-col gap-4">
          {setupBuckets.map((bucket) => {
            const activeSubBuckets = bucket.subBuckets.filter(
              (sub) => !sub.archived
            );
            const total = totals[bucket.id] || 0;
            const isValid = Math.round(total * 100) / 100 === 100;
            const isBills = bucket.name === "Bills";
            const isGoals = bucket.name === "Goals";

            return (
              <section
                key={bucket.id}
                className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-xl"
              >
                <button
                  type="button"
                  onClick={() => toggleBucket(bucket.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div>
                    <h2 className="text-xl font-black">{bucket.name}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {activeSubBuckets.length} active sub-bucket
                      {activeSubBuckets.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-2 text-sm font-black ${
                        isValid
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {total}%
                    </span>
                    <span className="text-xl text-slate-400">
                      {bucket.expanded ? "−" : "+"}
                    </span>
                  </div>
                </button>

                {bucket.expanded && (
                  <div className="flex flex-col gap-3 border-t border-slate-800 p-4">
                    {activeSubBuckets.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-4 text-sm text-slate-400">
                        No active sub-buckets yet.
                      </div>
                    )}

                    {activeSubBuckets.map((sub) => (
                      <div
                        key={sub.id}
                        className="rounded-3xl border border-slate-800 bg-slate-950 p-4"
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                          <label className="flex flex-col gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Sub-bucket
                            </span>
                            <input
                              value={sub.name}
                              onChange={(event) =>
                                updateSubBucket(
                                  bucket.id,
                                  sub.id,
                                  "name",
                                  event.target.value
                                )
                              }
                              placeholder="Example: Mortgage"
                              className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 text-base font-semibold text-white outline-none focus:border-blue-400"
                            />
                          </label>

                          <label className="flex flex-col gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                              Percent
                            </span>
                            <div className="flex h-12 items-center rounded-2xl border border-slate-700 bg-slate-900 px-4 focus-within:border-blue-400">
                              <input
                                type="number"
                                inputMode="decimal"
                                value={sub.percent}
                                onChange={(event) =>
                                  updateSubBucket(
                                    bucket.id,
                                    sub.id,
                                    "percent",
                                    event.target.value
                                  )
                                }
                                placeholder="0"
                                className="min-w-0 flex-1 bg-transparent text-base font-bold text-white outline-none"
                              />
                              <span className="text-slate-400">%</span>
                            </div>
                          </label>
                        </div>

                        {isBills && (
                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Monthly target
                              </span>
                              <input
                                type="number"
                                inputMode="decimal"
                                value={sub.monthlyTarget}
                                onChange={(event) =>
                                  updateSubBucket(
                                    bucket.id,
                                    sub.id,
                                    "monthlyTarget",
                                    event.target.value
                                  )
                                }
                                placeholder="0.00"
                                className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 text-base font-semibold text-white outline-none focus:border-blue-400"
                              />
                            </label>

                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Due date
                              </span>
                              <input
                                type="number"
                                min="1"
                                max="31"
                                inputMode="numeric"
                                value={sub.dueDate}
                                onChange={(event) =>
                                  updateSubBucket(
                                    bucket.id,
                                    sub.id,
                                    "dueDate",
                                    event.target.value
                                  )
                                }
                                placeholder="1-31"
                                className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 text-base font-semibold text-white outline-none focus:border-blue-400"
                              />
                            </label>

                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Frequency
                              </span>
                              <select
                                value={sub.frequency}
                                onChange={(event) =>
                                  updateSubBucket(
                                    bucket.id,
                                    sub.id,
                                    "frequency",
                                    event.target.value
                                  )
                                }
                                className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 text-base font-semibold text-white outline-none focus:border-blue-400"
                              >
                                {FREQUENCIES.map((frequency) => (
                                  <option key={frequency} value={frequency}>
                                    {frequency}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Reserve goal
                              </span>
                              <input
                                type="number"
                                inputMode="decimal"
                                value={sub.reserveGoal}
                                onChange={(event) =>
                                  updateSubBucket(
                                    bucket.id,
                                    sub.id,
                                    "reserveGoal",
                                    event.target.value
                                  )
                                }
                                placeholder="0.00"
                                className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 text-base font-semibold text-white outline-none focus:border-blue-400"
                              />
                            </label>
                          </div>
                        )}

                        {isGoals && (
                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Target amount
                              </span>
                              <input
                                type="number"
                                inputMode="decimal"
                                value={sub.targetAmount}
                                onChange={(event) =>
                                  updateSubBucket(
                                    bucket.id,
                                    sub.id,
                                    "targetAmount",
                                    event.target.value
                                  )
                                }
                                placeholder="0.00"
                                className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 text-base font-semibold text-white outline-none focus:border-blue-400"
                              />
                            </label>

                            <label className="flex flex-col gap-2">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Target date
                              </span>
                              <input
                                type="date"
                                value={sub.targetDate}
                                onChange={(event) =>
                                  updateSubBucket(
                                    bucket.id,
                                    sub.id,
                                    "targetDate",
                                    event.target.value
                                  )
                                }
                                className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 text-base font-semibold text-white outline-none focus:border-blue-400"
                              />
                            </label>
                          </div>
                        )}

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => archiveSubBucket(bucket.id, sub.id)}
                            className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 active:scale-95"
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => addSubBucket(bucket.id)}
                      className="rounded-2xl bg-blue-500 px-4 py-4 text-base font-black text-white shadow-lg active:scale-95"
                    >
                      Add {bucket.name} sub-bucket
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}