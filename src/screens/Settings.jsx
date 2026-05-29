import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData, updateData } from "../services/storage";

const FIXED_BUCKETS = [
  "Bills",
  "Savings",
  "Giving",
  "Spending",
  "Goals",
];

const FREQUENCIES = [
  "Monthly",
  "Weekly",
  "Bi-weekly",
  "Yearly",
  "One-time",
];

function makeId(prefix = "item") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
}

function normalizePercent(value) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return 0;
  }

  return number;
}

function createDefaultBuckets() {
  return FIXED_BUCKETS.map((bucket) => ({
    id: bucket.toLowerCase(),
    name: bucket,
    percent: 20,
    expanded: true,
    archived: false,
    subBuckets: [],
  }));
}

function getSetup(data) {
  const existing =
    data?.setup?.bucketGroups ||
    data?.setupBuckets ||
    [];

  const defaults =
    createDefaultBuckets();

  return defaults.map((defaultBucket) => {
    const existingBucket =
      existing.find(
        (bucket) =>
          bucket.id ===
            defaultBucket.id ||
          bucket.name ===
            defaultBucket.name
      ) || {};

    return {
      id: defaultBucket.id,
      name: defaultBucket.name,
      percent:
        existingBucket.percent ??
        defaultBucket.percent,
      expanded:
        existingBucket.expanded ??
        true,
      archived: false,

      subBuckets: Array.isArray(
        existingBucket.subBuckets
      )
        ? existingBucket.subBuckets.map(
            (sub) => ({
              id:
                sub.id ||
                makeId("sub"),
              name:
                sub.name || "",
              percent:
                sub.percent ?? "",
              archived: Boolean(
                sub.archived
              ),

              monthlyTarget:
                sub.monthlyTarget ??
                "",

              dueDate:
                sub.dueDate ?? "",

              frequency:
                sub.frequency ??
                "Monthly",

              reserveGoal:
                sub.reserveGoal ??
                "",

              targetAmount:
                sub.targetAmount ??
                "",

              targetDate:
                sub.targetDate ??
                "",
            })
          )
        : [],
    };
  });
}

