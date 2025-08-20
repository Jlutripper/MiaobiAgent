// 统一重试与超时工具，以及JSON提取自愈工具

export interface RetryOptions {
  attempts?: number; // 总次数（含首试）
  timeoutMs?: number; // 单次超时
  backoffBaseMs?: number; // 初始退避
  backoffFactor?: number; // 退避倍率
}

export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<{ result?: T; error?: any; attempts: number; durationMs: number }>
{
  const attempts = Math.max(1, opts.attempts ?? 2);
  const timeoutMs = Math.max(1, opts.timeoutMs ?? 30000);
  const backoffBaseMs = Math.max(0, opts.backoffBaseMs ?? 300);
  const backoffFactor = Math.max(1, opts.backoffFactor ?? 2);

  const startAll = (globalThis as any).performance?.now ? (globalThis as any).performance.now() : Date.now();
  let lastError: any;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await withTimeout(fn(), timeoutMs);
      const now = (globalThis as any).performance?.now ? (globalThis as any).performance.now() : Date.now();
      const durationMs = now - startAll;
      return { result: res, attempts: i + 1, durationMs };
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        const delay = backoffBaseMs * Math.pow(backoffFactor, i) + jitter(50);
        await sleep(delay);
        continue;
      }
    }
  }
  const now = (globalThis as any).performance?.now ? (globalThis as any).performance.now() : Date.now();
  const durationMs = now - startAll;
  return { error: lastError, attempts, durationMs };
}

function withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
    p.then((v) => { clearTimeout(timer); resolve(v); })
     .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(max = 100) {
  return Math.floor(Math.random() * max);
}

// 从文本中尽力提取第一个 JSON（对象或数组），用于自愈
export function extractFirstJson(text: string): any | undefined {
  if (!text) return undefined;
  const obj = extractBalanced(text, '{', '}');
  if (obj) return obj;
  const arr = extractBalanced(text, '[', ']');
  if (arr) return arr;
  return undefined;
}

function extractBalanced(text: string, open: string, close: string): any | undefined {
  const start = text.indexOf(open);
  if (start === -1) return undefined;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) { esc = false; }
      else if (ch === '\\') { esc = true; }
      else if (ch === '"') { inStr = false; }
    } else {
      if (ch === '"') inStr = true;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          const slice = text.slice(start, i + 1);
          try {
            return JSON.parse(slice);
          } catch {
            // 继续向后尝试
          }
        }
      }
    }
  }
  return undefined;
}
