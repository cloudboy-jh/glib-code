import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { getConfigDir } from "../lib/paths";
import { writeJsonAtomic } from "../lib/atomic-write";

type GitHubAuthState = {
  accessToken?: string;
  account?: { login?: string; name?: string; email?: string; avatarUrl?: string } | null;
  updatedAt?: string;
};

function authPath() {
  return join(getConfigDir(), "auth", "github.json");
}

function clientId() {
  return process.env.GITHUB_OAUTH_CLIENT_ID || process.env.GH_OAUTH_CLIENT_ID || "";
}

async function readState(): Promise<GitHubAuthState> {
  const path = authPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, "utf8")) as GitHubAuthState;
  } catch {
    return {};
  }
}

async function writeState(state: GitHubAuthState) {
  await writeJsonAtomic(authPath(), state);
}

export async function getStoredGitHubToken() {
  return (await readState()).accessToken ?? "";
}

export async function clearGitHubAuth() {
  await rm(authPath(), { force: true });
}

export async function getGitHubAccount(token: string) {
  if (!token) return null;
  const response = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "glib-code"
    }
  }).catch(() => null);
  if (!response?.ok) return null;
  const user = await response.json().catch(() => null) as { login?: string; name?: string; email?: string; avatar_url?: string } | null;
  if (!user?.login) return null;
  return { login: user.login, name: user.name ?? "", email: user.email ?? "", avatarUrl: user.avatar_url ?? "" };
}

export async function getStoredGitHubAccount() {
  const token = await getStoredGitHubToken();
  if (!token) return null;
  const account = await getGitHubAccount(token);
  if (account) await writeState({ accessToken: token, account, updatedAt: new Date().toISOString() });
  return account;
}

export async function startGitHubDeviceFlow() {
  const id = clientId();
  if (!id) {
    const error = new Error("GitHub OAuth client id is not configured. Set GITHUB_OAUTH_CLIENT_ID.");
    (error as Error & { code?: string }).code = "GITHUB_OAUTH_CLIENT_ID_MISSING";
    throw error;
  }
  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: id, scope: "repo read:user user:email" })
  });
  const data = await response.json().catch(() => null) as null | {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    expires_in?: number;
    interval?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !data?.device_code) throw new Error(data?.error_description || data?.error || "failed to start GitHub device flow");
  return data;
}

export async function pollGitHubDeviceFlow(deviceCode: string) {
  const id = clientId();
  if (!id) {
    const error = new Error("GitHub OAuth client id is not configured. Set GITHUB_OAUTH_CLIENT_ID.");
    (error as Error & { code?: string }).code = "GITHUB_OAUTH_CLIENT_ID_MISSING";
    throw error;
  }
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: id, device_code: deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code" })
  });
  const data = await response.json().catch(() => null) as null | { access_token?: string; error?: string; error_description?: string };
  if (data?.error === "authorization_pending" || data?.error === "slow_down") return { pending: true, slowDown: data.error === "slow_down" };
  if (!response.ok || !data?.access_token) throw new Error(data?.error_description || data?.error || "GitHub device auth failed");
  const account = await getGitHubAccount(data.access_token);
  await writeState({ accessToken: data.access_token, account, updatedAt: new Date().toISOString() });
  return { pending: false, connected: true, account };
}
