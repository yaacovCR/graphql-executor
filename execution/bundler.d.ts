/// <reference types="node" />
import type { Maybe } from '../jsutils/Maybe';
export interface IBundler<TDataResult, TErrorResult> {
  queueData: (index: number, result: TDataResult) => void;
  queueError: (index: number, result: TErrorResult) => void;
  setTotal: (total: number) => void;
}
export interface BundlerOptions<
  TDataResult,
  TErrorResult,
  TDataContext,
  TErrorContext,
> {
  initialIndex: number;
  maxBundleSize: number;
  maxInterval: Maybe<number>;
  createDataBundleContext: (index: number, result: TDataResult) => TDataContext;
  createErrorBundleContext: (
    index: number,
    result: TErrorResult,
  ) => TErrorContext;
  onSubsequentData: (
    index: number,
    result: TDataResult,
    context: TDataContext,
  ) => void;
  onSubsequentError: (
    index: number,
    result: TErrorResult,
    context: TErrorContext,
  ) => void;
  onDataBundle: (context: TDataContext) => void;
  onErrorBundle: (context: TErrorContext) => void;
}
interface BundleTimingContext {
  timeout: ReturnType<typeof setTimeout> | undefined;
  maxInterval: number;
  lastTime: number;
}
/**
 * @internal
 */
export declare class Bundler<
  TDataResult,
  TErrorResult,
  TDataContext,
  TErrorContext,
> implements IBundler<TDataResult, TErrorResult>
{
  private _maxBundleSize;
  private _createDataBundleContext;
  private _createErrorBundleContext;
  private _onSubsequentData;
  private _onSubsequentError;
  private _onDataBundle;
  private _onErrorBundle;
  private _timingContext;
  private _currentContext;
  private _currentBundleSize;
  private _count;
  private _total;
  constructor({
    initialIndex,
    maxBundleSize,
    maxInterval,
    createDataBundleContext,
    createErrorBundleContext,
    onSubsequentData,
    onSubsequentError,
    onDataBundle,
    onErrorBundle,
  }: BundlerOptions<TDataResult, TErrorResult, TDataContext, TErrorContext>);
  queueData(index: number, result: TDataResult): void;
  queueError(index: number, result: TErrorResult): void;
  setTotal(total: number): void;
  _clearCurrentTimer(timingContext: BundleTimingContext): void;
  _startNewTimer(timingContext: BundleTimingContext): void;
  _flushCurrentBundle(timingContext: BundleTimingContext): void;
  _restartTimer(timingContext: BundleTimingContext): void;
  _updateDataContext(index: number, result: TDataResult): TDataContext;
  _getNewDataContext(index: number, result: TDataResult): TDataContext;
  _updateErrorContext(index: number, result: TErrorResult): TErrorContext;
  _getNewErrorContext(index: number, result: TErrorResult): TErrorContext;
  _onBundle(
    bundleContext:
      | {
          isData: true;
          context: TDataContext;
        }
      | {
          isData: false;
          context: TErrorContext;
        },
  ): void;
}
export {};
