import winston from 'winston';
import chalk from 'chalk';
import { mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';

const LEVEL_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'blue',
  debug: 'gray',
};

const consoleFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const color = LEVEL_COLORS[level] || 'white';
  const levelStr = chalk[color](level.toUpperCase().padEnd(5));
  const timeStr = chalk.gray(timestamp);
  const metaStr = Object.keys(meta).length ? chalk.gray(JSON.stringify(meta)) : '';

  return `${timeStr} ${levelStr} ${message} ${metaStr}`.trim();
});

const fileFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const levelStr = level.toUpperCase().padEnd(5);
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';

  return `${timestamp} ${levelStr} ${message} ${metaStr}`.trim();
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL?.toLowerCase() || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    consoleFormat
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

function getLogFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `issue-forge-${year}${month}${day}.log`;
}

function cleanOldLogs(logDir, maxFiles) {
  try {
    const files = readdirSync(logDir)
      .filter(f => f.startsWith('issue-forge-') && f.endsWith('.log'))
      .sort()
      .reverse();

    if (files.length > maxFiles) {
      const toDelete = files.slice(maxFiles);
      for (const file of toDelete) {
        unlinkSync(join(logDir, file));
        logger.debug(`Deleted old log file: ${file}`);
      }
    }
  } catch (error) {
    logger.debug(`Failed to clean old logs: ${error.message}`);
  }
}

export function configureLogging(loggingConfig) {
  if (!loggingConfig) return;

  logger.level = loggingConfig.level || 'info';

  if (loggingConfig.file_enabled) {
    const logDir = resolve(process.cwd(), loggingConfig.file_path || './logs');

    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    const logFile = join(logDir, getLogFileName());

    const fileTransport = new winston.transports.File({
      filename: logFile,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        fileFormat
      ),
      level: 'debug',
    });

    logger.add(fileTransport);
    logger.info(`File logging enabled: ${logFile}`);

    cleanOldLogs(logDir, loggingConfig.max_files || 7);
  }
}

export function createAgentLogger(agentName) {
  return {
    info: (msg, meta) => logger.info(`[${agentName}] ${msg}`, meta),
    error: (msg, meta) => logger.error(`[${agentName}] ${msg}`, meta),
    warn: (msg, meta) => logger.warn(`[${agentName}] ${msg}`, meta),
    debug: (msg, meta) => logger.debug(`[${agentName}] ${msg}`, meta),
  };
}
