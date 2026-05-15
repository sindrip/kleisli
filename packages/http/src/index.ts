import { Result } from "@httper/result";
import { Option } from "@httper/option";
import type { Arrow } from "@httper/arrow";

export type { Arrow } from "@httper/arrow";
export { pipe, contramap, alt } from "@httper/arrow";
export { Option } from "@httper/option";

export type Handler<E = never> = Arrow<Request, Response, E>;

export type Route<E = never> = Arrow<Request, Option<Response>, E>;

type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export function route<E>(
  method: HttpMethod,
  path: string,
  handler: Arrow<Request, Response, E>,
): Route<E> {
  return async (request) => {
    const url = new URL(request.url);

    if (request.method !== method || url.pathname !== path) {
      return Result.ok(Option.none());
    }

    const result = await handler(request);

    return Result.match(result, {
      Ok: (response) => Result.ok(Option.some(response)),
      Err: (error) => Result.err(error),
    });
  };
}

export function get<E>(path: string, handler: Arrow<Request, Response, E>) {
  return route("GET", path, handler);
}

export function post<E>(path: string, handler: Arrow<Request, Response, E>) {
  return route("POST", path, handler);
}

export function router<E>(...routes: Route<E>[]): Route<E> {
  return async (request) => {
    for (const r of routes) {
      const result = await r(request);

      if (Result.isErr(result)) {
        return result;
      }

      const matched = Option.match(result.value, {
        Some: () => true,
        None: () => false,
      });

      if (matched) {
        return result;
      }
    }

    return Result.ok(Option.none());
  };
}
