import { AIAdapter, GenerateImageParams, GenerateJSONParams, GenerateTextParams } from './AIAdapter';
import { recordTelemetry } from '../utils/aiTelemetry';
import { withRetryAndTimeout, RetryOptions } from '../utils/aiRequestUtils';

export type DecoratorOptions = {
  provider: string;
  defaultModel?: string;
  retry?: RetryOptions;
};

export function withAdapterTelemetry(adapter: AIAdapter, options: DecoratorOptions): AIAdapter {
  const { provider, defaultModel, retry } = options;

  return {
    async generateJSON(params: GenerateJSONParams): Promise<string> {
      const model = params.task || defaultModel || '';
      const { result, error, attempts, durationMs } = await withRetryAndTimeout(
        () => adapter.generateJSON(params),
        retry
      );
      if (error) {
        recordTelemetry({ provider, method: 'generateJSON', model, success: false, latencyMs: durationMs, attempts, errorName: error?.name, errorMessage: String(error), timestamp: Date.now() });
        throw error;
      }
      recordTelemetry({ provider, method: 'generateJSON', model, success: true, latencyMs: durationMs, attempts, timestamp: Date.now() });
      return result as string;
    },

    async generateText(params: GenerateTextParams): Promise<string> {
      const model = params.task || defaultModel || '';
      const { result, error, attempts, durationMs } = await withRetryAndTimeout(
        () => adapter.generateText(params),
        retry
      );
      if (error) {
        recordTelemetry({ provider, method: 'generateText', model, success: false, latencyMs: durationMs, attempts, errorName: error?.name, errorMessage: String(error), timestamp: Date.now() });
        throw error;
      }
      recordTelemetry({ provider, method: 'generateText', model, success: true, latencyMs: durationMs, attempts, timestamp: Date.now() });
      return result as string;
    },

    async generateImage(params: GenerateImageParams): Promise<string> {
      const model = params.task || defaultModel || '';
      const { result, error, attempts, durationMs } = await withRetryAndTimeout(
        () => adapter.generateImage(params),
        retry
      );
      if (error) {
        recordTelemetry({ provider, method: 'generateImage', model, success: false, latencyMs: durationMs, attempts, errorName: error?.name, errorMessage: String(error), timestamp: Date.now() });
        throw error;
      }
      recordTelemetry({ provider, method: 'generateImage', model, success: true, latencyMs: durationMs, attempts, timestamp: Date.now() });
      return result as string;
    }
  };
}
