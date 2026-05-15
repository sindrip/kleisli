import { createServer, type RequestListener } from "node:http";

type FetchHandler = (request: Request) => Promise<Response>;

export function toNodeHandler(handler: FetchHandler): RequestListener {
  return async (req, res) => {
    const host = req.headers.host ?? "localhost";
    const url = `http://${host}${req.url ?? "/"}`;
    const request = new Request(url, { method: req.method });
    const response = await handler(request);

    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  };
}

export { createServer };
