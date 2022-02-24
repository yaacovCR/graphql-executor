interface PublisherOptions<TSource, TPayload> {
  payloadFromSource?: (source: TSource, hasNext: boolean) => TPayload;
  onReady?: () => void;
  hasNext?: () => boolean;
  onStop?: () => void;
}
/**
 * @internal
 */
export declare class Publisher<TSource, TPayload = TSource> {
  private _payloadFromSource;
  private _onReady;
  private _hasNext;
  private _buffer;
  private _stopped;
  private _resolve;
  private _trigger;
  private _pushed;
  private _pending;
  private _repeater;
  constructor({
    payloadFromSource,
    onReady,
    hasNext,
    onStop,
  }?: PublisherOptions<TSource, TPayload>);
  emit(key: object, payload: TPayload): void;
  stop(finalPayload?: TPayload): void;
  queue(key: object, source: TSource, parentKey: object): void;
  _pushOne(keySource: { key: object; source: TSource }): void;
  _pushOneImpl({ key, source }: { key: object; source: TSource }): boolean;
  _pushMany(
    keySources: Array<{
      key: object;
      source: TSource;
    }>,
  ): void;
  subscribe(): AsyncGenerator<TPayload>;
}
export {};
