// src/utils/splitCalculator.js
function roundToTwo(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function splitPaycheck(amount, settings) {
  const safeAmount = Number(amount) || 0;

  const step1 = settings.step1Split;
  const step2 = settings.step2Split;

  const bills = roundToTwo(safeAmount * step1.bills);
  const savings = roundToTwo(safeAmount * step1.savings);
  const giving = roundToTwo(safeAmount * step1.giving);

  const spendingPool = roundToTwo(safeAmount * step1.spending);

  const family = roundToTwo(spendingPool * step2.family);
  const wife = roundToTwo(spendingPool * step2.wife);
  const me = roundToTwo(spendingPool * step2.me);

  let kids = roundToTwo(spendingPool * step2.kids);

  const assignedTotal = roundToTwo(
    bills + savings + giving + family + wife + me + kids
  );

  const remainder = roundToTwo(safeAmount - assignedTotal);
  kids = roundToTwo(kids + remainder);

  return {
    bills,
    savings,
    giving,
    family,
    wife,
    me,
    kids
  };
}

export function splitSubBuckets(parentAmount, splitConfig) {
  const safeAmount = Number(parentAmount) || 0;
  const entries = Object.entries(splitConfig || {});

  const result = {};
  let assignedTotal = 0;

  entries.forEach(([bucketId, percentage], index) => {
    const isLast = index === entries.length - 1;

    if (isLast) {
      result[bucketId] = roundToTwo(safeAmount - assignedTotal);
    } else {
      const value = roundToTwo(safeAmount * percentage);
      result[bucketId] = value;
      assignedTotal = roundToTwo(assignedTotal + value);
    }
  });

  return result;
}

export function splitSavingsSubBuckets(savingsAmount, settings) {
  return splitSubBuckets(
    savingsAmount,
    settings?.subBucketSplits?.savings || {}
  );
}

export function applySplitToBuckets(currentBuckets, splitResult) {
  return {
    bills: roundToTwo((currentBuckets.bills || 0) + (splitResult.bills || 0)),
    savings: roundToTwo(
      (currentBuckets.savings || 0) + (splitResult.savings || 0)
    ),
    giving: roundToTwo((currentBuckets.giving || 0) + (splitResult.giving || 0)),
    family: roundToTwo((currentBuckets.family || 0) + (splitResult.family || 0)),
    wife: roundToTwo((currentBuckets.wife || 0) + (splitResult.wife || 0)),
    me: roundToTwo((currentBuckets.me || 0) + (splitResult.me || 0)),
    kids: roundToTwo((currentBuckets.kids || 0) + (splitResult.kids || 0))
  };
}

export function applySavingsSubBucketSplit(currentSubBuckets, savingsSplit) {
  const currentSavingsSubBuckets = currentSubBuckets?.savings || {};

  return {
    ...currentSubBuckets,
    savings: {
      holiday: roundToTwo(
        (currentSavingsSubBuckets.holiday || 0) + (savingsSplit.holiday || 0)
      ),
      emergency: roundToTwo(
        (currentSavingsSubBuckets.emergency || 0) +
          (savingsSplit.emergency || 0)
      ),
      newCar: roundToTwo(
        (currentSavingsSubBuckets.newCar || 0) + (savingsSplit.newCar || 0)
      )
    }
  };
}