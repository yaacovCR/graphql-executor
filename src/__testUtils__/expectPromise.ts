import { expect } from 'chai';

export function expectPromise(promise: Promise<unknown>) {
  return {
    async toResolveAs(value: unknown) {
      let resolvedValue: unknown;

      try {
        resolvedValue = await promise;
      } catch (error) {
        // istanbul ignore next (Shouldn't be reached)
        expect.fail(`promise threw unexpected error ${error}`);
      }
      expect(resolvedValue).to.deep.equal(value);
    },
    async toRejectWith(err: unknown) {
      let caughtError: unknown;

      try {
        await promise;
        // istanbul ignore next (Shouldn't be reached)
        expect.fail('promise should have thrown but did not');
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).to.deep.equal(err);
    },
    async toRejectWithMessage(message: string) {
      let caughtError: Error;

      try {
        await promise;
        // istanbul ignore next (Shouldn't be reached)
        expect.fail('promise should have thrown but did not');
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError instanceof Error).to.equal(true);
      expect(caughtError.message).to.equal(message);
    },
  };
}
