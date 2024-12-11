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
