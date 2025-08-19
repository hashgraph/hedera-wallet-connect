export interface ILogger {
  error(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  info(message: string, ...args: any[]): void
  debug(message: string, ...args: any[]): void
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'off'

export class DefaultLogger implements ILogger {
  private logLevel: LogLevel = 'info'
  public name: string
  constructor(logLevel: LogLevel = 'info', name?: string) {
    this.logLevel = logLevel
    this.name = name || 'Logger'
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }

  getLogLevel(): LogLevel {
    return this.logLevel
  }

  error(message: string, ...args: any[]): void {
    if (['error', 'warn', 'info', 'debug'].includes(this.logLevel)) {
      console.error(`[ERROR - ${this.name}] ${message}`, ...args)
    }
  }

  warn(message: string, ...args: any[]): void {
    if (['warn', 'info', 'debug'].includes(this.logLevel)) {
      console.warn(`[WARN - ${this.name}] ${message}`, ...args)
    }
  }

  info(message: string, ...args: any[]): void {
    if (['info', 'debug'].includes(this.logLevel)) {
      console.info(`[INFO - ${this.name}] ${message}`, ...args)
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.logLevel === 'debug') {
      console.debug(`[DEBUG - ${this.name}] ${message}`, ...args)
    }
  }
}

// Global logger configuration
let globalLogLevel: LogLevel = 'info'

// Check if environment variable is set
if (typeof process !== 'undefined' && process.env?.HWC_LOG_LEVEL) {
  const envLevel = process.env.HWC_LOG_LEVEL.toLowerCase() as LogLevel
  if (['error', 'warn', 'info', 'debug', 'off'].includes(envLevel)) {
    globalLogLevel = envLevel
  }
}

// Check if localStorage is available (browser environment)
if (typeof localStorage !== 'undefined') {
  const storedLevel = localStorage.getItem('hwc_log_level')
  if (storedLevel && ['error', 'warn', 'info', 'debug', 'off'].includes(storedLevel)) {
    globalLogLevel = storedLevel as LogLevel
  }
}

export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = level
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('hwc_log_level', level)
  }
}

export function getGlobalLogLevel(): LogLevel {
  return globalLogLevel
}

// Factory function to create logger instances
export function createLogger(name: string, level?: LogLevel): DefaultLogger {
  return new DefaultLogger(level || globalLogLevel, name)
}
