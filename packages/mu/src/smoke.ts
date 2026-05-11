import {
  Null,
  Bool,
  Num,
  Str,
  literal,
  enumOf,
  nullable,
  array,
  refine,
  tuple,
  object,
  optional,
  record,
  union,
  mu,
  intersect,
} from "./constructors.ts";
import { minLen, min, int, uuid } from "./pred.ts";
import { decode, parse } from "./parse.ts";
import type { Static } from "./static.ts";

// --- 1. Tuple with rest ---

const Row = tuple([Str, Num], Bool);
type TRow = Static<typeof Row>;
function _check1(row: TRow) {
  const _r0: string = row[0];
  const _r1: number = row[1];
  const _r2: boolean = row[2]!; // rest element (noUncheckedIndexedAccess)
}

// --- 2. Refine (erases to base — branding not yet implemented) ---

const NonEmptyStr = refine(Str, minLen(1));
type TNonEmptyStr = Static<typeof NonEmptyStr>;
const _nes: string = "" as TNonEmptyStr;

const UUIDStr = refine(Str, uuid);
type TUUIDStr = Static<typeof UUIDStr>;
const _uuid: string = "" as TUUIDStr;

// --- 3. Enum ---

const Color = enumOf("Color", ["red", "green", "blue"] as const);
type TColor = Static<typeof Color>;
const _c: "red" | "green" | "blue" = "" as TColor;

// --- 4. Map ---

const Dict = record(Str, Num);
type TDict = Static<typeof Dict>;
function _check4(dict: TDict) {
  const _dv: number = dict["any_key"]!;
}

// --- 5. Union ---

const StrOrNum = union([Str, Num]);
type TStrOrNum = Static<typeof StrOrNum>;
const _su1: TStrOrNum = "hello";
const _su2: TStrOrNum = 42;

// --- 6. Nested recursion (tree) ---

const Tree = mu("Tree", (self) =>
  object({ value: Num, children: array(self) }),
);
type TTree = Static<typeof Tree>;
type ManualTree = {
  readonly value: number;
  readonly children: readonly ManualTree[];
};
function _check6(tree: TTree, mt: ManualTree) {
  const _tv: number = tree.value;
  const _tc: readonly TTree[] = tree.children;
  const _ta: ManualTree = tree;
  const _tb: TTree = mt;
}

// --- 7. Parse round-trips ---

// Recursive: linked list
const LL = mu("LL", (self) => object({ value: Num, next: nullable(self) }));
type TLL = Static<typeof LL>;
type ManualLL = { readonly value: number; readonly next: ManualLL | null };
function _check7a(ll: TLL, manual: ManualLL) {
  const _v: number = ll.value;
  const _n: TLL | null = ll.next;
  const _a: ManualLL = ll;
  const _b: TLL = manual;
}

const r1 = decode(LL, { value: 1, next: { value: 2, next: null } });
if (r1._tag !== "Ok") throw new Error("expected Ok");

const r2 = decode(LL, { value: 1, next: { value: "bad", next: null } });
if (r2._tag !== "Err") throw new Error("expected Err");

const r3 = decode(Tree, {
  value: 1,
  children: [
    { value: 2, children: [] },
    { value: 3, children: [{ value: 4, children: [] }] },
  ],
});
if (r3._tag !== "Ok") throw new Error("expected Ok");

const r4 = decode(Tree, {
  value: 1,
  children: [{ value: "bad", children: [] }],
});
if (r4._tag !== "Err") throw new Error("expected Err");

// Non-recursive
const User = object({ name: Str, age: Num, email: optional(Str) });
type TUser = Static<typeof User>;
function _check7b(u: TUser) {
  const _name: string = u.name;
  const _age: number = u.age;
}

const r5 = decode(User, { name: "Alice", age: 30 });
if (r5._tag !== "Ok") throw new Error("expected Ok");

const r6 = decode(User, { name: "Alice", age: 30, email: "a@b.c" });
if (r6._tag !== "Ok") throw new Error("expected Ok with optional");

const r7 = decode(User, { name: 123 });
if (r7._tag !== "Err") throw new Error("expected Err");

// --- 8. Stress test: deep, wide schema using every constructor ---

const Status = enumOf("Status", ["active", "inactive", "banned"] as const);

const Address = object({
  street: Str,
  city: Str,
  zip: refine(Str, minLen(5)),
  country: Str,
  coords: optional(tuple([Num, Num])),
});

