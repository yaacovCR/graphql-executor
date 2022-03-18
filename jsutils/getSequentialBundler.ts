import type { IBundler } from './bundler.ts';
export function getSequentialBundler<TDataResult, TErrorResult>(
  initialIndex: number,
  bundler: IBundler<TDataResult, TErrorResult>,
): IBundler<TDataResult, TErrorResult> {
  const dataResultMap: Map<number, TDataResult> = new Map();
  const errorResultMap: Map<number, TErrorResult> = new Map();
  let count = initialIndex;
  return {
    queueData: (index: number, result: TDataResult) => {
      if (count !== index) {
        dataResultMap.set(index, result);
        return;
      }

      bundler.queueData(index, result);
      count++;
      processPending();
    },
    queueError: (index: number, result: TErrorResult) => {
      if (count !== index) {
        errorResultMap.set(index, result);
        return;
      }

      bundler.queueError(index, result);
      count++;
      processPending();
    },
    setTotal: (total: number) => bundler.setTotal(total),
  };

  function processPending(): void {
    while (true) {
      const dataResult = dataResultMap.get(count);

      if (dataResult !== undefined) {
        dataResultMap.delete(count);
        bundler.queueData(count, dataResult);
        count++;
        continue;
      }

      const errorResult = errorResultMap.get(count);

      if (errorResult !== undefined) {
        errorResultMap.delete(count);
        bundler.queueError(count, errorResult);
        count++;
        continue;
      }

      break;
    }
  }
}
