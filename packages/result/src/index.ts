const OK: unique symbol = Symbol("OK");
const ERR: unique symbol = Symbol("ERR");

export type Ok<T> = { readonly [OK]: typeof OK; readonly value: T };

export type Err<E> = { readonly [ERR]: typeof ERR; readonly error: E };

export type Result<T, E> = Ok<T> | Err<E>;

function ok<T>(value: T): Result<T, never> {
  return { [OK]: OK, value };
}

function err<E>(error: E): Result<never, E> {
  return { [ERR]: ERR, error };
}

function isOk<T>(result: Result<T, unknown>): result is Ok<T> {
  return Object.hasOwn(result, OK);
}

function isErr<E>(result: Result<unknown, E>): result is Err<E> {
  return Object.hasOwn(result, ERR);
}

function match<T, E, U, F>(
  result: Result<T, E>,
  cases: {
    Ok: (value: T) => U;
    Err: (error: E) => F;
  },
): U | F {
  return isOk(result) ? cases.Ok(result.value) : cases.Err(result.error);
}

export const Result = {
  ok,
  err,
  isOk,
  isErr,
  match,
} as const;