const ContactMethod = union([
  object({ type: literal("email"), address: refine(Str, minLen(3)) }),
  object({ type: literal("phone"), number: Str, ext: optional(Num) }),
  object({ type: literal("postal"), address: Address }),
]);

const Permission = enumOf("Permission", ["read", "write", "admin"] as const);

const Role = object({
  name: Str,
  permissions: array(Permission),
  metadata: record(Str, union([Str, Num, Bool, Null])),
});

const AuditEntry = object({
  timestamp: Num,
  action: Str,
  detail: nullable(Str),
  tags: tuple([Str], Str),
});

const OrgNode = mu("OrgNode", (self) =>
  object({
    id: refine(Str, uuid),
    name: Str,
    status: Status,
    head: nullable(
      object({
        name: Str,
        contacts: array(ContactMethod),
        roles: array(Role),
      }),
    ),
    children: array(self),
    auditLog: array(AuditEntry),
    settings: record(Str, union([Str, Num, Bool, Null])),
  }),
);

type TOrgNode = Static<typeof OrgNode>;

type ManualOrgNode = {
  readonly id: string;
  readonly name: string;
  readonly status: "active" | "inactive" | "banned";
  readonly head: {
    readonly name: string;
    readonly contacts: readonly (
      | { readonly type: "email"; readonly address: string }
      | {
          readonly type: "phone";
          readonly number: string;
          readonly ext?: number;
        }
      | {
          readonly type: "postal";
          readonly address: {
            readonly street: string;
            readonly city: string;
            readonly zip: string;
            readonly country: string;
            readonly coords?: readonly [number, number];
          };
        }
    )[];
    readonly roles: readonly {
      readonly name: string;
      readonly permissions: readonly ("read" | "write" | "admin")[];
      readonly metadata: Readonly<
        Record<string, string | number | boolean | null>
      >;
    }[];
  } | null;
  readonly children: readonly ManualOrgNode[];
  readonly auditLog: readonly {
    readonly timestamp: number;
    readonly action: string;
    readonly detail: string | null;
    readonly tags: readonly [string, ...string[]];
  }[];
  readonly settings: Readonly<Record<string, string | number | boolean | null>>;
};

function _check8(orgFromStatic: TOrgNode, orgFromManual: ManualOrgNode) {
  const _org_a: ManualOrgNode = orgFromStatic;
  const _org_b: TOrgNode = orgFromManual;
}

// --- 9. Stress test: ~350 schema nodes, 8 levels deep ---

// L0: 10 leaf-level building blocks (~40 nodes)
const Timestamp = refine(Num, min(0));
const Email = refine(Str, minLen(3));
const PosInt = refine(Num, int);
const Tag = refine(Str, minLen(1));
const Priority = enumOf("Priority", [1, 2, 3, 4, 5] as const);
const Severity = enumOf("Severity", [
  "low",
  "medium",
  "high",
  "critical",
] as const);
const Visibility = enumOf("Visibility", [
  "public",
  "private",
  "internal",
] as const);
const Pair = tuple([Str, Num]);
const StrOrNull = nullable(Str);
const Tags = array(Tag);

// L1: small composites (~50 nodes)
const GeoPoint = object({
  lat: Num,
  lon: Num,
  alt: optional(Num),
  accuracy: optional(Num),
});
const TimeRange = object({
  start: Timestamp,
  end: Timestamp,
  tz: optional(Str),
});
const Attachment = object({
  url: Str,
  mime: Str,
  size: PosInt,
  name: optional(Str),
  hash: optional(Str),
});
const Label = object({
  key: Tag,
  value: Str,
  color: optional(Str),
});

// L2: medium composites referencing L1 (~60 nodes)
const Location = object({
  name: Str,
  point: GeoPoint,
  address: optional(Address),
  tags: Tags,
  bounds: optional(tuple([GeoPoint, GeoPoint])),
});
const Schedule = object({
  windows: array(TimeRange),
  exceptions: array(TimeRange),
  recurrence: optional(Str),
  tz: Str,
});
const MediaItem = object({
  id: Str,
  attachment: Attachment,
  labels: array(Label),
  uploadedAt: Timestamp,
  visibility: Visibility,
});

// L3: complex composites referencing L2 (~80 nodes)
const Event = object({
  id: Str,
  title: Str,
  description: StrOrNull,
  severity: Severity,
  priority: Priority,
  location: optional(Location),
  schedule: optional(Schedule),
  media: array(MediaItem),
  tags: Tags,
  metadata: record(Str, union([Str, Num, Bool, Null])),
});
const Profile = object({
  displayName: Str,
  bio: StrOrNull,
  avatar: optional(Attachment),
  contacts: array(ContactMethod),
  locations: array(Location),
  preferences: record(Str, union([Str, Num, Bool])),
});

