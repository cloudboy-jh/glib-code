export type TokenUsage = {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
};

export type SessionCosts = {
  totalCost: number;
  totalTokens: TokenUsage;
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

export type ToolResultType = "diff" | "terminal" | "json" | "code" | "text" | "tree" | "error";

export type ToolResultArtifact = {
  patch?: string;
  text?: string;
  json?: unknown;
  language?: string;
  tree?: { paths: string[]; gitStatus?: Record<string, string> };
};

export type BoundaryState = "clean" | "pending" | "no_workspace" | "promoting" | "promoted";

// Canonical boundary payload — shared by the SSE `boundary_changed` push and the
// HTTP `/boundary` hydration response so both surfaces stay in lockstep.
export type BoundaryPayload = {
  state: BoundaryState;
  touchedFiles: string[];
  touchedFileCount: number;
  additions: number;
  deletions: number;
  baselineSha: string | null;
  lastPromotedAt: string | null;
  promoteHistory: Array<{ at: string; fromSha: string | null; toSha: string | null; fileCount: number }>;
  alreadyPromoted?: boolean;
};

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
      resultType?: ToolResultType;
      summary?: string;
      artifact?: ToolResultArtifact;
      durationMs: number;
      at: string;
    }
  | { type: "step_end"; turnId: string; stepId: string; reason?: "stop" | "tool-calls"; cost: number; tokens: TokenUsage; at: string }
  | ({ type: "boundary_changed"; sessionId: string; at: string } & BoundaryPayload)
  | {
      type: "error";
      turnId: string;
      name: string;
      message?: string;
      retryable?: boolean;
      code?: string;
      source?: "provider" | "runtime" | "sandbox" | "tool";
      provider?: string;
      model?: string;
      at: string;
    };
