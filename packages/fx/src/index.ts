// === Result ===

export type Result<E, A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly error: E };

export const Ok = <A>(value: A): Result<never, A> => ({ ok: true, value });
export const Err = <E>(error: E): Result<E, never> => ({ ok: false, error });

// === Effect ===

export type Effect<E, A> = Promise<Result<E, A>>;
export type EffectK<E, A, B> = (a: A) => Effect<E, B>;

// === Bridges ===

export function attempt<A>(fn: () => A | Promise<A>): Effect<unknown, A> {
  return Promise.try(fn).then(Ok, Err);
}

export function tryK<A, B>(
  fn: (a: A) => B | Promise<B>,
): EffectK<unknown, A, B> {
  return (a) => Promise.try(() => fn(a)).then(Ok, Err);
}

export function pure<A, B>(fn: (a: A) => B): EffectK<never, A, B> {
  return async (a) => Ok(fn(a));
}

// === Composition ===

export const idK: <A>() => EffectK<never, A, A> = () => async (a) => Ok(a);

export function compose<E1, E2, A, B, C>(
  f: EffectK<E1, A, B>,
  g: EffectK<E2, B, C>,
): EffectK<E1 | E2, A, C> {
  return async (a) => {
    const rb = await f(a);
    return rb.ok ? g(rb.value) : rb;
  };
}

// Variadic pipe — overloads up to 6 arrows; chain pipes beyond that.
export function pipe<E, A, B>(f1: EffectK<E, A, B>): EffectK<E, A, B>;
export function pipe<E1, E2, A, B, C>(
  f1: EffectK<E1, A, B>,
  f2: EffectK<E2, B, C>,
): EffectK<E1 | E2, A, C>;
export function pipe<E1, E2, E3, A, B, C, D>(
  f1: EffectK<E1, A, B>,
  f2: EffectK<E2, B, C>,
  f3: EffectK<E3, C, D>,
): EffectK<E1 | E2 | E3, A, D>;
export function pipe<E1, E2, E3, E4, A, B, C, D, F>(
  f1: EffectK<E1, A, B>,
  f2: EffectK<E2, B, C>,
  f3: EffectK<E3, C, D>,
  f4: EffectK<E4, D, F>,
): EffectK<E1 | E2 | E3 | E4, A, F>;
export function pipe<E1, E2, E3, E4, E5, A, B, C, D, F, G>(
  f1: EffectK<E1, A, B>,
  f2: EffectK<E2, B, C>,
  f3: EffectK<E3, C, D>,
  f4: EffectK<E4, D, F>,
  f5: EffectK<E5, F, G>,
): EffectK<E1 | E2 | E3 | E4 | E5, A, G>;
export function pipe<E1, E2, E3, E4, E5, E6, A, B, C, D, F, G, H>(
  f1: EffectK<E1, A, B>,
  f2: EffectK<E2, B, C>,
  f3: EffectK<E3, C, D>,
  f4: EffectK<E4, D, F>,
  f5: EffectK<E5, F, G>,
  f6: EffectK<E6, G, H>,
): EffectK<E1 | E2 | E3 | E4 | E5 | E6, A, H>;
export function pipe(
  ...fns: EffectK<any, any, any>[]
): EffectK<any, any, any> {
  return fns.reduce((f, g) => compose(f, g));
}

// === Combinators ===

export function bracket<E1, E2, A, R extends Disposable, B>(
  acquire: EffectK<E1, A, R>,
  use: EffectK<E2, R, B>,
): EffectK<E1 | E2, A, B> {
  return async (a) => {
    const r = await acquire(a);
    if (!r.ok) return r;
    using resource = r.value;
    return use(resource);
  };
}

export function bracketAsync<E1, E2, A, R extends AsyncDisposable, B>(
  acquire: EffectK<E1, A, R>,
  use: EffectK<E2, R, B>,
): EffectK<E1 | E2, A, B> {
  return async (a) => {
    const r = await acquire(a);
    if (!r.ok) return r;
    await using resource = r.value;
    return use(resource);
  };
}

