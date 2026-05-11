import type { Schema, Prop } from "./schema.ts";

type StaticTupleElements<T extends readonly Schema[], Env extends Record<string, unknown>> = {
  readonly [K in keyof T]: T[K] extends Schema ? StaticInner<T[K], Env> : T[K];
};

type StaticTupleRest<R extends Schema, Env extends Record<string, unknown>> = StaticInner<R, Env>[];

type StaticTuple<
  E extends readonly Schema[],
  R extends Schema | null,
  Env extends Record<string, unknown>,
> = R extends Schema
  ? StaticTupleElements<E, Env> extends infer Elems extends readonly unknown[]
    ? StaticInner<R, Env> extends infer Rest
      ? readonly [...Elems, ...Rest[]]
      : never
    : never
  : StaticTupleElements<E, Env>;

type RequiredKeys<P extends Record<string, Prop<Schema>>> = {
  [K in keyof P]: P[K]["optional"] extends true ? never : K;
}[keyof P];

type OptionalKeys<P extends Record<string, Prop<Schema>>> = {
  [K in keyof P]: P[K]["optional"] extends true ? K : never;
}[keyof P];

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type StaticObject<P extends Record<string, Prop<Schema>>, Env extends Record<string, unknown>> = Simplify<
  { readonly [K in RequiredKeys<P>]: StaticInner<P[K]["schema"], Env> } & {
    readonly [K in OptionalKeys<P>]?: StaticInner<P[K]["schema"], Env>;
  }
>;

type StaticMu<
  N extends string,
  B extends Schema,
  Env extends Record<string, unknown>,
> = StaticInner<B, Omit<Env, N> & { [K in N]: StaticMu<N, B, Env> }>;

type StaticInner<S extends Schema, Env extends Record<string, unknown>> =
  S extends { readonly _tag: "Null" }
    ? null
    : S extends { readonly _tag: "Bool" }
      ? boolean
      : S extends { readonly _tag: "Num" }
        ? number
        : S extends { readonly _tag: "Str" }
          ? string
          : S extends { readonly _tag: "Literal"; readonly value: infer V }
            ? V
            : S extends {
                  readonly _tag: "Enum";
                  readonly members: infer M extends readonly (string | number)[];
                }
              ? M[number]
              : S extends {
                    readonly _tag: "Nullable";
                    readonly inner: infer I extends Schema;
                  }
                ? StaticInner<I, Env> | null
                : S extends {
                      readonly _tag: "Array";
                      readonly item: infer I extends Schema;
                    }
                  ? readonly StaticInner<I, Env>[]
                  : S extends {
                        readonly _tag: "Tuple";
                        readonly elements: infer E extends readonly Schema[];
                        readonly rest: infer R extends Schema | null;
                      }
                    ? StaticTuple<E, R, Env>
                    : S extends {
                          readonly _tag: "Object";
                          readonly props: infer P extends Record<string, Prop<Schema>>;
                        }
                      ? StaticObject<P, Env>
                      : S extends {
                            readonly _tag: "Map";
                            readonly value: infer V extends Schema;
                          }
                        ? Readonly<Record<string, StaticInner<V, Env>>>
                        : S extends {
                              readonly _tag: "Union";
                              readonly members: infer M extends readonly Schema[];
                            }
                          ? StaticInner<M[number], Env>
                          : S extends {
                                readonly _tag: "Refine";
                                readonly base: infer B extends Schema;
                              }
                            ? StaticInner<B, Env>
                            : S extends {
                                  readonly _tag: "Mu";
                                  readonly name: infer N extends string;
                                  readonly body: infer B extends Schema;
                                }
                              ? StaticMu<N, B, Env>
                              : S extends {
                                    readonly _tag: "Var";
                                    readonly name: infer N extends string;
                                  }
                                ? N extends keyof Env ? Env[N] : unknown
                                : never;

export type Static<S extends Schema> = StaticInner<S, {}>;
