import type { IBundler } from './bundler';
export declare function getSequentialBundler<TDataResult, TErrorResult>(
  initialIndex: number,
  bundler: IBundler<TDataResult, TErrorResult>,
): IBundler<TDataResult, TErrorResult>;
