import { expect } from 'chai';

export function expectPromise(promise: Promise<unknown>) {
  return {
    async toResolveAs(value: unknown) {
      let resolvedValue: unknown;

      try {
        resolvedValue = await promise;
      } /* c8 ignore start */ catch (error) {
        expect.fail(`promise threw unexpected error ${error}`);
      } /* c8 ignore stop */
      expect(resolvedValue).to.deep.equal(value);
    },
    async toRejectWith(err: unknown) {
      let caughtError: unknown;

      try {
        await promise; /* c8 ignore start */
        expect.fail(
          'promise should have thrown but did not',
        ); /* c8 ignore stop */
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.deep.equal(err);
    },
    async toRejectWithMessage(message: string) {
      let caughtError: Error;

      try {
        await promise; /* c8 ignore start */
        expect.fail(
          'promise should have thrown but did not',
        ); /* c8 ignore stop */
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError instanceof Error).to.equal(true);
      expect(caughtError.message).to.equal(message);
    },
  };
}
