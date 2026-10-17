import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Autosaver, DEFAULT_AUTOSAVE_DELAY_MS, type AutosaveStatus } from './autosave';

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const DELAY = DEFAULT_AUTOSAVE_DELAY_MS;

describe('Autosaver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces repeated changes into one write after the quiet period', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const autosaver = new Autosaver({ save, onError: vi.fn(), delayMs: DELAY });

    autosaver.schedule();
    autosaver.schedule();
    autosaver.schedule();
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosaver.status).toBe('idle');
    expect(autosaver.pending).toBe(false);
  });

  it('restarts the quiet period when a change arrives later', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const autosaver = new Autosaver({ save, onError: vi.fn(), delayMs: DELAY });

    autosaver.schedule();
    await vi.advanceTimersByTimeAsync(DELAY - 100);
    autosaver.schedule();
    await vi.advanceTimersByTimeAsync(100);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(DELAY - 100);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('writes again when a change lands while a write is in flight', async () => {
    const gate = deferred();
    let calls = 0;
    const save = vi.fn(() => {
      calls += 1;
      return calls === 1 ? gate.promise : Promise.resolve();
    });
    const autosaver = new Autosaver({ save, onError: vi.fn(), delayMs: DELAY });

    autosaver.schedule();
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(autosaver.status).toBe('saving');

    autosaver.schedule();
    expect(save).toHaveBeenCalledTimes(1);
    gate.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(autosaver.status).toBe('scheduled');

    await vi.advanceTimersByTimeAsync(DELAY);
    expect(save).toHaveBeenCalledTimes(2);
    expect(autosaver.status).toBe('idle');
  });

  it('reports write failures and retries on demand', async () => {
    const statuses: AutosaveStatus[] = [];
    const failure = new Error('quota');
    const save = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    const onError = vi.fn();
    const autosaver = new Autosaver({
      save,
      onError,
      delayMs: DELAY,
      onStatusChange: (status) => statuses.push(status),
    });

    autosaver.schedule();
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(autosaver.status).toBe('error');
    expect(statuses).toEqual(['scheduled', 'saving', 'error']);

    await autosaver.saveNow();
    expect(save).toHaveBeenCalledTimes(2);
    expect(autosaver.status).toBe('idle');
    expect(statuses).toEqual(['scheduled', 'saving', 'error', 'saving', 'idle']);
  });

  it('flushes a scheduled write without waiting for the quiet period', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const autosaver = new Autosaver({ save, onError: vi.fn(), delayMs: DELAY });

    autosaver.schedule();
    await autosaver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosaver.pending).toBe(false);

    await vi.advanceTimersByTimeAsync(DELAY * 3);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does nothing on flush when no write is pending', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const autosaver = new Autosaver({ save, onError: vi.fn(), delayMs: DELAY });

    await autosaver.flush();
    expect(save).not.toHaveBeenCalled();
    expect(autosaver.status).toBe('idle');
  });

  it('saves immediately with saveNow even when idle', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const autosaver = new Autosaver({ save, onError: vi.fn(), delayMs: DELAY });

    await autosaver.saveNow();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('drops a scheduled write on cancel', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const autosaver = new Autosaver({ save, onError: vi.fn(), delayMs: DELAY });

    autosaver.schedule();
    autosaver.cancel();
    expect(autosaver.status).toBe('idle');
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(save).not.toHaveBeenCalled();
  });

  it('ignores changes after dispose', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const autosaver = new Autosaver({ save, onError: vi.fn(), delayMs: DELAY });

    autosaver.dispose();
    autosaver.schedule();
    await autosaver.flush();
    await vi.advanceTimersByTimeAsync(DELAY * 2);
    expect(save).not.toHaveBeenCalled();
  });
});
