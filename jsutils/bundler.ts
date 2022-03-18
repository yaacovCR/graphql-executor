import type { Maybe } from './Maybe.ts';
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
  createDataBundleContext: (count: number) => TDataContext;
  createErrorBundleContext: (count: number) => TErrorContext;
  onData: (index: number, result: TDataResult, context: TDataContext) => void;
  onError: (
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

export class Bundler<TDataResult, TErrorResult, TDataContext, TErrorContext>
  implements IBundler<TDataResult, TErrorResult>
{
  private _maxBundleSize: number;
  private _maxInterval: Maybe<number>;
  private _createDataBundleContext: (count: number) => TDataContext;
  private _createErrorBundleContext: (count: number) => TErrorContext;
  private _onData: (
    index: number,
    result: TDataResult,
    context: TDataContext,
  ) => void;
  private _onError: (
    index: number,
    result: TErrorResult,
    context: TErrorContext,
  ) => void;
  private _onDataBundle: (context: TDataContext) => void;
  private _onErrorBundle: (context: TErrorContext) => void;
  private _timingContext: BundleTimingContext | undefined;
  private _currentContext:
    | {
        isData: true;
        context: TDataContext;
      }
    | {
        isData: false;
        context: TErrorContext;
      }
    | undefined;
  private _currentBundleSize: number;
  private _count: number;
  private _total: number | undefined;

  constructor({
    initialIndex,
    maxBundleSize,
    maxInterval,
    createDataBundleContext,
    createErrorBundleContext,
    onData,
    onError,
    onDataBundle,
    onErrorBundle,
  }: BundlerOptions<TDataResult, TErrorResult, TDataContext, TErrorContext>) {
    this._maxBundleSize = maxBundleSize;
    this._maxInterval = maxInterval;
    this._createDataBundleContext = createDataBundleContext;
    this._createErrorBundleContext = createErrorBundleContext;
    this._onData = onData;
    this._onError = onError;
    this._onDataBundle = onDataBundle;
    this._onErrorBundle = onErrorBundle;

    if (maxInterval != null) {
      this._timingContext = {
        maxInterval,
        timeout: undefined,
        lastTime: Date.now(),
      };
    }

    this._currentBundleSize = 0;
    this._count = initialIndex;
  }

  queueData(index: number, result: TDataResult): void {
    const context = this._getDataContext();

    this._onData(index, result, context);

    this._currentBundleSize++;
    this._count++;

    if (this._count === this._total) {
      this._onDataBundle(context);

      if (this._timingContext) {
        this._clearCurrentTimer(this._timingContext);
      }

      return;
    }

    if (this._currentBundleSize === this._maxBundleSize) {
      this._onDataBundle(context);

      this._currentContext = undefined;

      if (this._timingContext) {
        this._restartTimer(this._timingContext);
      }

      return;
    }

    if (
      this._timingContext &&
      Date.now() - this._timingContext.lastTime >
        this._timingContext.maxInterval
    ) {
      this._onDataBundle(context);

      this._currentContext = undefined; // timer kicked off without bundle, no need to clear

      this._startNewTimer(this._timingContext);
    }
  }

  queueError(index: number, result: TErrorResult): void {
    const context = this._getErrorContext();

    this._onError(index, result, context);

    this._currentBundleSize++;
    this._count++;

    if (this._count === this._total) {
      this._onErrorBundle(context);

      if (this._timingContext) {
        this._clearCurrentTimer(this._timingContext);
      }

      return;
    }

    if (this._currentBundleSize === this._maxBundleSize) {
      this._onErrorBundle(context);

      this._currentContext = undefined;

      if (this._timingContext) {
        this._restartTimer(this._timingContext);
      }
    }

    if (
      this._timingContext &&
      Date.now() - this._timingContext.lastTime >
        this._timingContext.maxInterval
    ) {
      this._onErrorBundle(context);

      this._currentContext = undefined; // timer kicked off without bundle, no need to clear

      this._startNewTimer(this._timingContext);
    }
  }

  setTotal(total: number): void {
    if (this._count < total) {
      this._total = total;
      return;
    }

    if (this._currentContext) {
      this._onBundle(this._currentContext);

      if (this._timingContext) {
        this._clearCurrentTimer(this._timingContext);
      }
    }
  }

  _clearCurrentTimer(timingContext: BundleTimingContext): void {
    const timeout = timingContext.timeout;

    if (timeout) {
      clearTimeout(timeout);
    }
  }

  _startNewTimer(timingContext: BundleTimingContext): void {
    timingContext.timeout = setTimeout(
      () => this._flushCurrentBundle(timingContext),
      timingContext.maxInterval,
    );
    timingContext.lastTime = Date.now();
  }

  _flushCurrentBundle(timingContext: BundleTimingContext): void {
    if (this._currentContext) {
      this._onBundle(this._currentContext);

      this._currentContext = undefined;

      this._restartTimer(timingContext);

      this._startNewTimer(timingContext);
    }
  }

  _restartTimer(timingContext: BundleTimingContext): void {
    this._clearCurrentTimer(timingContext);

    this._startNewTimer(timingContext);
  }

  _getDataContext(): TDataContext {
    if (this._currentContext === undefined) {
      return this._getNewDataContext();
    } else if (!this._currentContext.isData) {
      this._onErrorBundle(this._currentContext.context);

      return this._getNewDataContext();
    }

    return this._currentContext.context;
  }

  _getNewDataContext(): TDataContext {
    this._currentBundleSize = 0;

    const context = this._createDataBundleContext(this._count);

    this._currentContext = {
      isData: true,
      context,
    };

    if (this._timingContext) {
      const timingContext = this._timingContext;
      timingContext.timeout = setTimeout(
        () => this._flushCurrentBundle(timingContext),
        timingContext.maxInterval,
      );
    }

    return context;
  }

  _getErrorContext(): TErrorContext {
    if (this._currentContext === undefined) {
      return this._getNewErrorContext();
    } else if (this._currentContext.isData) {
      this._onDataBundle(this._currentContext.context);

      return this._getNewErrorContext();
    }

    return this._currentContext.context;
  }

  _getNewErrorContext(): TErrorContext {
    this._currentBundleSize = 0;

    const context = this._createErrorBundleContext(this._count);

    this._currentContext = {
      isData: false,
      context,
    };

    if (this._timingContext) {
      const timingContext = this._timingContext;
      timingContext.timeout = setTimeout(
        () => this._flushCurrentBundle(timingContext),
        timingContext.maxInterval,
      );
    }

    return context;
  }

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
  ): void {
    if (bundleContext.isData) {
      this._onDataBundle(bundleContext.context);

      return;
    }

    this._onErrorBundle(bundleContext.context);
  }
}
