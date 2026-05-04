import style from "./console-style.json";
import { isAbsolute, join } from "node:path";

type DevConfig = {
  processes: Omit<ProcSpec, "color">[];
  links: string[];
};

const colors = {
  pink: "\x1b[95m",
  green: "\x1b[92m",
  blue: "\x1b[94m",
  cyan: "\x1b[96m",
  yellow: "\x1b[93m",
  gray: "\x1b[90m"
} as const;

const reset = "\x1b[0m";

type ColorName = keyof typeof colors;

type ProcSpec = {
  name: string;
  prefix: string;
  color: ColorName;
  cmd: string[];
  cwd: string;
  env?: Record<string, string>;
};

const root = process.cwd();
const configPath = process.argv[2] ?? "scripts/dev.config.json";
const config = (await Bun.file(isAbsolute(configPath) ? configPath : join(root, configPath)).json()) as DevConfig;
const prefixColor = colors[(style.prefixColor as ColorName) ?? "blue"] ?? colors.blue;
const palette = style.colors as ColorName[];
const specs = config.processes.map((spec) => ({
  ...spec,
  prefix: spec.prefix || spec.name,
  color: palette[config.processes.indexOf(spec) % palette.length] ?? "gray",
  cwd: join(root, spec.cwd)
})) satisfies ProcSpec[];

const children = new Map<string, ReturnType<typeof Bun.spawn>>();

function tag(prefix: string, color: ColorName) {
  const shortPrefix = prefix.slice(0, style.prefixLength).padEnd(style.prefixLength);
  return `${colors[color] ?? colors.gray}[${shortPrefix}]${reset}`;
}

function printBlue(message: string) {
  process.stdout.write(`${prefixColor}[dev]${reset} ${message}\n`);
}

function pipeOutput(proc: ReturnType<typeof Bun.spawn>, prefix: string, color: ColorName, stream: "stdout" | "stderr") {
  const source = stream === "stdout" ? proc.stdout : proc.stderr;
  if (!source) return;

  const reader = source.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  void (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) continue;
        process.stdout.write(`${tag(prefix, color)} ${line}\n`);
      }
    }

    const tail = (buffer + decoder.decode()).trim();
    if (tail) process.stdout.write(`${tag(prefix, color)} ${tail}\n`);
  })();
}

function stopAll(signal = "SIGTERM") {
  for (const child of children.values()) {
    try {
      child.kill(signal as Bun.Signal);
    } catch {
      // already exited
    }
  }
}

for (const spec of specs) {
  const env = {
    ...process.env,
    ...(spec.name === "server" ? { GLIB_LOG_REQUESTS: "1", GLIB_LOG_AGENT: "1" } : {}),
    ...(spec.env ?? {})
  };

  const proc = Bun.spawn({
    cmd: spec.cmd,
    cwd: spec.cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "inherit"
  });

  children.set(spec.name, proc);
  printBlue(`started ${spec.name}: ${spec.cmd.join(" ")}`);
  pipeOutput(proc, spec.prefix, spec.color, "stdout");
  pipeOutput(proc, spec.prefix, spec.color, "stderr");

  void proc.exited.then((code) => {
    printBlue(`${spec.name} exited (${code})`);
    if (code !== 0) {
      stopAll();
      process.exitCode = code;
    }
  });
}

for (const link of config.links) printBlue(link);

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    printBlue(`received ${sig}, shutting down...`);
    stopAll(sig);
  });
}

await Promise.all([...children.values()].map((p) => p.exited));