// L4: deep composites referencing L3 (~50 nodes)
const Channel = object({
  id: Str,
  name: Str,
  owner: Profile,
  events: array(Event),
  pinned: optional(Event),
  visibility: Visibility,
  created: Timestamp,
});
const Campaign = object({
  id: Str,
  name: Str,
  channels: array(Channel),
  schedule: Schedule,
  budget: optional(object({ amount: Num, currency: Str })),
  status: Status,
});

// L5: recursive type referencing L4 (~30 nodes)
const Workspace = mu("Workspace", (self) =>
  object({
    id: Str,
    name: Str,
    owner: Profile,
    campaigns: array(Campaign),
    children: array(self),
    parent: nullable(self),
    tags: Tags,
    settings: record(Str, union([Str, Num, Bool, Null])),
  }),
);

type TWorkspace = Static<typeof Workspace>;

// Verify resolution through every level of nesting
function _check9(ws: TWorkspace) {
  const _s1: string = ws.name;
  const _s2: string = ws.owner.displayName;
  const _s3: string | null = ws.owner.bio;
  const _s4: readonly TWorkspace[] = ws.children;
  const _s5: TWorkspace | null = ws.parent;
  const _s6: string = ws.campaigns[0]!.channels[0]!.owner.displayName;
  const _s7: string = ws.campaigns[0]!.channels[0]!.events[0]!.title;
  const _s8: string =
    ws.campaigns[0]!.channels[0]!.events[0]!.media[0]!.attachment.url;
  const _s9: number =
    ws.campaigns[0]!.channels[0]!.events[0]!.media[0]!.uploadedAt;
  const _s10: "low" | "medium" | "high" | "critical" =
    ws.campaigns[0]!.channels[0]!.events[0]!.severity;
  const _s11: TWorkspace | null = ws.children[0]!.children[0]!.parent;
  const _s12: number = ws.campaigns[0]!.schedule.windows[0]!.start;
}

// --- 10. Mutual recursion: Expr / Stmt ---

// Bekic-style: each definition inlines the other's fixpoint
const Expr = mu("Expr", (expr) => {
  const stmt = mu("Stmt", (stmt) =>
    union([
      object({ type: literal("expr"), expr }),
      object({ type: literal("let"), name: Str, value: expr }),
      object({
        type: literal("if"),
        cond: expr,
        then: array(stmt),
        else: optional(array(stmt)),
      }),
    ]),
  );
  return union([
    object({ type: literal("num"), value: Num }),
    object({ type: literal("add"), left: expr, right: expr }),
    object({ type: literal("block"), body: array(stmt) }),
  ]);
});

const Stmt = mu("Stmt", (stmt) => {
  const expr = mu("Expr", (expr) =>
    union([
      object({ type: literal("num"), value: Num }),
      object({ type: literal("add"), left: expr, right: expr }),
      object({ type: literal("block"), body: array(stmt) }),
    ]),
  );
  return union([
    object({ type: literal("expr"), expr }),
    object({ type: literal("let"), name: Str, value: expr }),
    object({
      type: literal("if"),
      cond: expr,
      then: array(stmt),
      else: optional(array(stmt)),
    }),
  ]);
});

type TExpr = Static<typeof Expr>;
type TStmt = Static<typeof Stmt>;

function _check10(expr: TExpr, stmt: TStmt) {
  // Discriminated union narrowing through mutual recursion
  if (expr.type === "num") {
    const _e1: number = expr.value;
  }
  if (expr.type === "block") {
    const s = expr.body[0]!;
    if (s.type === "let") {
      const _e2: string = s.name;
    }
  }
  if (stmt.type === "let") {
    const _st1: string = stmt.name;
    const e = stmt.value;
    if (e.type === "num") {
      const _st2: number = e.value;
    }
  }
  if (stmt.type === "if") {
    const _st3 = stmt.then[0]!;
  }
}

// Runtime: parse round-trip
const r8 = decode(Expr, {
  type: "add",
  left: { type: "num", value: 1 },
  right: { type: "num", value: 2 },
});
if (r8._tag !== "Ok") throw new Error("expected Ok");

const r9 = decode(Stmt, {
  type: "let",
  name: "x",
  value: { type: "num", value: 42 },
});
if (r9._tag !== "Ok") throw new Error("expected Ok");

