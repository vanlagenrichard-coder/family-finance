function buildTransaction() {
  const amount = Number(form.amount);

  if (!amount || amount <= 0) {
    alert("Enter a valid amount.");
    return null;
  }

  const now = new Date().toISOString();

  const baseTransaction = {
    id: editingId || crypto.randomUUID(),
    type: form.type,
    amount,
    date: form.date,
    note: form.note.trim(),
    createdAt: editingId
      ? transactions.find((transaction) => transaction.id === editingId)
          ?.createdAt || now
      : now,
    updatedAt: now,
  };

  // PAYCHECK
  if (form.type === "Paycheck") {
    const allocations = [];

    activeBuckets.forEach((bucket) => {
      const bucketPercent = Number(bucket.percent || 0);

      const bucketAmount =
        amount * (bucketPercent / 100);

      if (
        Array.isArray(bucket.subBuckets) &&
        bucket.subBuckets.length > 0
      ) {
        bucket.subBuckets.forEach((subBucket) => {
          const subPercent = Number(
            subBucket.percent || 0
          );

          const subAmount =
            bucketAmount * (subPercent / 100);

          allocations.push({
            bucket: bucket.name,
            subBucket: subBucket.name,
            amount: Number(subAmount.toFixed(2)),
          });
        });
      } else {
        allocations.push({
          bucket: bucket.name,
          subBucket: "",
          amount: Number(bucketAmount.toFixed(2)),
        });
      }
    });

    return {
      ...baseTransaction,
      bucket: "",
      subBucket: "",
      fromBucket: "",
      fromSubBucket: "",
      toBucket: "",
      toSubBucket: "",
      allocations,
    };
  }

  // TRANSFER
  if (form.type === "Transfer") {
    if (
      form.fromBucket === form.toBucket &&
      form.fromSubBucket === form.toSubBucket
    ) {
      alert("Transfer needs a different destination.");
      return null;
    }

    return {
      ...baseTransaction,
      bucket: "",
      subBucket: "",
      fromBucket: form.fromBucket,
      fromSubBucket: form.fromSubBucket,
      toBucket: form.toBucket,
      toSubBucket: form.toSubBucket,
      allocations: [],
    };
  }

  // EXPENSE / DEPOSIT
  return {
    ...baseTransaction,
    bucket: form.bucket,
    subBucket: form.subBucket,
    fromBucket: "",
    fromSubBucket: "",
    toBucket: "",
    toSubBucket: "",
    allocations: [],
  };
}