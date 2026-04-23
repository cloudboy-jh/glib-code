export type StepStart = {
  type: "step_start";
  timestamp: number;
  sessionID: string;
  part: {
    id: string;
    sessionID: string;
    messageID: string;
    type: "step-start";
    snapshot: string;
  };
};

export type ToolUse = {
  type: "tool_use";
  timestamp: number;
  sessionID: string;
  part: {
    id: string;
    sessionID: string;
    messageID: string;
    type: "tool";
    callID: string;
    tool: string;
    state: {
      status: "completed";
      input: object;
      output: string;
      title: string;
      metadata: object;
      time: { start: number; end: number };
    };
  };
};

export type Text = {
  type: "text";
  timestamp: number;
  sessionID: string;
  part: {
    id: string;
    sessionID: string;
    messageID: string;
    type: "text";
    text: string;
    time: { start: number; end: number };
  };
};

export type StepFinish = {
  type: "step_finish";
  timestamp: number;
  sessionID: string;
  part: {
    id: string;
    sessionID: string;
    messageID: string;
    type: "step-finish";
    reason?: "stop" | "tool-calls";
    snapshot: string;
    cost: number;
    tokens: {
      input: number;
      output: number;
      reasoning: number;
      cache: { read: number; write: number };
    };
  };
};

export type ErrorEvent = {
  type: "error";
  timestamp: number;
  sessionID: string;
  error: {
    name: string;
    data?: {
      message?: string;
      statusCode?: number;
      isRetryable?: boolean;
    };
  };
};

export type OpencodeEvent = StepStart | ToolUse | Text | StepFinish | ErrorEvent;
