import type { Pred } from "./pred.ts";

export type Path = readonly (string | number)[];

export type SchemaError =
  | { readonly _tag: "TypeMismatch"; readonly path: Path; readonly expected: string; readonly got: unknown }
  | { readonly _tag: "RefinementFailed"; readonly path: Path; readonly pred: Pred; readonly got: unknown }
  | { readonly _tag: "MissingKey"; readonly path: Path; readonly key: string }
  | { readonly _tag: "ExtraKey"; readonly path: Path; readonly key: string }
  | { readonly _tag: "UnionMismatch"; readonly path: Path; readonly errors: readonly (readonly SchemaError[])[] }
  | { readonly _tag: "EnumMismatch"; readonly path: Path; readonly expected: readonly (string | number)[]; readonly got: unknown };

export type Result<A> =
  | { readonly _tag: "Ok"; readonly value: A }
  | { readonly _tag: "Err"; readonly errors: readonly SchemaError[] };

export const ok = <A>(value: A): Result<A> => ({ _tag: "Ok", value });
export const err = (...errors: SchemaError[]): Result<never> => ({ _tag: "Err", errors });
export const errs = (errors: readonly SchemaError[]): Result<never> => ({ _tag: "Err", errors });

export const flatMap = <A, B>(ra: Result<A>, f: (a: A) => Result<B>): Result<B> =>
  ra._tag === "Ok" ? f(ra.value) : ra;

export const map = <A, B>(ra: Result<A>, f: (a: A) => B): Result<B> =>
  ra._tag === "Ok" ? ok(f(ra.value)) : ra;
