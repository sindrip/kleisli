const SOME: unique symbol = Symbol("SOME");
const NONE: unique symbol = Symbol("NONE");

export type Some<T> = { readonly [SOME]: typeof SOME; readonly value: T };

export type None = { readonly [NONE]: typeof NONE };

export type Option<T> = Some<T> | None;

function some<T>(value: T): Option<T> {
  return { [SOME]: SOME, value };
}

function none(): Option<never> {
  return { [NONE]: NONE };
}

function isSome<T>(option: Option<T>): option is Some<T> {
  return Object.hasOwn(option, SOME);
}

function match<T, U, F>(
  option: Option<T>,
  cases: {
    Some: (value: T) => U;
    None: () => F;
  },
): U | F {
  return isSome(option) ? cases.Some(option.value) : cases.None();
}

export const Option = {
  some,
  none,
  match,
} as const;
