import type { PromiseOrValue } from 'graphql/jsutils/PromiseOrValue';
interface PublisherOptions<TSource, TPayload> {
  payloadFromSource?: (source: TSource, hasNext: boolean) => TPayload;
  onReady?: () => void;
  hasNext?: () => boolean;
  onStop?: () => PromiseOrValue<void>;
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
  emit(keys: Array<object>, payload: TPayload): void;
  stop(finalPayload?: TPayload): void;
  queue(keys: Array<object>, source: TSource, parentKey: object): void;
  _pushOne(context: { keys: Array<object>; source: TSource }): void;
  _pushOneImpl({
    keys,
    source,
  }: {
    keys: Array<object>;
    source: TSource;
  }): boolean;
  _pushMany(
    contexts: Array<{
      keys: Array<object>;
      source: TSource;
    }>,
  ): void;
  subscribe(): AsyncGenerator<TPayload>;
}
export {};
