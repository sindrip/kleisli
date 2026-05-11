import type { SchemaBaseF, Schema } from "./schema.ts";
import { mapBase } from "./schema.ts";

export type Algebra<A> = (node: SchemaBaseF<A>) => A;

// How an algebra handles the recursive fixed point.
// Receives a function: given a self-reference, produce the body's result.
export type Tie<A> = (body: (self: A) => A) => A;

export function cata<A>(alg: Algebra<A>, tie: Tie<A>): (schema: Schema) => A {
  const go = (env: ReadonlyMap<string, A>, schema: Schema): A => {
    if (schema._tag === "Var") {
      const bound = env.get(schema.name);
      if (bound === undefined) throw new Error(`Unbound Var("${schema.name}")`);
      return bound;
    }
    if (schema._tag === "Mu") {
      return tie((self) => {
        const inner = new Map(env);
        inner.set(schema.name, self);
        return go(inner, schema.body);
      });
    }
    return alg(mapBase((child) => go(env, child), schema));
  };
  return (schema) => go(new Map(), schema);
}
