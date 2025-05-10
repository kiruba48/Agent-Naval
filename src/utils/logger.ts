/**
 * Simple logger utility with different log levels and structured logging support
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMetadata {
    [key: string]: any;
}

class Logger {
    private static instance: Logger;

    private constructor() {}

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private formatMessage(level: LogLevel, message: string, metadata?: LogMetadata): string {
        const timestamp = new Date().toISOString();
        const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${metadataStr}`;
    }

    public debug(message: string, metadata?: LogMetadata): void {
        console.debug(this.formatMessage('debug', message, metadata));
    }

    public info(message: string, metadata?: LogMetadata): void {
        console.info(this.formatMessage('info', message, metadata));
    }

    public warn(message: string, metadata?: LogMetadata): void {
        console.warn(this.formatMessage('warn', message, metadata));
    }

    public error(message: string, metadata?: LogMetadata): void {
        console.error(this.formatMessage('error', message, metadata));
    }
}

// Export singleton instance
export const logger = Logger.getInstance();
