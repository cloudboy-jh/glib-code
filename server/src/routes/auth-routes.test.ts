import { beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authRoutes } from "./auth";

let root = "";
let app: Hono;

beforeEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = await mkdtemp(join(tmpdir(), "glib-auth-routes-"));
  process.env.GLIB_CONFIG_DIR = join(root, "config");
  process.env.APPDATA = root;
  delete process.env.GITHUB_OAUTH_CLIENT_ID;
  delete process.env.GH_OAUTH_CLIENT_ID;
  app = new Hono();
  app.route("/api/auth", authRoutes);
});

describe("auth routes", () => {
  test("GitHub device flow returns actionable config error without client id", async () => {
    const res = await app.request("/api/auth/github/device/start", { method: "POST" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("GITHUB_OAUTH_CLIENT_ID_MISSING");
  });
});