export function alt<E1, E2, A, B>(
  f: EffectK<E1, A, B>,
  g: EffectK<E2, A, B>,
): EffectK<E2, A, B> {
  return async (a) => {
    const r = await f(a);
    return r.ok ? r : g(a);
  };
}

export function parallel<E1, E2, A, B, C>(
  f: EffectK<E1, A, B>,
  g: EffectK<E2, A, C>,
): EffectK<E1 | E2, A, [B, C]> {
  return async (a) => {
    const [rb, rc] = await Promise.all([f(a), g(a)]);
    if (!rb.ok) return rb;
    if (!rc.ok) return rc;
    return Ok([rb.value, rc.value]);
  };
}

// === Streams ===

export function overStream<E, A, B>(
  f: EffectK<E, A, B>,
): EffectK<never, AsyncIterable<A>, AsyncIterable<Result<E, B>>> {
  return async (stream) =>
    Ok(
      (async function* () {
        for await (const a of stream) yield await f(a);
      })(),
    );
}

export function filterOk<E, A>(): EffectK<
  never,
  AsyncIterable<Result<E, A>>,
  AsyncIterable<A>
> {
  return async (stream) =>
    Ok(
      (async function* () {
        for await (const r of stream) if (r.ok) yield r.value;
      })(),
    );
}

export function collect<A>(): EffectK<never, AsyncIterable<A>, A[]> {
  return async (stream) => {
    const out: A[] = [];
    for await (const a of stream) out.push(a);
    return Ok(out);
  };
}

// === Generator-driven do-notation (free functions) ===

export function doSync<E, A>(
  body: () => Generator<Result<E, unknown>, A, any>,
): Result<E, A> {
  const it = body();
  let step = it.next();
  while (!step.done) {
    const r = step.value;
    if (!r.ok) return r as Result<E, A>;
    step = it.next(r.value);
  }
  return Ok(step.value);
}

export async function doAsync<E, A>(
  body: () => AsyncGenerator<Effect<E, unknown>, A, any>,
): Effect<E, A> {
  const it = body();
  let step = await it.next();
  while (!step.done) {
    const r = await step.value;
    if (!r.ok) return r as Result<E, A>;
    step = await it.next(r.value);
  }
  return Ok(step.value);
}

// === Fluent Fx class ===

export class Fx<E, A> implements PromiseLike<Result<E, A>> {
  readonly #thunk: () => Promise<Result<E, A>>;

  private constructor(thunk: () => Promise<Result<E, A>>) {
    this.#thunk = thunk;
  }

  // --- constructors ---

  static of<A>(value: A): Fx<never, A> {
    return new Fx(async () => Ok(value));
  }

  static fail<E>(error: E): Fx<E, never> {
    return new Fx(async () => Err(error));
  }

  static try<A>(fn: () => A | Promise<A>): Fx<unknown, A> {
    return new Fx(() => Promise.try(fn).then(Ok, Err));
  }

  static fromEffect<E, A>(eff: Effect<E, A>): Fx<E, A> {
    return new Fx(() => eff);
  }

  static fromResult<E, A>(r: Result<E, A>): Fx<E, A> {
    return new Fx(async () => r);
  }

  static parallel<E1, E2, A, B>(
    a: Fx<E1, A>,
    b: Fx<E2, B>,
  ): Fx<E1 | E2, [A, B]> {
    return new Fx<E1 | E2, [A, B]>(async () => {
      const [ra, rb] = await Promise.all([a.run(), b.run()]);
      if (!ra.ok) return ra;
      if (!rb.ok) return rb;
      return Ok([ra.value, rb.value]);
    });
  }

  static gen<E, A>(
    body: () => Generator<Fx<E, unknown> | Effect<E, unknown>, A, any>,
  ): Fx<E, A> {
    return new Fx(async () => {
      const it = body();
      let step = it.next();
      while (!step.done) {
        const fx = step.value;
        const r = await (fx instanceof Fx ? fx.run() : fx);
        if (!r.ok) return r as Result<E, A>;
        step = it.next(r.value);
      }
      return Ok(step.value);
    });
  }

