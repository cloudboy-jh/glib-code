import { Hono } from "hono";
import { getGitHubToken } from "../services/gittrix";

export const authRoutes = new Hono()
  .get("/session", async (c) => {
    const githubToken = await getGitHubToken();
    return c.json({ signedIn: Boolean(githubToken), github: { connected: Boolean(githubToken) } });
  })
  .post("/github", async (c) => {
    const githubToken = await getGitHubToken();
    if (!githubToken) return c.json({ ok: false, message: "Run `gh auth login` or set GITHUB_TOKEN/GH_TOKEN to connect GitHub." }, 400);
    return c.json({ ok: true, connected: true });
  })
  .post("/signout", (c) => c.json({ ok: true }));
