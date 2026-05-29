export const FIXED_BUCKETS = [
  {
    id: "bills",
    name: "Bills",
  },
  {
    id: "savings",
    name: "Savings",
  },
  {
    id: "giving",
    name: "Giving",
  },
  {
    id: "spending",
    name: "Spending",
  },
  {
    id: "goals",
    name: "Goals",
  },
];

export function getBucketById(id) {
  return FIXED_BUCKETS.find(
    (bucket) => bucket.id === id
  );
}

export function getBucketName(id) {
  return (
    getBucketById(id)?.name || ""
  );
}