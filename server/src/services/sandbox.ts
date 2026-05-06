import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable, Writable } from "node:stream";

export interface SpawnOpts {
  cmd: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface SandboxProcess {
  stdin: WritableStream<Uint8Array>;
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  exitCode: Promise<number>;
  kill(signal?: "SIGTERM" | "SIGKILL"): Promise<void>;
}

export interface Sandbox {
  id: string;
  cwd: string;
  spawn(opts: SpawnOpts): Promise<SandboxProcess>;
  writeFile(path: string, contents: Uint8Array): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  destroy(): Promise<void>;
}

export interface SandboxFactory {
  create(opts: { sessionId: string; cwd: string }): Promise<Sandbox>;
}

function asReadableWeb(stream: NodeJS.ReadableStream | null): ReadableStream<Uint8Array> {
  if (!stream) return new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
  return Readable.toWeb(stream as Readable) as unknown as ReadableStream<Uint8Array>;
}

function asWritableWeb(stream: NodeJS.WritableStream | null): WritableStream<Uint8Array> {
  if (!stream) return new WritableStream<Uint8Array>();
  return Writable.toWeb(stream as Writable) as WritableStream<Uint8Array>;
}

export class LocalSandbox implements Sandbox {
  readonly id: string;
  readonly cwd: string;

  constructor(opts: { id: string; cwd: string }) {
    this.id = opts.id;
    this.cwd = resolve(opts.cwd);
  }

  async spawn(opts: SpawnOpts): Promise<SandboxProcess> {
    const child = spawn(opts.cmd, opts.args, {
      cwd: resolve(opts.cwd ?? this.cwd),
      env: { ...process.env, ...opts.env },
      stdio: ["pipe", "pipe", "pipe"]
    });

    const exitCode = new Promise<number>((resolveExit) => {
      child.once("exit", (code, signal) => {
        resolveExit(typeof code === "number" ? code : signal ? 128 : 1);
      });
      child.once("error", () => resolveExit(1));
    });

    return {
      stdin: asWritableWeb(child.stdin),
      stdout: asReadableWeb(child.stdout),
      stderr: asReadableWeb(child.stderr),
      exitCode,
      kill: async (signal = "SIGTERM") => {
        if (!child.killed) child.kill(signal);
        await Promise.race([exitCode, new Promise((resolve) => setTimeout(resolve, 1000))]);
      }
    };
  }

  async writeFile(path: string, contents: Uint8Array) {
    const filePath = resolve(this.cwd, path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }

  async readFile(path: string) {
    const data = await readFile(resolve(this.cwd, path));
    return Uint8Array.from(data);
  }

  async destroy() {
    if (process.env.GLIB_LOCAL_SANDBOX_DESTROY === "rm") {
      await rm(this.cwd, { recursive: true, force: true });
    }
  }
}

export class LocalSandboxFactory implements SandboxFactory {
  async create(opts: { sessionId: string; cwd: string }) {
    return new LocalSandbox({ id: opts.sessionId, cwd: opts.cwd });
  }
}

export function createSandboxFactory(): SandboxFactory {
  if (process.env.GLIB_SANDBOX === "cloudflare") {
    return {
      async create(opts) {
        const mod = await import("./sandbox-cloudflare");
        return new mod.CloudflareSandboxFactory().create(opts);
      }
    };
  }
  return new LocalSandboxFactory();
}
