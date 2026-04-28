const pink = "\x1b[95m";
const green = "\x1b[92m";
const blue = "\x1b[94m";
const reset = "\x1b[0m";

type ProcSpec = {
  name: string;
  color: string;
  cmd: string[];
  cwd: string;
};

const root = process.cwd();

const specs: ProcSpec[] = [
  {
    name: "server",
    color: pink,
    cmd: ["bun", "run", "dev"],
    cwd: `${root}/server`
  },
  {
    name: "web",
    color: green,
    cmd: ["bun", "run", "dev"],
    cwd: `${root}/web`
  }
];

const children = new Map<string, ReturnType<typeof Bun.spawn>>();

function tag(name: string, color: string) {
  return `${color}[${name}]${reset}`;
}

function printBlue(message: string) {
  process.stdout.write(`${blue}[dev]${reset} ${message}\n`);
}

function pipeOutput(proc: ReturnType<typeof Bun.spawn>, name: string, color: string, stream: "stdout" | "stderr") {
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
        process.stdout.write(`${tag(name, color)} ${line}\n`);
      }
    }

    const tail = (buffer + decoder.decode()).trim();
    if (tail) process.stdout.write(`${tag(name, color)} ${tail}\n`);
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
  const proc = Bun.spawn({
    cmd: spec.cmd,
    cwd: spec.cwd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "inherit"
  });

  children.set(spec.name, proc);
  pipeOutput(proc, spec.name, spec.color, "stdout");
  pipeOutput(proc, spec.name, spec.color, "stderr");

  void proc.exited.then((code) => {
    printBlue(`${spec.name} exited (${code})`);
    if (code !== 0) {
      stopAll();
      process.exitCode = code;
    }
  });
}

printBlue("server: http://127.0.0.1:4273");
printBlue("web:    http://127.0.0.1:5173");

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    printBlue(`received ${sig}, shutting down...`);
    stopAll(sig);
  });
}

await Promise.all([...children.values()].map((p) => p.exited));
