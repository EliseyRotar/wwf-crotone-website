/**
 * GET /api/health/redis — public health probe for the Redis instance.
 *
 * Used by UptimeRobot + the status page's external check. Returns 200
 * if the connection works, 503 if it doesn't.
 *
 * Implementation: opens a TCP connection to the Redis URL and sends
 * `PING\r\n`, then reads the response character-by-character. We don't
 * need a full Redis client for a one-shot health check — the protocol
 * is simple enough to do manually. This avoids adding a TCP Redis client
 * dependency just for the probe.
 *
 * Public by design (no auth) — it's a healthcheck.
 */
import { NextResponse } from "next/server";
import net from "node:net";

export const dynamic = "force-dynamic";

function parseRedisUrl(url: string): { host: string; port: number } {
  const u = new URL(url);
  return { host: u.hostname, port: u.port ? Number(u.port) : 6379 };
}

function pingRedis(
  host: string,
  port: number,
  timeoutMs = 3_000
): Promise<{ ok: boolean; latency_ms: number; error?: string; raw?: string }> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    let buf = "";
    const done = (result: { ok: boolean; latency_ms: number; error?: string; raw?: string }) => {
      if (resolved) return;
      resolved = true;
      try { socket.destroy(); } catch { /* noop */ }
      resolve(result);
    };
    const timer = setTimeout(
      () => done({ ok: false, latency_ms: Date.now() - t0, error: "timeout" }),
      timeoutMs
    );

    socket.setNoDelay(true);
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.write("PING\r\n");
    });
    socket.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      // Redis PING response is "+PONG\r\n" (5 bytes). We match the first
      // full response line. If we don't get one in time, the timeout
      // will fire.
      if (buf.includes("\r\n")) {
        clearTimeout(timer);
        const line = buf.split("\r\n")[0];
        const ok = line === "+PONG";
        done({ ok, latency_ms: Date.now() - t0, raw: buf });
      }
    });
    socket.once("error", (err) => {
      clearTimeout(timer);
      done({ ok: false, latency_ms: Date.now() - t0, error: err.message });
    });
    socket.once("timeout", () => {
      clearTimeout(timer);
      done({ ok: false, latency_ms: Date.now() - t0, error: "socket timeout" });
    });
    socket.connect(port, host);
  });
}

export async function GET() {
  const url = process.env.REDIS_URL ?? "redis://redis:6379";
  let target: { host: string; port: number };
  try {
    target = parseRedisUrl(url);
  } catch (e) {
    return NextResponse.json(
      { ok: false, service: "redis", error: "invalid REDIS_URL", url },
      { status: 503 }
    );
  }
  const result = await pingRedis(target.host, target.port);
  return NextResponse.json(
    {
      ok: result.ok,
      service: "redis",
      redis: result.ok ? "ok" : "error",
      host: target.host,
      port: target.port,
      latency_ms: result.latency_ms,
      error: result.error,
      raw: result.raw,
      timestamp: new Date().toISOString(),
    },
    { status: result.ok ? 200 : 503 }
  );
}
