import { versionInfo } from 'graphql';

export function handlePre16<T>(postV16: T | undefined, preV16: T | undefined) {
  /* c8 ignore next */
  return versionInfo.major >= 16 ? postV16 : preV16;
}
