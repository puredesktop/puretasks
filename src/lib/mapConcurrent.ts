/** Keep native bridge reads bounded while retaining input order. */
export async function mapConcurrent<T, R>(
  values: readonly T[],
  read: (value: T) => Promise<R>,
  isCurrent: () => boolean = () => true,
): Promise<R[]> {
  const results: R[] = new Array(values.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(4, values.length) }, async () => {
    while (next < values.length && isCurrent()) {
      const index = next++
      results[index] = await read(values[index])
    }
  }))
  return results
}
