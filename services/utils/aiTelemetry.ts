// 轻量遥测：记录延迟、结果/错误、token（如可获得）

export type TelemetryEvent = {
  provider: string;
  method: 'generateJSON' | 'generateText' | 'generateImage';
  model: string;
  success: boolean;
  latencyMs: number;
  attempts: number;
  errorName?: string;
  errorMessage?: string;
  tokensPrompt?: number;
  tokensCompletion?: number;
  timestamp: number;
};

const buffer: TelemetryEvent[] = [];

export function recordTelemetry(evt: TelemetryEvent) {
  buffer.push(evt);
  // 控制台输出便于开发观察；后续可接入后端或IndexedDB
  // eslint-disable-next-line no-console
  console.debug('[AI-Telemetry]', evt);
}

export function getTelemetryBuffer() {
  return buffer;
}