  static genAsync<E, A>(
    body: () => AsyncGenerator<Fx<E, unknown> | Effect<E, unknown>, A, any>,
  ): Fx<E, A> {
    return new Fx(async () => {
      const it = body();
      let step = await it.next();
      while (!step.done) {
        const fx = step.value;
        const r = await (fx instanceof Fx ? fx.run() : fx);
        if (!r.ok) return r as Result<E, A>;
        step = await it.next(r.value);
      }
      return Ok(step.value);
    });
  }

  // --- value transformations ---

  map<B>(f: (a: A) => B): Fx<E, B> {
    return new Fx(async () => {
      const r = await this.#thunk();
      return r.ok ? Ok(f(r.value)) : r;
    });
  }

  flatMap<E2, B>(
    f: (a: A) => Fx<E2, B> | Effect<E2, B>,
  ): Fx<E | E2, B> {
    return new Fx<E | E2, B>(async () => {
      const r = await this.#thunk();
      if (!r.ok) return r;
      const next = f(r.value);
      return next instanceof Fx ? next.run() : next;
    });
  }

  filter<E2>(pred: (a: A) => boolean, error: E2): Fx<E | E2, A> {
    return new Fx<E | E2, A>(async () => {
      const r = await this.#thunk();
      if (!r.ok) return r;
      return pred(r.value) ? r : Err(error);
    });
  }

  tap(f: (a: A) => void | Promise<void>): Fx<unknown, A> {
    return new Fx(async () => {
      const r = await this.#thunk();
      if (r.ok) {
        try {
          await f(r.value);
        } catch (e) {
          return Err(e);
        }
      }
      return r;
    });
  }

  // --- error transformations ---

  mapError<E2>(f: (e: E) => E2): Fx<E2, A> {
    return new Fx(async () => {
      const r = await this.#thunk();
      return r.ok ? r : Err(f(r.error));
    });
  }

  catch<E2, B>(
    handler: (e: E) => Fx<E2, B> | Effect<E2, B>,
  ): Fx<E2, A | B> {
    return new Fx<E2, A | B>(async () => {
      const r = await this.#thunk();
      if (r.ok) return r;
      const next = handler(r.error);
      return next instanceof Fx ? next.run() : next;
    });
  }

  recover(f: (e: E) => A): Fx<never, A> {
    return new Fx(async () => {
      const r = await this.#thunk();
      return r.ok ? r : Ok(f(r.error));
    });
  }

  tapError(f: (e: E) => void | Promise<void>): Fx<unknown, A> {
    return new Fx(async () => {
      const r = await this.#thunk();
      if (!r.ok) {
        try {
          await f(r.error);
        } catch (e) {
          return Err(e);
        }
      }
      return r;
    });
  }

  orElse<E2, B>(alt: Fx<E2, B>): Fx<E2, A | B> {
    return new Fx<E2, A | B>(async () => {
      const r = await this.#thunk();
      return r.ok ? r : alt.run();
    });
  }

  // --- resource scoping ---

  use<E2, B>(
    this: Fx<E, A & Disposable>,
    fn: (r: A) => Fx<E2, B> | Effect<E2, B>,
  ): Fx<E | E2, B> {
    return new Fx<E | E2, B>(async () => {
      const r = await this.#thunk();
      if (!r.ok) return r;
      using resource = r.value;
      const next = fn(resource);
      return next instanceof Fx ? next.run() : next;
    });
  }

  useAsync<E2, B>(
    this: Fx<E, A & AsyncDisposable>,
    fn: (r: A) => Fx<E2, B> | Effect<E2, B>,
  ): Fx<E | E2, B> {
    return new Fx<E | E2, B>(async () => {
      const r = await this.#thunk();
      if (!r.ok) return r;
      await using resource = r.value;
      const next = fn(resource);
      return next instanceof Fx ? next.run() : next;
    });
  }

  // --- running / awaiting ---

  run(): Effect<E, A> {
    return this.#thunk();
  }

  then<R1 = Result<E, A>, R2 = never>(
    onfulfilled?:
      | ((v: Result<E, A>) => R1 | PromiseLike<R1>)
      | null
      | undefined,
    onrejected?:
      | ((r: any) => R2 | PromiseLike<R2>)
      | null
      | undefined,
  ): PromiseLike<R1 | R2> {
    return this.#thunk().then(onfulfilled, onrejected);
  }
}
