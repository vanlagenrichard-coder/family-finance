export function getActiveSubBuckets(
  setupBuckets,
  bucketName
) {
  const bucket = setupBuckets.find(
    (item) => item.name === bucketName
  );

  if (!bucket) {
    return [];
  }

  return bucket.subBuckets.filter(
    (subBucket) => !subBucket.archived
  );
}

export function getSubBucketNames(
  setupBuckets,
  bucketName
) {
  return getActiveSubBuckets(
    setupBuckets,
    bucketName
  ).map((subBucket) => subBucket.name);
}

export function findSubBucket(
  setupBuckets,
  bucketName,
  subBucketName
) {
  return getActiveSubBuckets(
    setupBuckets,
    bucketName
  ).find(
    (subBucket) =>
      subBucket.name === subBucketName
  );
}