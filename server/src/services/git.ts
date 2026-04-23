import { simpleGit } from "simple-git";
import { getCurrentProjectId, getProjectById } from "./state";

function activeRepo() {
  const current = getCurrentProjectId();
  if (!current) return null;
  const project = getProjectById(current);
  if (!project) return null;
  return project.path;
}

function getGit() {
  const repo = activeRepo();
  if (!repo) return null;
  return simpleGit(repo);
}

export async function gitStatus() {
  const git = getGit();
  if (!git) return null;
  const s = await git.status();
  return {
    current: s.current,
    ahead: s.ahead,
    behind: s.behind,
    staged: s.staged,
    modified: s.modified,
    deleted: s.deleted,
    not_added: s.not_added,
    conflicted: s.conflicted
  };
}

export async function gitBranches() {
  const git = getGit();
  if (!git) return null;
  const b = await git.branchLocal();
  return {
    current: b.current,
    all: b.all
  };
}

export async function gitLog(limit = 50) {
  const git = getGit();
  if (!git) return null;
  const logs = await git.log({ maxCount: limit });
  return logs.all.map((item) => ({
    hash: item.hash,
    date: item.date,
    message: item.message,
    author_name: item.author_name,
    author_email: item.author_email
  }));
}
