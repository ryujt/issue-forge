#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, findConfigFile } from './config/loader.js';
import { Orchestrator } from './core/orchestrator.js';
import { logger, configureLogging } from './utils/logger.js';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const program = new Command();

program
  .name('issue-forge')
  .description('Automated GitHub issue processing with multi-agent AI collaboration')
  .version('1.0.0');

program
  .command('start')
  .description('Start the Issue Forge daemon')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      const { config, configPath } = await loadConfig(options.config);
      spinner.succeed(`Loaded config from ${configPath}`);

      configureLogging(config.logging);

      const orchestrator = new Orchestrator(config);

      let forceExit = false;
      process.on('SIGINT', () => {
        if (forceExit) {
          console.log('\nForce exit');
          process.exit(1);
        }
        console.log('\nStopping... (Ctrl+C again to force exit)');
        forceExit = true;
        orchestrator.stop();
        setTimeout(() => process.exit(0), 3000);
      });

      process.on('SIGTERM', () => {
        orchestrator.stop();
        setTimeout(() => process.exit(0), 3000);
      });

      await orchestrator.start();
    } catch (error) {
      spinner.fail(error.message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new Issue Forge configuration')
  .action(async () => {
    const configPath = 'config.yaml';

    if (existsSync(configPath)) {
      console.log(chalk.yellow('Config file already exists: config.yaml'));
      return;
    }

    const defaultConfig = `# Issue Forge Configuration

global:
  polling_interval: 600  # Seconds to wait when no issues
  ai_provider: claude    # claude or gemini
  model: opus            # opus (4.5), sonnet (4), or haiku (3.5)

projects:
  - path: "${process.cwd()}"
`;

    await writeFile(configPath, defaultConfig, 'utf-8');
    console.log(chalk.green('Created config.yaml'));
    console.log(chalk.gray('Edit the file to configure your projects.'));
  });

program
  .command('status')
  .description('Show current status')
  .action(async () => {
    try {
      const configPath = await findConfigFile();
      if (configPath) {
        console.log(chalk.green(`Config found: ${configPath}`));
      } else {
        console.log(chalk.yellow('No config file found. Run "issue-forge init" to create one.'));
      }
    } catch (error) {
      console.log(chalk.red(error.message));
    }
  });

program
  .command('run')
  .description('Process a single issue and exit')
  .option('-c, --config <path>', 'Path to config file')
  .option('-i, --issue <number>', 'Specific issue number to process')
  .option('-p, --project <path>', 'Specific project path')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      const { config } = await loadConfig(options.config);
      spinner.succeed('Configuration loaded');

      configureLogging(config.logging);

      const { IssueProcessor } = await import('./core/issue-processor.js');
      const { createProvider } = await import('./providers/index.js');
      const { NotificationService } = await import('./services/notification-service.js');
      const { GitHubClient } = await import('./github/client.js');

      const projectPath = options.project || config.projects[0].path;
      const provider = createProvider(config.global.ai_provider, {
        model: config.global.model,
      });
      const notificationService = new NotificationService(config.notifications);
      const processor = new IssueProcessor(provider, {
        maxIterations: config.global.max_iterations || 3,
        notificationService,
      });

      const github = new GitHubClient(projectPath);
      await github.initialize();

      let issue;
      if (options.issue) {
        issue = await github.getIssue(parseInt(options.issue, 10));
      } else {
        const issues = await github.fetchOpenIssues();
        if (issues.length === 0) {
          console.log(chalk.yellow('No open issues found.'));
          return;
        }
        issue = issues[0];
      }

      console.log(chalk.blue(`Processing issue #${issue.number}: ${issue.title}`));

      const result = await processor.process(projectPath, issue);

      if (result.status === 'success') {
        console.log(chalk.green(`✓ Created PR #${result.pr}: ${result.url}`));
      } else {
        console.log(chalk.yellow(`⚠ Issue escalated for human review`));
      }
    } catch (error) {
      spinner.fail(error.message);
      logger.error(error.stack);
      process.exit(1);
    }
  });

program
  .command('scan')
  .description('Scan projects for open issues')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    try {
      const { config } = await loadConfig(options.config);
      const { GitHubClient } = await import('./github/client.js');

      for (const project of config.projects) {
        console.log(chalk.blue(`\n${project.path}`));

        try {
          const github = new GitHubClient(project.path);
          await github.initialize();

          const issues = await github.fetchOpenIssues();

          if (issues.length === 0) {
            console.log(chalk.gray('  No open issues'));
          } else {
            for (const issue of issues) {
              const labels = issue.labels.map(l => l.name).join(', ');
              console.log(`  #${issue.number} ${issue.title} ${labels ? chalk.gray(`[${labels}]`) : ''}`);
            }
          }
        } catch (error) {
          console.log(chalk.red(`  Error: ${error.message}`));
        }
      }
    } catch (error) {
      console.log(chalk.red(error.message));
      process.exit(1);
    }
  });

program.parse();
