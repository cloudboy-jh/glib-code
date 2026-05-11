import { Hono } from "hono";
import { getGitHubToken } from "../services/gittrix-service";

async function getGitHubAccount(token: string) {
  if (!token) return null;
  const response = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "glib-code"
    }
  }).catch(() => null);
  if (!response?.ok) return null;
  const user = await response.json().catch(() => null) as { login?: string; name?: string; email?: string } | null;
  if (!user?.login) return null;
  return { login: user.login, name: user.name ?? "", email: user.email ?? "" };
}

export const authRoutes = new Hono()
  .get("/session", async (c) => {
    const githubToken = await getGitHubToken();
    const account = githubToken ? await getGitHubAccount(githubToken) : null;
    return c.json({ signedIn: Boolean(githubToken), github: { connected: Boolean(githubToken), account } });
  })
  .post("/github", async (c) => {
    const githubToken = await getGitHubToken();
    if (!githubToken) return c.json({ ok: false, message: "Run `gh auth login` or set GITHUB_TOKEN/GH_TOKEN to connect GitHub." }, 400);
    return c.json({ ok: true, connected: true, account: await getGitHubAccount(githubToken) });
  })
  .post("/signout", (c) => c.json({ ok: true }));
