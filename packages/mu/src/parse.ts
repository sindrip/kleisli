import type { Algebra, Tie } from "./fold.ts";
import { cata } from "./fold.ts";
import type { Schema } from "./schema.ts";
import type { Static } from "./static.ts";
import type { Result, SchemaError } from "./result.ts";
import { ok, err, errs } from "./result.ts";
import { evalPred } from "./pred.ts";

export type Path = readonly (string | number)[];
export type Parser = (x: unknown, path: Path) => Result<unknown>;

const parseTie: Tie<Parser> = (f) => {
  let memo: Parser;
  const proxy: Parser = (x, path) => memo(x, path);
  memo = f(proxy);
  return proxy;
};

export const parseAlg: Algebra<Parser> = (node): Parser => {
  switch (node._tag) {
    case "Null":
      return (x, path) =>
        x === null ? ok(x) : err({ _tag: "TypeMismatch", path, expected: "null", got: x });

    case "Bool":
      return (x, path) =>
        typeof x === "boolean"
          ? ok(x)
          : err({ _tag: "TypeMismatch", path, expected: "boolean", got: x });

    case "Num":
      return (x, path) =>
        typeof x === "number" && !Number.isNaN(x)
          ? ok(x)
          : err({ _tag: "TypeMismatch", path, expected: "number", got: x });

    case "Str":
      return (x, path) =>
        typeof x === "string"
          ? ok(x)
          : err({ _tag: "TypeMismatch", path, expected: "string", got: x });

    case "Literal":
      return (x, path) =>
        x === node.value
          ? ok(x)
          : err({ _tag: "TypeMismatch", path, expected: String(node.value), got: x });

    case "Enum":
      return (x, path) =>
        (node.members as readonly unknown[]).includes(x)
          ? ok(x)
          : err({ _tag: "EnumMismatch", path, expected: node.members, got: x });

    case "Nullable":
      return (x, path) => (x === null ? ok(null) : node.inner(x, path));

    case "Array":
      return (x, path) => {
        if (!Array.isArray(x))
          return err({ _tag: "TypeMismatch", path, expected: "array", got: x });
        const out: unknown[] = [];
        const errors: SchemaError[] = [];
        for (let i = 0; i < x.length; i++) {
          const r = node.item(x[i], [...path, i]);
          if (r._tag === "Ok") out.push(r.value);
          else errors.push(...r.errors);
        }
        return errors.length > 0 ? errs(errors) : ok(out);
      };

    case "Tuple":
      return (x, path) => {
        if (!Array.isArray(x))
          return err({ _tag: "TypeMismatch", path, expected: "tuple", got: x });
        const fixed = node.elements.length;
        if (x.length < fixed)
          return err({ _tag: "TypeMismatch", path, expected: `tuple(${fixed})`, got: x });
        if (node.rest === null && x.length > fixed)
          return err({ _tag: "TypeMismatch", path, expected: `tuple(${fixed})`, got: x });
        const out: unknown[] = [];
        const errors: SchemaError[] = [];
        for (let i = 0; i < fixed; i++) {
          const r = node.elements[i]!(x[i], [...path, i]);
          if (r._tag === "Ok") out.push(r.value);
          else errors.push(...r.errors);
        }
        if (node.rest !== null) {
          for (let i = fixed; i < x.length; i++) {
            const r = node.rest(x[i], [...path, i]);
            if (r._tag === "Ok") out.push(r.value);
            else errors.push(...r.errors);
          }
        }
        return errors.length > 0 ? errs(errors) : ok(out);
      };

    case "Object":
      return (x, path) => {
        if (typeof x !== "object" || x === null || Array.isArray(x))
          return err({ _tag: "TypeMismatch", path, expected: "object", got: x });
        const rec = x as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        const errors: SchemaError[] = [];

        for (const [key, prop] of Object.entries(node.props)) {
          const val = rec[key];
          if (val === undefined && !(key in rec)) {
            if (!prop.optional) errors.push({ _tag: "MissingKey", path, key });
            continue;
          }
          const r = prop.schema(val, [...path, key]);
          if (r._tag === "Ok") out[key] = r.value;
          else errors.push(...r.errors);
        }

        const known = new Set(Object.keys(node.props));
        if (node.additional === false) {
          for (const key of Object.keys(rec)) {
            if (!known.has(key)) errors.push({ _tag: "ExtraKey", path, key });
          }
        } else if (typeof node.additional !== "boolean") {
          for (const key of Object.keys(rec)) {
            if (known.has(key)) continue;
            const r = node.additional(rec[key], [...path, key]);
            if (r._tag === "Ok") out[key] = r.value;
            else errors.push(...r.errors);
          }
        } else {
          for (const key of Object.keys(rec)) {
            if (!known.has(key)) out[key] = rec[key];
          }
        }

        return errors.length > 0 ? errs(errors) : ok(out);
      };

    case "Map":
      return (x, path) => {
        if (typeof x !== "object" || x === null || Array.isArray(x))
          return err({ _tag: "TypeMismatch", path, expected: "map", got: x });
        const rec = x as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        const errors: SchemaError[] = [];
        for (const key of Object.keys(rec)) {
          const kr = node.key(key, [...path, key]);
          if (kr._tag === "Err") {
            errors.push(...kr.errors);
            continue;
          }
          const vr = node.value(rec[key], [...path, key]);
          if (vr._tag === "Err") {
            errors.push(...vr.errors);
            continue;
          }
          out[kr.value as string] = vr.value;
        }
        return errors.length > 0 ? errs(errors) : ok(out);
      };

    case "Union":
      return (x, path) => {
        const branches: SchemaError[][] = [];
        for (const member of node.members) {
          const r = member(x, path);
          if (r._tag === "Ok") return r;
          branches.push([...r.errors]);
        }
        return err({ _tag: "UnionMismatch", path, errors: branches });
      };

    case "Refine":
      return (x, path) => {
        const r = node.base(x, path);
        if (r._tag === "Err") return r;
        return evalPred(node.pred, r.value)
          ? r
          : err({ _tag: "RefinementFailed", path, pred: node.pred, got: r.value });
      };
  }
};

export const parse = (schema: Schema): Parser => cata(parseAlg, parseTie)(schema);

export const decode = <S extends Schema>(schema: S, value: unknown): Result<Static<S>> =>
  parse(schema)(value, []) as Result<Static<S>>;
