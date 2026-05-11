import type { Schema, Prop } from "./schema.ts";
import type { Pred } from "./pred.ts";

// --- Leaves ---

export const Null = { _tag: "Null" } as const;
export const Bool = { _tag: "Bool" } as const;
export const Num = { _tag: "Num" } as const;
export const Str = { _tag: "Str" } as const;

export const literal = <const V extends string | number | boolean | null>(
  value: V,
) => ({ _tag: "Literal" as const, value });

export const enumOf = <const M extends readonly (string | number)[]>(
  name: string,
  members: M,
) => ({ _tag: "Enum" as const, name, members });

// --- Wrappers ---

export const nullable = <S extends Schema>(inner: S) => ({
  _tag: "Nullable" as const,
  inner,
});

export const array = <S extends Schema>(item: S) => ({
  _tag: "Array" as const,
  item,
});

export const refine = <S extends Schema>(base: S, pred: Pred) => ({
  _tag: "Refine" as const,
  base,
  pred,
});

// --- Tuple ---

export function tuple<const E extends readonly Schema[]>(
  elements: [...E],
): { readonly _tag: "Tuple"; readonly elements: E; readonly rest: null };
export function tuple<const E extends readonly Schema[], R extends Schema>(
  elements: [...E],
  rest: R,
): { readonly _tag: "Tuple"; readonly elements: E; readonly rest: R };
export function tuple(elements: readonly Schema[], rest?: Schema) {
  return { _tag: "Tuple" as const, elements, rest: rest ?? null };
}

// --- Object ---

type PropInput = Schema | Prop<Schema>;

type NormalizeProp<V> = V extends {
  readonly schema: infer S;
  readonly optional: infer O;
}
  ? { readonly schema: S; readonly optional: O }
  : V extends Schema
    ? { readonly schema: V; readonly optional: false }
    : never;

type NormalizeProps<P extends Record<string, PropInput>> = {
  readonly [K in keyof P]: NormalizeProp<P[K]>;
};

function isProp(value: PropInput): value is Prop<Schema> {
  return !("_tag" in value);
}

export function object<const P extends Record<string, PropInput>>(
  props: P,
): { readonly _tag: "Object"; readonly props: NormalizeProps<P>; readonly additional: false };
export function object<
  const P extends Record<string, PropInput>,
  const A extends Schema | boolean,
>(
  props: P,
  additional: A,
): { readonly _tag: "Object"; readonly props: NormalizeProps<P>; readonly additional: A };
export function object<const P extends Record<string, PropInput>>(
  props: P,
  additional: Schema | boolean = false,
) {
  const normalized: Record<string, Prop<Schema>> = {};
  for (const [key, value] of Object.entries(props)) {
    normalized[key] = isProp(value)
      ? value
      : { schema: value, optional: false };
  }
  return { _tag: "Object" as const, props: normalized as NormalizeProps<P>, additional };
}

export const optional = <S extends Schema>(schema: S) => ({
  schema,
  optional: true as const,
});

export const required = <S extends Schema>(schema: S) => ({
  schema,
  optional: false as const,
});

// --- Map ---

export const record = <K extends Schema, V extends Schema>(
  key: K,
  value: V,
) => ({ _tag: "Map" as const, key, value });

// --- Union ---

export const union = <const M extends readonly Schema[]>(members: [...M]) => ({
  _tag: "Union" as const,
  members,
});

// --- Recursion ---

export const mu = <const N extends string, B extends Schema>(
  name: N,
  body: (self: { _tag: "Var"; name: N }) => B,
): { _tag: "Mu"; name: N; body: B } => {
  const self = { _tag: "Var" as const, name };
  return { _tag: "Mu" as const, name, body: body(self) };
};

// --- Intersect (smart constructor, not a functor case) ---

type ObjectSchema = Extract<Schema, { readonly _tag: "Object" }>;

export const intersect = <
  A extends ObjectSchema,
  B extends ObjectSchema,
>(a: A, b: B): {
  readonly _tag: "Object";
  readonly props: A["props"] & B["props"];
  readonly additional: A["additional"] extends false
    ? false
    : B["additional"] extends false
      ? false
      : A["additional"];
} => {
  const props: Record<string, Prop<Schema>> = {};
  for (const [key, prop] of Object.entries(a.props)) {
    props[key] = prop;
  }
  for (const [key, prop] of Object.entries(b.props)) {
    if (key in props) throw new Error(`intersect: overlapping key "${key}"`);
    props[key] = prop;
  }
  const additional =
    a.additional === false || b.additional === false
      ? false
      : a.additional === true
        ? b.additional
        : a.additional;
  return {
    _tag: "Object" as const,
    props: props as A["props"] & B["props"],
    additional: additional as any,
  };
};
