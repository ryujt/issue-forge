import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { loadConfig } from '../src/config/loader.js';
import { tmpdir } from 'node:os';

const TEST_DIR = resolve(tmpdir(), 'issue-forge-test-' + Date.now());

function createDir(path) {
  mkdirSync(path, { recursive: true });
}

function createGitRepo(path) {
  createDir(path);
  createDir(join(path, '.git'));
}

describe('folders configuration', () => {
  beforeEach(() => {
    createDir(TEST_DIR);
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should discover git repos from folders', async () => {
    const parentDir = join(TEST_DIR, 'projects');
    createGitRepo(join(parentDir, 'repo-a'));
    createGitRepo(join(parentDir, 'repo-b'));
    createDir(join(parentDir, 'not-a-repo'));

    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, `
global:
  ai_provider: claude
  model: opus

folders:
  - path: "${parentDir}"
`);

    const { config } = await loadConfig(configPath);

    assert.equal(config.projects.length, 2);

    const paths = config.projects.map(p => p.path);
    assert.ok(paths.includes(join(parentDir, 'repo-a')));
    assert.ok(paths.includes(join(parentDir, 'repo-b')));
    assert.ok(!paths.includes(join(parentDir, 'not-a-repo')));
  });

  it('should apply base_branch from folder config', async () => {
    const parentDir = join(TEST_DIR, 'projects');
    createGitRepo(join(parentDir, 'repo-a'));

    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, `
global:
  ai_provider: claude
  model: opus

folders:
  - path: "${parentDir}"
    base_branch: develop
`);

    const { config } = await loadConfig(configPath);

    assert.equal(config.projects.length, 1);
    assert.equal(config.projects[0].base_branch, 'develop');
  });

  it('should use default base_branch when folder does not specify one', async () => {
    const parentDir = join(TEST_DIR, 'projects');
    createGitRepo(join(parentDir, 'repo-a'));

    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, `
global:
  ai_provider: claude
  model: opus

folders:
  - path: "${parentDir}"
`);

    const { config } = await loadConfig(configPath);

    assert.equal(config.projects[0].base_branch, 'main');
  });

  it('should not duplicate projects listed in both folders and projects', async () => {
    const parentDir = join(TEST_DIR, 'projects');
    createGitRepo(join(parentDir, 'repo-a'));
    createGitRepo(join(parentDir, 'repo-b'));

    const repoAPath = join(parentDir, 'repo-a');
    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, `
global:
  ai_provider: claude
  model: opus

folders:
  - path: "${parentDir}"

projects:
  - path: "${repoAPath}"
    base_branch: proto
`);

    const { config } = await loadConfig(configPath);

    assert.equal(config.projects.length, 2);

    const repoA = config.projects.find(p => p.path === repoAPath);
    assert.equal(repoA.base_branch, 'proto');
  });

  it('should merge folders and explicit projects', async () => {
    const folderDir = join(TEST_DIR, 'folder-repos');
    createGitRepo(join(folderDir, 'auto-repo'));

    const explicitDir = join(TEST_DIR, 'explicit-repo');
    createGitRepo(explicitDir);

    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, `
global:
  ai_provider: claude
  model: opus

folders:
  - path: "${folderDir}"

projects:
  - path: "${explicitDir}"
`);

    const { config } = await loadConfig(configPath);

    assert.equal(config.projects.length, 2);

    const paths = config.projects.map(p => p.path);
    assert.ok(paths.includes(join(folderDir, 'auto-repo')));
    assert.ok(paths.includes(explicitDir));
  });

  it('should skip non-existent folder paths', async () => {
    const existingDir = join(TEST_DIR, 'existing');
    createGitRepo(join(existingDir, 'repo-a'));

    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, `
global:
  ai_provider: claude
  model: opus

folders:
  - path: "${join(TEST_DIR, 'non-existent')}"
  - path: "${existingDir}"
`);

    const { config } = await loadConfig(configPath);

    assert.equal(config.projects.length, 1);
    assert.equal(config.projects[0].path, join(existingDir, 'repo-a'));
  });

  it('should support multiple folders with different base_branch', async () => {
    const libDir = join(TEST_DIR, 'lib');
    createGitRepo(join(libDir, 'lib-a'));

    const personalDir = join(TEST_DIR, 'personal');
    createGitRepo(join(personalDir, 'app-a'));

    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, `
global:
  ai_provider: claude
  model: opus

folders:
  - path: "${libDir}"
    base_branch: main
  - path: "${personalDir}"
    base_branch: develop
`);

    const { config } = await loadConfig(configPath);

    assert.equal(config.projects.length, 2);

    const libA = config.projects.find(p => p.path === join(libDir, 'lib-a'));
    const appA = config.projects.find(p => p.path === join(personalDir, 'app-a'));

    assert.equal(libA.base_branch, 'main');
    assert.equal(appA.base_branch, 'develop');
  });

  it('should work with only folders (no explicit projects)', async () => {
    const parentDir = join(TEST_DIR, 'repos');
    createGitRepo(join(parentDir, 'repo-x'));

    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, `
global:
  ai_provider: claude
  model: opus

folders:
  - path: "${parentDir}"
`);

    const { config } = await loadConfig(configPath);

    assert.equal(config.projects.length, 1);
    assert.equal(config.projects[0].path, join(parentDir, 'repo-x'));
  });

  it('should ignore files in folder (only subdirectories)', async () => {
    const parentDir = join(TEST_DIR, 'mixed');
    createGitRepo(join(parentDir, 'real-repo'));
    writeFileSync(join(parentDir, 'some-file.txt'), 'not a directory');

    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, `
global:
  ai_provider: claude
  model: opus

folders:
  - path: "${parentDir}"
`);

    const { config } = await loadConfig(configPath);

    assert.equal(config.projects.length, 1);
    assert.equal(config.projects[0].path, join(parentDir, 'real-repo'));
  });

  it('explicit projects override folder-discovered projects', async () => {
    const parentDir = join(TEST_DIR, 'projects');
    createGitRepo(join(parentDir, 'my-repo'));

    const repoPath = join(parentDir, 'my-repo');
    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, `
global:
  ai_provider: claude
  model: opus

folders:
  - path: "${parentDir}"
    base_branch: develop

projects:
  - path: "${repoPath}"
    base_branch: proto
`);

    const { config } = await loadConfig(configPath);

    assert.equal(config.projects.length, 1);

    const repo = config.projects.find(p => p.path === repoPath);
    assert.equal(repo.base_branch, 'proto');
  });

  it('folder base_branch is used when explicit project does not specify one', async () => {
    const parentDir = join(TEST_DIR, 'projects');
    createGitRepo(join(parentDir, 'my-repo'));

    const repoPath = join(parentDir, 'my-repo');
    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, `
global:
  ai_provider: claude
  model: opus

folders:
  - path: "${parentDir}"
    base_branch: develop

projects:
  - path: "${repoPath}"
`);

    const { config } = await loadConfig(configPath);

    assert.equal(config.projects.length, 1);

    const repo = config.projects.find(p => p.path === repoPath);
    assert.equal(repo.base_branch, 'develop');
  });

  it('explicit projects appear first, folder-only projects after', async () => {
    const parentDir = join(TEST_DIR, 'projects');
    createGitRepo(join(parentDir, 'repo-a'));
    createGitRepo(join(parentDir, 'repo-b'));
    createGitRepo(join(parentDir, 'repo-c'));

    const repoBPath = join(parentDir, 'repo-b');
    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, `
global:
  ai_provider: claude
  model: opus

folders:
  - path: "${parentDir}"

projects:
  - path: "${repoBPath}"
    base_branch: proto
`);

    const { config } = await loadConfig(configPath);

    assert.equal(config.projects.length, 3);
    assert.equal(config.projects[0].path, repoBPath);
    assert.equal(config.projects[0].base_branch, 'proto');
  });
});
