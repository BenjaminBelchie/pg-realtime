import pino from "pino";

interface LoggerConfig {
  level: pino.Level;
  transport?:
    | pino.TransportSingleOptions
    | pino.TransportMultiOptions
    | pino.TransportPipelineOptions;
  formatters?: pino.LoggerOptions["formatters"];
  timestamp?: pino.LoggerOptions["timestamp"];
  base?: pino.LoggerOptions["base"];
}

// Environment-specific configurations
const loggerConfigs: Record<string, LoggerConfig> = {
  development: {
    level: "debug",
    transport: {
      target: "pino-pretty",
      options: {
        destination: 1,
        colorize: true,
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
        messageFormat: "\x1b[36m[{level}]\x1b[0m {msg}",
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: "retrospect-server",
    },
  },

  test: {
    level: "warn",
    transport: {
      target: "pino-pretty",
      options: {
        destination: 1,
        colorize: false,
        translateTime: false,
      },
    },
    timestamp: false,
    base: {},
  },

  production: {
    level: "info",
    formatters: {
      level: (label: string) => ({ level: label.toUpperCase() }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: "retrospect-server",
      environment: "production",
      version: process.env.npm_package_version ?? "unknown",
    },
  },

  staging: {
    level: "debug",
    formatters: {
      level: (label: string) => ({ level: label.toUpperCase() }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: "retrospect-server",
      environment: "staging",
      version: process.env.npm_package_version ?? "unknown",
    },
  },
};

function createLogger(): pino.Logger {
  const env = process.env.NODE_ENV ?? "development";
  const config = loggerConfigs[env];

  // Fallback to development config if environment not found
  if (!config) {
    console.warn(
      `Unknown environment: ${env}, falling back to development logger`
    );
    return createLoggerFromConfig(loggerConfigs.development!);
  }

  return createLoggerFromConfig(config);
}

function createLoggerFromConfig(config: LoggerConfig): pino.Logger {
  const pinoOptions: pino.LoggerOptions = {
    level: config.level,
    timestamp: config.timestamp,
    base: config.base,
    formatters: config.formatters,
  };

  if (config.transport) {
    const transport = pino.transport(
      config.transport
    ) as pino.DestinationStream;
    return pino(pinoOptions, transport);
  }

  return pino(pinoOptions);
}

// Create and export the logger instance
export const logger = createLogger();

// Export a function to create child loggers with additional context
export function createChildLogger(
  context: Record<string, unknown>
): pino.Logger {
  return logger.child(context);
}
