import type { Sandbox, SandboxFactory, SandboxProcess, SpawnOpts } from "./sandbox";

type CloudflareSdk = {
  Sandbox?: new (...args: any[]) => any;
  createSandbox?: (...args: any[]) => Promise<any>;
};

async function loadCloudflareSdk(): Promise<CloudflareSdk> {
  const importer = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<CloudflareSdk>;
  return importer("@cloudflare/sandbox");
}

function emptyReadable() {
  return new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
}

export class CloudflareSandbox implements Sandbox {
  readonly id: string;
  readonly cwd: string;
  private readonly sandbox: any;

  constructor(opts: { id: string; cwd: string; sandbox: any }) {
    this.id = opts.id;
    this.cwd = opts.cwd;
    this.sandbox = opts.sandbox;
  }

  async spawn(opts: SpawnOpts): Promise<SandboxProcess> {
    const exec = this.sandbox.exec ?? this.sandbox.run;
    if (typeof exec !== "function") throw new Error("Cloudflare Sandbox SDK does not expose exec/run");
    const child = await exec.call(this.sandbox, opts.cmd, opts.args, { cwd: opts.cwd ?? this.cwd, env: opts.env, stdin: true, stdout: true, stderr: true });
    return {
      stdin: child.stdin ?? new WritableStream<Uint8Array>(),
      stdout: child.stdout ?? emptyReadable(),
      stderr: child.stderr ?? emptyReadable(),
      exitCode: child.exitCode ?? child.exited ?? Promise.resolve(0),
      kill: async (signal = "SIGTERM") => {
        if (typeof child.kill === "function") await child.kill(signal);
      }
    };
  }

  async writeFile(path: string, contents: Uint8Array) {
    const fs = this.sandbox.fs ?? this.sandbox.files;
    if (!fs?.writeFile) throw new Error("Cloudflare Sandbox SDK does not expose writeFile");
    await fs.writeFile(path, contents);
  }

  async readFile(path: string) {
    const fs = this.sandbox.fs ?? this.sandbox.files;
    if (!fs?.readFile) throw new Error("Cloudflare Sandbox SDK does not expose readFile");
    return fs.readFile(path) as Promise<Uint8Array>;
  }

  async destroy() {
    if (typeof this.sandbox.destroy === "function") await this.sandbox.destroy();
  }
}

export class CloudflareSandboxFactory implements SandboxFactory {
  async create(opts: { sessionId: string; cwd: string }) {
    const sdk = await loadCloudflareSdk();
    const create = sdk.createSandbox;
    const sandbox = create ? await create({ id: opts.sessionId }) : sdk.Sandbox ? new sdk.Sandbox({ id: opts.sessionId }) : null;
    if (!sandbox) throw new Error("Cloudflare Sandbox SDK did not provide a sandbox constructor");
    const cfSandbox = new CloudflareSandbox({ id: opts.sessionId, cwd: "/workspace", sandbox });
    await cfSandbox.spawn({ cmd: "npm", args: ["install", "-g", "@mariozechner/pi-coding-agent"], cwd: "/workspace" });
    void opts.cwd;
    return cfSandbox;
  }
}
