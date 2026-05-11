export type Pred =
  | { readonly _tag: "MinLen"; readonly n: number }
  | { readonly _tag: "MaxLen"; readonly n: number }
  | { readonly _tag: "Pattern"; readonly re: string; readonly flags: string }
  | { readonly _tag: "Min"; readonly n: number; readonly exclusive: boolean }
  | { readonly _tag: "Max"; readonly n: number; readonly exclusive: boolean }
  | { readonly _tag: "Int" }
  | { readonly _tag: "Positive" }
  | { readonly _tag: "NonEmpty" }
  | { readonly _tag: "UUID" }
  | { readonly _tag: "Email" }
  | { readonly _tag: "URL" }
  | { readonly _tag: "And"; readonly left: Pred; readonly right: Pred }
  | { readonly _tag: "Or"; readonly left: Pred; readonly right: Pred }
  | { readonly _tag: "Not"; readonly inner: Pred }
  | {
      readonly _tag: "Custom";
      readonly name: string;
      readonly fn: (x: unknown) => boolean;
    };

// Combinators
export const and = (left: Pred, right: Pred): Pred => ({
  _tag: "And",
  left,
  right,
});
export const or = (left: Pred, right: Pred): Pred => ({
  _tag: "Or",
  left,
  right,
});
export const not = (inner: Pred): Pred => ({ _tag: "Not", inner });

// Constructors
export const minLen = (n: number): Pred => ({ _tag: "MinLen", n });
export const maxLen = (n: number): Pred => ({ _tag: "MaxLen", n });
export const pattern = (re: string, flags = ""): Pred => ({
  _tag: "Pattern",
  re,
  flags,
});
export const min = (n: number, exclusive = false): Pred => ({
  _tag: "Min",
  n,
  exclusive,
});
export const max = (n: number, exclusive = false): Pred => ({
  _tag: "Max",
  n,
  exclusive,
});
export const int: Pred = { _tag: "Int" };
export const positive: Pred = { _tag: "Positive" };
export const nonEmpty: Pred = { _tag: "NonEmpty" };
export const uuid: Pred = { _tag: "UUID" };
export const email: Pred = { _tag: "Email" };
export const url: Pred = { _tag: "URL" };
export const custom = (name: string, fn: (x: unknown) => boolean): Pred => ({
  _tag: "Custom",
  name,
  fn,
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const evalPred = (pred: Pred, value: unknown): boolean => {
  switch (pred._tag) {
    case "MinLen":
      return typeof value === "string" && value.length >= pred.n;
    case "MaxLen":
      return typeof value === "string" && value.length <= pred.n;
    case "Pattern":
      return (
        typeof value === "string" && new RegExp(pred.re, pred.flags).test(value)
      );
    case "Min":
      return (
        typeof value === "number" &&
        (pred.exclusive ? value > pred.n : value >= pred.n)
      );
    case "Max":
      return (
        typeof value === "number" &&
        (pred.exclusive ? value < pred.n : value <= pred.n)
      );
    case "Int":
      return typeof value === "number" && Number.isInteger(value);
    case "Positive":
      return typeof value === "number" && value > 0;
    case "NonEmpty":
      return typeof value === "string"
        ? value.length > 0
        : Array.isArray(value)
          ? value.length > 0
          : false;
    case "UUID":
      return typeof value === "string" && UUID_RE.test(value);
    case "Email":
      return typeof value === "string" && EMAIL_RE.test(value);
    case "URL":
      if (typeof value !== "string") return false;
      try {
        new globalThis.URL(value);
        return true;
      } catch {
        return false;
      }
    case "And":
      return evalPred(pred.left, value) && evalPred(pred.right, value);
    case "Or":
      return evalPred(pred.left, value) || evalPred(pred.right, value);
    case "Not":
      return !evalPred(pred.inner, value);
    case "Custom":
      return pred.fn(value);
  }
};
