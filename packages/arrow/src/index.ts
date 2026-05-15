import { Result } from "@httper/result";

export type Arrow<I, O, E = never> = (input: I) => Promise<Result<O, E>>;

export function pipe<A, B, C, E1, E2>(
  first: Arrow<A, B, E1>,
  second: Arrow<B, C, E2>,
): Arrow<A, C, E1 | E2> {
  return async (input) => {
    const result = await first(input);

    return Result.match(result, {
      Ok: (value) => second(value),
      Err: (error) => Result.err(error),
    });
  };
}

export function contramap<I, O, E, I2>(
  arrow: Arrow<I, O, E>,
  f: (input: I2) => I,
): Arrow<I2, O, E> {
  return async (input) => {
    return arrow(f(input));
  };
}

export function alt<I, O, E1, E2>(
  first: Arrow<I, O, E1>,
  second: Arrow<I, O, E2>,
): Arrow<I, O, E2> {
  return async (input) => {
    const result = await first(input);

    return Result.match(result, {
      Ok: (value) => Result.ok(value),
      Err: () => second(input),
    });
  };
}
