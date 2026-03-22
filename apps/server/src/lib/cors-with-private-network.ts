import type { MiddlewareHandler } from "hono";
import { getCorsAllowedOrigins } from "./cors-origins.js";

const ALLOW_METHODS = ["GET", "POST", "OPTIONS"] as const;
const ALLOW_HEADERS = ["Content-Type"] as const;

export function corsWithPrivateNetworkAccess(): MiddlewareHandler {
  return async (c, next) => {
    const origins = getCorsAllowedOrigins();
    const origin = c.req.header("origin") || "";
    const allowOrigin = origins.includes(origin) ? origin : null;

    if (allowOrigin) {
      c.header("Access-Control-Allow-Origin", allowOrigin);
    }

    if (c.req.method === "OPTIONS") {
      c.header("Vary", "Origin");
      c.header("Access-Control-Allow-Methods", ALLOW_METHODS.join(","));
      c.header("Access-Control-Allow-Headers", ALLOW_HEADERS.join(","));
      if (c.req.header("Access-Control-Request-Private-Network") === "true") {
        c.header("Access-Control-Allow-Private-Network", "true");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content",
      });
    }

    await next();

    if (allowOrigin) {
      c.header("Access-Control-Allow-Private-Network", "true");
      c.header("Vary", "Origin", { append: true });
    }
  };
}
