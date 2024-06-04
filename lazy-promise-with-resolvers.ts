import { Err, Ok, type Result, unbox } from "./result.ts";

export function lazyPromiseWithResolvers<T>(
  toStringTag: string,
): PromiseWithResolvers<T> {
  let _promise: Promise<Result<T>> | undefined = undefined;
  let _result: Result<T> | undefined = undefined;

  let settle = (outcome: Result<T>) => {
    if (!_result) {
      _result = outcome;
    }
  };

  let resolve = (value: T) => settle(Ok(value));
  let reject = (error: Error) => settle(Err(error));

  let reify = async () => {
    if (!_promise) {
      if (_result) {
        if (_result.ok) {
          _promise = Promise.resolve(_result);
        } else {
          _promise = Promise.reject(_result);
        }
      } else {
        _promise = new Promise<Result<T>>((resolve) => {
          settle = resolve;
        });
      }
    }

    let result = await _promise;
    return unbox(result);
  };

  //@ts-expect-error no make symbol iterator
  let promise: Promise<T> = {
    [Symbol.toStringTag]: toStringTag,
    then: (...args) => reify().then(...args),
    catch: (...args) => reify().catch(...args),
    finally: (...args) => reify().finally(...args),
  };

  //@ts-expect-error stop being so dramatic.
  return { promise, resolve, reject };
}
