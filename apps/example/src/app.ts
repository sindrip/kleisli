import { Result } from "@httper/result";
import { get, router, Option, type Handler } from "@httper/http";

const app = router(
  get("/", async () => {
    return Result.ok(new Response("Hello, world!\n"));
  }),

  get("/health", async () => {
    return Result.ok(new Response("ok\n"));
  }),
);

export const fetch: Handler = async (request) => {
  const result = await app(request);

  return Result.match(result, {
    Ok: (option) =>
      Result.ok(
        Option.match(option, {
          Some: (response) => response,
          None: () => new Response("Not Found\n", { status: 404 }),
        }),
      ),
    Err: (absurd) => absurd satisfies never,
  });
};
