'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.getSequentialBundler = getSequentialBundler;

function getSequentialBundler(initialIndex, bundler) {
  const dataResultMap = new Map();
  const errorResultMap = new Map();
  let count = initialIndex;
  return {
    queueData: (index, result) => {
      if (count !== index) {
        dataResultMap.set(index, result);
        return;
      }

      bundler.queueData(index, result);
      count++;
      processPending();
    },
    queueError: (index, result) => {
      if (count !== index) {
        errorResultMap.set(index, result);
        return;
      }

      bundler.queueError(index, result);
      count++;
      processPending();
    },
    setTotal: (total) => bundler.setTotal(total),
  };

  function processPending() {
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
