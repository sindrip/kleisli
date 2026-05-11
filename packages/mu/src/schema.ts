import type { Pred } from "./pred.ts";

export type Prop<X> = { readonly schema: X; readonly optional: boolean };

// The base functor — all constructors except binding (Mu/Var).
// Algebras operate on this type. X is strictly positive.
export type SchemaBaseF<X> =
  | { readonly _tag: "Null" }
  | { readonly _tag: "Bool" }
  | { readonly _tag: "Num" }
  | { readonly _tag: "Str" }
  | { readonly _tag: "Literal"; readonly value: string | number | boolean | null }
  | { readonly _tag: "Enum"; readonly name: string; readonly members: readonly (string | number)[] }
  | { readonly _tag: "Nullable"; readonly inner: X }
  | { readonly _tag: "Array"; readonly item: X }
  | { readonly _tag: "Tuple"; readonly elements: readonly X[]; readonly rest: X | null }
  | {
      readonly _tag: "Object";
      readonly props: { readonly [k: string]: Prop<X> };
      readonly additional: X | boolean;
    }
  | { readonly _tag: "Map"; readonly key: X; readonly value: X }
  | { readonly _tag: "Union"; readonly members: readonly X[] }
  | { readonly _tag: "Refine"; readonly base: X; readonly pred: Pred };

// Full functor including binding. cata handles Mu/Var internally;
// algebras never see them.
export type SchemaF<X> =
  | SchemaBaseF<X>
  | { readonly _tag: "Mu"; readonly name: string; readonly body: X }
  | { readonly _tag: "Var"; readonly name: string };

// TS 6 rejects `type Schema = SchemaF<Schema>` (circular through generic).
// Direct recursive union is fine — structurally identical to SchemaF<Schema>.
export type Schema =
  | { readonly _tag: "Null" }
  | { readonly _tag: "Bool" }
  | { readonly _tag: "Num" }
  | { readonly _tag: "Str" }
  | { readonly _tag: "Literal"; readonly value: string | number | boolean | null }
  | { readonly _tag: "Enum"; readonly name: string; readonly members: readonly (string | number)[] }
  | { readonly _tag: "Nullable"; readonly inner: Schema }
  | { readonly _tag: "Array"; readonly item: Schema }
  | { readonly _tag: "Tuple"; readonly elements: readonly Schema[]; readonly rest: Schema | null }
  | {
      readonly _tag: "Object";
      readonly props: { readonly [k: string]: Prop<Schema> };
      readonly additional: Schema | boolean;
    }
  | { readonly _tag: "Map"; readonly key: Schema; readonly value: Schema }
  | { readonly _tag: "Union"; readonly members: readonly Schema[] }
  | { readonly _tag: "Refine"; readonly base: Schema; readonly pred: Pred }
  | { readonly _tag: "Mu"; readonly name: string; readonly body: Schema }
  | { readonly _tag: "Var"; readonly name: string };

export function mapBase<X, Y>(f: (x: X) => Y, node: SchemaBaseF<X>): SchemaBaseF<Y> {
  switch (node._tag) {
    case "Null":
    case "Bool":
    case "Num":
    case "Str":
    case "Literal":
    case "Enum":
      return node;
    case "Nullable":
      return { _tag: "Nullable", inner: f(node.inner) };
    case "Array":
      return { _tag: "Array", item: f(node.item) };
    case "Refine":
      return { _tag: "Refine", base: f(node.base), pred: node.pred };
    case "Map":
      return { _tag: "Map", key: f(node.key), value: f(node.value) };
    case "Tuple":
      return {
        _tag: "Tuple",
        elements: node.elements.map(f),
        rest: node.rest !== null ? f(node.rest) : null,
      };
    case "Union":
      return { _tag: "Union", members: node.members.map(f) };
    case "Object": {
      const props: Record<string, Prop<Y>> = {};
      for (const [key, prop] of Object.entries(node.props)) {
        props[key] = { schema: f(prop.schema), optional: prop.optional };
      }
      const additional =
        typeof node.additional === "boolean" ? node.additional : f(node.additional);
      return { _tag: "Object", props, additional };
    }
  }
}

export function map<X, Y>(f: (x: X) => Y, node: SchemaF<X>): SchemaF<Y> {
  if (node._tag === "Mu") return { _tag: "Mu", name: node.name, body: f(node.body) };
  if (node._tag === "Var") return node;
  return mapBase(f, node);
}
