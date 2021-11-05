import type { PromiseOrValue } from '../jsutils/PromiseOrValue';
import { Repeater } from '../jsutils/repeater';

/**
 * Given an AsyncIterable and a callback function, return an AsyncIterator
 * which produces values mapped via calling the callback function.
 *
 * See:
 * https://github.com/repeaterjs/repeater/issues/48#issuecomment-569131810
 * https://github.com/repeaterjs/repeater/issues/48#issuecomment-569134039
 */
export function mapAsyncIterator<T, U, R = undefined>(
  iterable: AsyncGenerator<T, R, void> | AsyncIterable<T>,
  fn: (value: T) => PromiseOrValue<U>,
): AsyncGenerator<U, R, void> {
  return new Repeater<U>(async (push, stop) => {
    const iter = iterable[Symbol.asyncIterator]();

    let finalIteration: PromiseOrValue<IteratorResult<T>> | undefined;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    stop.then(() => {
      finalIteration =
        typeof iter.return === 'function'
          ? iter.return()
          : { value: undefined, done: true };
    });

    while (!finalIteration) {
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      const promise = iter.next().then(iteration => {
        if (iteration.done) {
          stop();
          finalIteration = finalIteration ?? iteration;
        }
        return fn(iteration.value);
      });
      // eslint-disable-next-line no-await-in-loop
      await push(promise);
    }

    await finalIteration;
  });
}