export default function Setup() {
  const [setupBuckets, setSetupBuckets] =
    useState([]);

  const [loaded, setLoaded] =
    useState(false);

  useEffect(() => {
    const data = loadData();

    setSetupBuckets(getSetup(data));

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;

    const bucketGroups =
      setupBuckets.map((bucket) => ({
        ...bucket,
        subBuckets:
          bucket.subBuckets.filter(
            (sub) => !sub.archived
          ),
      }));

    updateData((data) => ({
      ...data,

      setupBuckets,

      setup: {
        ...(data.setup || {}),
        bucketGroups,
      },
    }));
  }, [setupBuckets, loaded]);

  const bucketTotal =
    useMemo(() => {
      return setupBuckets.reduce(
        (sum, bucket) =>
          sum +
          normalizePercent(
            bucket.percent
          ),
        0
      );
    }, [setupBuckets]);

  function updateBucket(
    bucketId,
    updater
  ) {
    setSetupBuckets((current) =>
      current.map((bucket) =>
        bucket.id === bucketId
          ? updater(bucket)
          : bucket
      )
    );
  }

  function updateBucketField(
    bucketId,
    field,
    value
  ) {
    updateBucket(bucketId, (bucket) => ({
      ...bucket,
      [field]: value,
    }));
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

  function updateSubBucket(
    bucketId,
    subId,
    field,
    value
  ) {
    updateBucket(bucketId, (bucket) => ({
      ...bucket,

      subBuckets:
        bucket.subBuckets.map((sub) =>
          sub.id === subId
            ? {
                ...sub,
                [field]: value,
              }
            : sub
        ),
    }));
  }

  function archiveSubBucket(
    bucketId,
    subId
  ) {
    updateBucket(bucketId, (bucket) => ({
      ...bucket,

      subBuckets:
        bucket.subBuckets.map((sub) =>
          sub.id === subId
            ? {
                ...sub,
                archived: true,
              }
            : sub
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
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-400">
              Family Finance
            </p>

            <h1 className="text-4xl font-black tracking-tight">
              Setup
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Configure your
              paycheck splitting
              system.
            </p>
          </div>

          <Link
            to="/"
            className="rounded-2xl bg-slate-800 px-5 py-3 text-sm font-black text-white shadow-lg"
          >
            Home
          </Link>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Bucket Total
              </p>

              <h2 className="mt-1 text-3xl font-black">
                {bucketTotal}%
              </h2>
            </div>

            <div
              className={`rounded-2xl px-4 py-3 text-sm font-black ${
                Math.round(bucketTotal) ===
                100
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-red-500/15 text-red-300"
              }`}
            >
              {Math.round(bucketTotal) ===
              100
                ? "Balanced"
                : "Must equal 100%"}
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          {setupBuckets.map((bucket) => {
            const activeSubBuckets =
              bucket.subBuckets.filter(
                (sub) =>
                  !sub.archived
              );

            const subTotal =
              activeSubBuckets.reduce(
                (sum, sub) =>
                  sum +
                  normalizePercent(
                    sub.percent
                  ),
                0
              );

            const subValid =
              Math.round(subTotal) ===
              100;

            return (
              <section
                key={bucket.id}
                className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() =>
                    toggleBucket(
                      bucket.id
                    )
                  }
                  className="flex w-full items-center justify-between gap-3 p-5 text-left"
                >
                  <div>
                    <h2 className="text-2xl font-black">
                      {bucket.name}
                    </h2>

                    <p className="mt-1 text-sm text-slate-400">
                      {
                        activeSubBuckets.length
                      }{" "}
                      active sub-buckets
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-400">
                        Bucket %
                      </p>

                      <strong className="text-xl">
                        {
                          bucket.percent
                        }
                        %
                      </strong>
                    </div>

                    <span className="text-2xl text-slate-500">
                      {bucket.expanded
                        ? "−"
                        : "+"}
                    </span>
                  </div>
                </button>

                {bucket.expanded && (
                  <div className="border-t border-slate-800 p-5">
                    <div className="mb-4 grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Bucket %
                        </span>

                        <div className="flex h-12 items-center rounded-2xl border border-slate-700 bg-slate-950 px-4">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={
                              bucket.percent
                            }
                            onChange={(
                              event
                            ) =>
                              updateBucketField(
                                bucket.id,
                                "percent",
                                event.target
                                  .value
                              )
                            }
                            className="min-w-0 flex-1 bg-transparent text-lg font-black outline-none"
                          />

                          <span className="text-slate-500">
                            %
                          </span>
                        </div>
                      </label>

                      <div className="flex items-end">
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm font-black ${
                            subValid
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-red-500/15 text-red-300"
                          }`}
                        >
                          Sub-buckets:
                          {" "}
                          {subTotal}%
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      {activeSubBuckets.map(
                        (sub) => (
                          <div
                            key={sub.id}
                            className="rounded-3xl border border-slate-800 bg-slate-950 p-4"
                          >
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="flex flex-col gap-2">
                                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                                  Name
                                </span>

                                <input
                                  value={
                                    sub.name
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateSubBucket(
                                      bucket.id,
                                      sub.id,
                                      "name",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 font-bold outline-none"
                                />
                              </label>

                              <label className="flex flex-col gap-2">
                                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                                  Percent
                                </span>

                                <div className="flex h-12 items-center rounded-2xl border border-slate-700 bg-slate-900 px-4">
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    value={
                                      sub.percent
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateSubBucket(
                                        bucket.id,
                                        sub.id,
                                        "percent",
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    className="min-w-0 flex-1 bg-transparent font-black outline-none"
                                  />

                                  <span className="text-slate-500">
                                    %
                                  </span>
                                </div>
                              </label>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <label className="flex flex-col gap-2">
                                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                                  Monthly Target
                                </span>

                                <input
                                  type="number"
                                  inputMode="decimal"
                                  value={
                                    sub.monthlyTarget
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateSubBucket(
                                      bucket.id,
                                      sub.id,
                                      "monthlyTarget",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 font-bold outline-none"
                                />
                              </label>

                              <label className="flex flex-col gap-2">
                                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                                  Due Date
                                </span>

                                <input
                                  value={
                                    sub.dueDate
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateSubBucket(
                                      bucket.id,
                                      sub.id,
                                      "dueDate",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 font-bold outline-none"
                                />
                              </label>

                              <label className="flex flex-col gap-2">
                                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                                  Frequency
                                </span>

                                <select
                                  value={
                                    sub.frequency
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateSubBucket(
                                      bucket.id,
                                      sub.id,
                                      "frequency",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 font-bold outline-none"
                                >
                                  {FREQUENCIES.map(
                                    (
                                      frequency
                                    ) => (
                                      <option
                                        key={
                                          frequency
                                        }
                                        value={
                                          frequency
                                        }
                                      >
                                        {
                                          frequency
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              </label>

                              <label className="flex flex-col gap-2">
                                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                                  Goal Amount
                                </span>

                                <input
                                  type="number"
                                  inputMode="decimal"
                                  value={
                                    sub.targetAmount
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateSubBucket(
                                      bucket.id,
                                      sub.id,
                                      "targetAmount",
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  className="h-12 rounded-2xl border border-slate-700 bg-slate-900 px-4 font-bold outline-none"
                                />
                              </label>
                            </div>

                            <div className="mt-4 flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  archiveSubBucket(
                                    bucket.id,
                                    sub.id
                                  )
                                }
                                className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-black text-red-300"
                              >
                                Archive
                              </button>
                            </div>
                          </div>
                        )
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          addSubBucket(
                            bucket.id
                          )
                        }
                        className="rounded-2xl bg-blue-500 px-4 py-4 text-base font-black text-white shadow-lg"
                      >
                        Add{" "}
                        {bucket.name}{" "}
                        Sub-bucket
                      </button>
                    </div>
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