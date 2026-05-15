import { Result } from "@httper/result";
import { fetch } from "./app.ts";
import { createServer, toNodeHandler } from "./server.ts";

const handler = async (request: Request): Promise<Response> => {
  const result = await fetch(request);

  return Result.match(result, {
    Ok: (response) => response,
    Err: (absurd) => absurd satisfies never,
  });
};

createServer(toNodeHandler(handler)).listen(3000, "127.0.0.1");

console.log("Listening on http://localhost:3000");
