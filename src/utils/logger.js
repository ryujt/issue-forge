import winston from 'winston';
import chalk from 'chalk';

const LEVEL_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'blue',
  debug: 'gray',
};

const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const color = LEVEL_COLORS[level] || 'white';
  const levelStr = chalk[color](level.toUpperCase().padEnd(5));
  const timeStr = chalk.gray(timestamp);
  const metaStr = Object.keys(meta).length ? chalk.gray(JSON.stringify(meta)) : '';

  return `${timeStr} ${levelStr} ${message} ${metaStr}`.trim();
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    customFormat
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

export function createAgentLogger(agentName) {
  return {
    info: (msg, meta) => logger.info(`[${agentName}] ${msg}`, meta),
    error: (msg, meta) => logger.error(`[${agentName}] ${msg}`, meta),
    warn: (msg, meta) => logger.warn(`[${agentName}] ${msg}`, meta),
    debug: (msg, meta) => logger.debug(`[${agentName}] ${msg}`, meta),
  };
}
