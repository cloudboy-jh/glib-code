export type TokenUsage = {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
};

export type ToolName =
  | "bash"
  | "read"
  | "write"
  | "edit"
  | "grep"
  | "glob"
  | "webfetch"
  | "websearch"
  | "task"
  | string;

export type AgentEvent =
  | { type: "session_start"; sessionId: string; projectId: string; branch: string; model: string; createdAt: string }
  | { type: "user_turn"; turnId: string; prompt: string; context?: string; attachments?: string[]; at: string }
  | { type: "turn_start"; turnId: string; at: string }
  | { type: "turn_end"; turnId: string; reason: "stop" | "aborted" | "error"; at: string; cost?: number; tokens?: TokenUsage }
  | { type: "aborted"; turnId: string; at: string }
  | { type: "step_start"; turnId: string; stepId: string; snapshot: string; at: string }
  | { type: "text_part"; turnId: string; stepId: string; partId: string; text: string; at: string }
  | {
      type: "tool_call";
      turnId: string;
      stepId: string;
      callId: string;
      tool: ToolName;
      title: string;
      input: object;
      output: string;
      metadata: object;
      durationMs: number;
      at: string;
    }
  | { type: "step_end"; turnId: string; stepId: string; reason?: "stop" | "tool-calls"; cost: number; tokens: TokenUsage; at: string }
  | { type: "error"; turnId: string; name: string; message?: string; retryable?: boolean; at: string };
