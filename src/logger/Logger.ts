import { DiagnosticLogEntry } from '../shared/types';

class DiagnosticLogger {
  private logs: DiagnosticLogEntry[] = [];
  private maxLogs = 500;
  private listeners: ((logs: DiagnosticLogEntry[]) => void)[] = [];

  constructor() {
    this.info('system', 'Super Audio Control diagnostic logger initialized.');
  }

  public log(
    level: DiagnosticLogEntry['level'],
    category: DiagnosticLogEntry['category'],
    message: string,
    details?: Record<string, unknown>
  ): void {
    const entry: DiagnosticLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    if (level === 'error') {
      console.error(`[${entry.category.toUpperCase()}] ${entry.message}`, details || '');
    } else if (level === 'warn') {
      console.warn(`[${entry.category.toUpperCase()}] ${entry.message}`, details || '');
    } else {
      console.log(`[${entry.category.toUpperCase()}] ${entry.message}`);
    }

    this.notify();

    // Persist diagnostics through the Electron main process. The main process
    // owns the log file because the renderer cannot safely write beside a
    // packaged executable. This is fire-and-forget so logging never blocks UI.
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.writeDiagnosticLog) {
        window.electronAPI.writeDiagnosticLog(entry);
      }
    } catch {
      // Diagnostics must never break the application.
    }
  }

  public info(category: DiagnosticLogEntry['category'], message: string, details?: Record<string, unknown>): void {
    this.log('info', category, message, details);
  }

  public warn(category: DiagnosticLogEntry['category'], message: string, details?: Record<string, unknown>): void {
    this.log('warn', category, message, details);
  }

  public error(category: DiagnosticLogEntry['category'], message: string, details?: Record<string, unknown>): void {
    this.log('error', category, message, details);
  }

  public debug(category: DiagnosticLogEntry['category'], message: string, details?: Record<string, unknown>): void {
    this.log('debug', category, message, details);
  }

  public getLogs(): DiagnosticLogEntry[] {
    return [...this.logs];
  }

  public clear(): void {
    this.logs = [];
    this.notify();
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.clearDiagnosticLog) {
        void window.electronAPI.clearDiagnosticLog();
      }
    } catch {
      // Diagnostics must never break the application.
    }
  }

  public subscribe(listener: (logs: DiagnosticLogEntry[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.logs]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    const copy = [...this.logs];
    this.listeners.forEach(l => l(copy));
  }
}

export const logger = new DiagnosticLogger();
