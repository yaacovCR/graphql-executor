import { versionInfo } from 'graphql';

export function handlePre15<T>(postV15: T | undefined, preV15: T | undefined) {
  /* c8 ignore next */
  return versionInfo.major >= 15 ? postV15 : preV15;
}
