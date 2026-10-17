export type AutosaveStatus = 'idle' | 'scheduled' | 'saving' | 'error';

/** Injectable timer so autosave scheduling can be tested without real delays. */
export interface AutosaveTimer {
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
}

export const systemTimer: AutosaveTimer = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export const DEFAULT_AUTOSAVE_DELAY_MS = 1200;

export interface AutosaverOptions {
  /** Persists whatever the caller considers current. Errors are forwarded to `onError`. */
  save: () => Promise<void>;
  onError: (error: unknown) => void;
  onStatusChange?: (status: AutosaveStatus) => void;
  /** Quiet period between the last change and the write. */
  delayMs?: number;
  timer?: AutosaveTimer;
}

/**
 * Debounced writer used for autosave. Repeated `schedule()` calls collapse into a single
 * write; a change that lands while a write is in flight re-arms the timer so the stored
 * snapshot is never older than the last edit. `flush()`/`saveNow()` cover the explicit paths
 * (leaving the editor, "Save now" after a failure).
 */
export class Autosaver {
  private readonly save: () => Promise<void>;
  private readonly onError: (error: unknown) => void;
  private readonly onStatusChange: ((status: AutosaveStatus) => void) | undefined;
  private readonly delayMs: number;
  private readonly timer: AutosaveTimer;

  private handle: unknown = null;
  private isRunning = false;
  private running: Promise<void> | null = null;
  private rescheduledWhileSaving = false;
  private currentStatus: AutosaveStatus = 'idle';
  private disposed = false;

  constructor(options: AutosaverOptions) {
    this.save = options.save;
    this.onError = options.onError;
    this.onStatusChange = options.onStatusChange;
    this.delayMs = options.delayMs ?? DEFAULT_AUTOSAVE_DELAY_MS;
    this.timer = options.timer ?? systemTimer;
  }

  get status(): AutosaveStatus {
    return this.currentStatus;
  }

  /** True while a write is waiting for the quiet period or in flight. */
  get pending(): boolean {
    return this.handle !== null || this.isRunning;
  }

  /** Requests a write after the quiet period. Coalesces with earlier requests. */
  schedule(): void {
    if (this.disposed) return;
    if (this.isRunning) {
      this.rescheduledWhileSaving = true;
      return;
    }
    this.setStatus('scheduled');
    this.arm();
  }

  /** Writes immediately, ignoring the quiet period (explicit save / retry after an error). */
  async saveNow(): Promise<void> {
    if (this.disposed) return;
    this.clearTimer();
    this.rescheduledWhileSaving = false;
    await this.run();
    while (this.running) await this.running;
  }

  /** Runs a scheduled write now and waits for in-flight writes; no-op when nothing is pending. */
  async flush(): Promise<void> {
    if (this.disposed) return;
    if (this.handle !== null) {
      this.clearTimer();
      this.rescheduledWhileSaving = false;
      await this.run();
    }
    while (this.running) await this.running;
  }

  /** Drops a scheduled write without saving (the caller persisted the state another way). */
  cancel(): void {
    this.clearTimer();
    this.rescheduledWhileSaving = false;
    if (this.currentStatus === 'scheduled' || this.currentStatus === 'error') {
      this.setStatus('idle');
    }
  }

  /** Cancels pending work and ignores everything afterwards. In-flight writes still finish. */
  dispose(): void {
    this.disposed = true;
    this.clearTimer();
  }

  private arm(): void {
    this.clearTimer();
    this.handle = this.timer.set(() => {
      this.handle = null;
      void this.run();
    }, this.delayMs);
  }

  private clearTimer(): void {
    if (this.handle !== null) {
      this.timer.clear(this.handle);
      this.handle = null;
    }
  }

  private async run(): Promise<void> {
    // The flag is set before `execute()` starts so a `schedule()` triggered from the save
    // function itself is still recognized as "while saving".
    if (this.isRunning || this.disposed) return;
    this.isRunning = true;
    const attempt = this.execute();
    this.running = attempt;
    try {
      await attempt;
    } finally {
      this.isRunning = false;
      this.running = null;
    }
  }

  private async execute(): Promise<void> {
    this.setStatus('saving');
    try {
      await this.save();
    } catch (error) {
      this.rescheduledWhileSaving = false;
      this.setStatus('error');
      this.onError(error);
      return;
    }
    if (this.disposed) return;
    if (this.rescheduledWhileSaving) {
      this.rescheduledWhileSaving = false;
      this.setStatus('scheduled');
      this.arm();
      return;
    }
    this.setStatus('idle');
  }

  private setStatus(status: AutosaveStatus): void {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    this.onStatusChange?.(status);
  }
}
