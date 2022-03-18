/**
 * @internal
 */
export class Bundler {
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
  }) {
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

  queueData(index, result) {
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

  queueError(index, result) {
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

  setTotal(total) {
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

  _clearCurrentTimer(timingContext) {
    const timeout = timingContext.timeout;

    if (timeout) {
      clearTimeout(timeout);
    }
  }

  _startNewTimer(timingContext) {
    timingContext.timeout = setTimeout(
      () => this._flushCurrentBundle(timingContext),
      timingContext.maxInterval,
    );
    timingContext.lastTime = Date.now();
  }

  _flushCurrentBundle(timingContext) {
    if (this._currentContext) {
      this._onBundle(this._currentContext);

      this._currentContext = undefined;

      this._restartTimer(timingContext);

      this._startNewTimer(timingContext);
    }
  }

  _restartTimer(timingContext) {
    this._clearCurrentTimer(timingContext);

    this._startNewTimer(timingContext);
  }

  _getDataContext() {
    if (this._currentContext === undefined) {
      return this._getNewDataContext();
    } else if (!this._currentContext.isData) {
      this._onErrorBundle(this._currentContext.context);

      return this._getNewDataContext();
    }

    return this._currentContext.context;
  }

  _getNewDataContext() {
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

  _getErrorContext() {
    if (this._currentContext === undefined) {
      return this._getNewErrorContext();
    } else if (this._currentContext.isData) {
      this._onDataBundle(this._currentContext.context);

      return this._getNewErrorContext();
    }

    return this._currentContext.context;
  }

  _getNewErrorContext() {
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

  _onBundle(bundleContext) {
    if (bundleContext.isData) {
      this._onDataBundle(bundleContext.context);

      return;
    }

    this._onErrorBundle(bundleContext.context);
  }
}
