import { Hono } from "hono";
import { getGitHubToken } from "../services/gittrix-service";
import { clearGitHubAuth, getGitHubAccount, pollGitHubDeviceFlow, startGitHubDeviceFlow } from "../services/github-auth";

const routeError = (message: string, code: string, retryable = false) => ({ ok: false, code, message, retryable });

export const authRoutes = new Hono()
  .get("/session", async (c) => {
    const githubToken = await getGitHubToken();
    const account = githubToken ? await getGitHubAccount(githubToken) : null;
    return c.json({ signedIn: Boolean(githubToken), github: { connected: Boolean(githubToken), account } });
  })
  .post("/github", async (c) => {
    const githubToken = await getGitHubToken();
    if (!githubToken) return c.json(routeError("Sign in with GitHub first.", "GITHUB_AUTH_REQUIRED"), 400);
    return c.json({ ok: true, connected: true, account: await getGitHubAccount(githubToken) });
  })
  .post("/github/device/start", async (c) => {
    try {
      return c.json(await startGitHubDeviceFlow());
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      return c.json(routeError(error instanceof Error ? error.message : "failed to start GitHub sign-in", code || "GITHUB_DEVICE_START_FAILED", true), code ? 400 : 500);
    }
  })
  .post("/github/device/poll", async (c) => {
    const body = await c.req.json().catch(() => null) as { deviceCode?: string } | null;
    if (!body?.deviceCode) return c.json(routeError("deviceCode required", "DEVICE_CODE_REQUIRED"), 400);
    try {
      return c.json(await pollGitHubDeviceFlow(body.deviceCode));
    } catch (error) {
      return c.json(routeError(error instanceof Error ? error.message : "GitHub sign-in failed", "GITHUB_DEVICE_POLL_FAILED", true), 500);
    }
  })
  .delete("/github", async (c) => {
    await clearGitHubAuth();
    return c.json({ ok: true });
  })
  .post("/signout", async (c) => {
    await clearGitHubAuth();
    return c.json({ ok: true });
  });
