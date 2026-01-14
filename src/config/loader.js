import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_CONFIG } from './defaults.js';

const CONFIG_NAMES = ['config.yaml', 'config.yml', '.issue-forge.yaml', '.issue-forge.yml'];

export async function findConfigFile(startDir = process.cwd()) {
  let currentDir = resolve(startDir);

  while (currentDir !== dirname(currentDir)) {
    for (const name of CONFIG_NAMES) {
      const configPath = resolve(currentDir, name);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    currentDir = dirname(currentDir);
  }

  return null;
}

function getLoggingConfig(userConfig) {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  const envFileEnabled = process.env.LOG_TO_FILE?.toLowerCase() === 'true';
  const envFilePath = process.env.LOG_DIR;

  return {
    level: envLevel || userConfig?.logging?.level || DEFAULT_CONFIG.logging.level,
    file_enabled: envFileEnabled || userConfig?.logging?.file_enabled || DEFAULT_CONFIG.logging.file_enabled,
    file_path: envFilePath || userConfig?.logging?.file_path || DEFAULT_CONFIG.logging.file_path,
    max_files: userConfig?.logging?.max_files || DEFAULT_CONFIG.logging.max_files,
  };
}

function getNotificationConfig(userConfig) {
  return {
    enabled: userConfig?.notifications?.enabled ?? DEFAULT_CONFIG.notifications.enabled,
    provider: userConfig?.notifications?.provider || DEFAULT_CONFIG.notifications.provider,
    webhookUrl: userConfig?.notifications?.webhookUrl,
    botToken: userConfig?.notifications?.botToken,
    chatId: userConfig?.notifications?.chatId,
    sendAllResponses: userConfig?.notifications?.sendAllResponses ?? DEFAULT_CONFIG.notifications.sendAllResponses,
  };
}

export async function loadConfig(configPath) {
  const filePath = configPath || await findConfigFile();

  if (!filePath) {
    throw new Error('No config file found. Run "issue-forge init" to create one.');
  }

  const content = await readFile(filePath, 'utf-8');
  const userConfig = parseYaml(content);

  const config = {
    global: {
      ...DEFAULT_CONFIG.global,
      ...userConfig.global,
    },
    logging: getLoggingConfig(userConfig),
    notifications: getNotificationConfig(userConfig),
    projects: userConfig.projects || [],
  };

  validateConfig(config);

  return { config, configPath: filePath };
}

function validateConfig(config) {
  if (!config.projects || config.projects.length === 0) {
    throw new Error('At least one project must be configured.');
  }

  for (const project of config.projects) {
    if (!project.path) {
      throw new Error('Each project must have a path.');
    }

    if (!existsSync(project.path)) {
      throw new Error(`Project path does not exist: ${project.path}`);
    }
  }

  const validProviders = ['claude', 'gemini'];
  if (!validProviders.includes(config.global.ai_provider)) {
    throw new Error(`Invalid ai_provider. Must be one of: ${validProviders.join(', ')}`);
  }

  if (config.notifications?.enabled) {
    const validNotificationProviders = ['slack', 'telegram', 'none'];
    if (!validNotificationProviders.includes(config.notifications.provider)) {
      throw new Error(`Invalid notification provider. Must be one of: ${validNotificationProviders.join(', ')}`);
    }

    if (config.notifications.provider === 'slack') {
      const hasEnvUrl = process.env.SLACK_WEBHOOK_URL;
      const hasConfigUrl = config.notifications.webhookUrl;

      if (!hasEnvUrl && !hasConfigUrl) {
        throw new Error(
          `Slack notifications enabled but no webhook URL found. ` +
          `Set SLACK_WEBHOOK_URL environment variable or add webhookUrl to notifications config.`
        );
      }
    }

    if (config.notifications.provider === 'telegram') {
      const hasBotToken = process.env.TELEGRAM_BOT_TOKEN || config.notifications.botToken;
      const hasChatId = process.env.TELEGRAM_CHAT_ID || config.notifications.chatId;

      if (!hasBotToken || !hasChatId) {
        throw new Error(
          `Telegram notifications enabled but missing configuration. ` +
          `Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables or add botToken and chatId to notifications config.`
        );
      }
    }
  }
}