// --- 11. Unguarded Mu ---
// mu("x", self => self) is μx.x — a degenerate fixpoint with no structural content.
// Static can't resolve it (TS2615: circular without object indirection).
// Runtime parse would diverge. Both are correct: unguarded Mu is meaningless.
const Divergent = mu("x", (self) => self);

// --- 12. Shadowed binders ---
// Same-name shadowing works at runtime (cata uses Map.set, inner wins) but
// hits TS2615 at the type level. Different names work fine (test 10).
// Use parse() directly to bypass Static computation in decode's return type.
const Shadowed = mu("x", (_outer) => mu("x", (inner) => object({ a: inner })));
const r10 = parse(Shadowed)({ a: { a: { a: {} } } }, []);

// --- 13. Unbound Var ---

// Constructing a raw Var without Mu — cata should throw at runtime
const Unbound = object({ bad: { _tag: "Var" as const, name: "nope" } });
let unboundThrew = false;
try {
  parse(Unbound);
} catch (e) {
  if (e instanceof Error && e.message.includes("Unbound")) unboundThrew = true;
}
if (!unboundThrew) throw new Error("expected Unbound Var to throw");

// --- 14. Intersect ---

const Base = object({ id: Str, created: Num });
const WithName = object({ name: Str, tags: array(Str) });
const Merged = intersect(Base, WithName);
type TMerged = Static<typeof Merged>;
function _check14(merged: TMerged) {
  const _m1: string = merged.id;
  const _m2: number = merged.created;
  const _m3: string = merged.name;
  const _m4: readonly string[] = merged.tags;
}

const r11 = decode(Merged, {
  id: "abc",
  created: 1,
  name: "test",
  tags: ["a"],
});
if (r11._tag !== "Ok") throw new Error("expected Ok");

const r12 = decode(Merged, { id: "abc", created: 1 });
if (r12._tag !== "Err")
  throw new Error("expected Err — missing intersected keys");

// Overlapping keys should throw at construction time
let overlapThrew = false;
try {
  intersect(object({ x: Str }), object({ x: Num }));
} catch (e) {
  if (e instanceof Error && e.message.includes("overlapping"))
    overlapThrew = true;
}
if (!overlapThrew) throw new Error("expected overlapping key to throw");

// --- 15. Additional properties on Object ---

const Strict = object({ name: Str });
const Open = object({ name: Str }, true);
const Typed = object({ name: Str }, Num);

const r13 = decode(Strict, { name: "a", extra: 1 });
if (r13._tag !== "Err") throw new Error("expected Err — extra key on strict");

const r14 = decode(Open, { name: "a", extra: 1 });
if (r14._tag !== "Ok")
  throw new Error("expected Ok — open object allows extra");

const r15 = decode(Typed, { name: "a", count: 42 });
if (r15._tag !== "Ok") throw new Error("expected Ok — typed additional");

const r16 = decode(Typed, { name: "a", count: "bad" });
if (r16._tag !== "Err")
  throw new Error("expected Err — additional must be Num");

// --- 16. Empty edge cases ---

const EmptyObj = object({});
type TEmptyObj = Static<typeof EmptyObj>;
const r17 = decode(EmptyObj, {});
if (r17._tag !== "Ok") throw new Error("expected Ok — empty object");
const r18 = decode(EmptyObj, { x: 1 });
if (r18._tag !== "Err")
  throw new Error("expected Err — strict empty rejects keys");

const EmptyTuple = tuple([]);
type TEmptyTuple = Static<typeof EmptyTuple>;
const r19 = decode(EmptyTuple, []);
if (r19._tag !== "Ok") throw new Error("expected Ok — empty tuple");
const r20 = decode(EmptyTuple, [1]);
if (r20._tag !== "Err")
  throw new Error("expected Err — empty tuple rejects elements");

const SingleUnion = union([Str]);
type TSingleUnion = Static<typeof SingleUnion>;
const _su: string = "" as TSingleUnion;
const r21 = decode(SingleUnion, "hello");
if (r21._tag !== "Ok") throw new Error("expected Ok — single union");

// --- 17. Error accumulation ---

const Multi = object({
  a: Num,
  b: Num,
  c: Num,
  d: object({ e: Str, f: Str }),
});

const r22 = decode(Multi, { a: "x", b: "y", c: "z", d: { e: 1, f: 2 } });
if (r22._tag !== "Err") throw new Error("expected Err");
// Should accumulate errors for a, b, c AND nested d.e, d.f
if (r22.errors.length < 5)
  throw new Error(`expected 5 errors, got ${r22.errors.length}`);
