/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as playwright from 'playwright';

import { testDebug } from './log.js';
import { EnhancedProjectIsolationManager } from './enhancedProjectIsolation.js';
import { getInstalledExtensionPaths } from './tools/extensions.js';
import type { FullConfig } from './config.js';
import type { ProjectInfo } from './projectIsolation.js';
import type { BrowserContextFactory } from './browserContextFactory.js';

/**
 * Enhance launch options with MCP-managed extensions
 */
function enhanceLaunchOptionsWithExtensions(launchOptions: playwright.LaunchOptions, sessionUserDataDir?: string): playwright.LaunchOptions {
  const mcpExtensionPaths = getInstalledExtensionPaths(sessionUserDataDir);
  const enhancedOptions = { ...launchOptions };
  const args = [...(enhancedOptions.args || [])];

  // Collect all extension paths (existing + MCP-managed)
  const allExtensionPaths: string[] = [];

  // 1. Find and remove existing --load-extension arguments, extract paths
  for (let i = args.length - 1; i >= 0; i--) {
    const arg = args[i];
    if (arg.startsWith('--load-extension=')) {
      const existingPaths = arg.substring('--load-extension='.length).split(',');
      allExtensionPaths.push(...existingPaths.filter(path => path.trim()));
      args.splice(i, 1); // Remove existing argument
      testDebug(`Found existing --load-extension argument: ${existingPaths.join(',')}`);
    }
  }

  // 2. Add MCP-managed extension paths
  allExtensionPaths.push(...mcpExtensionPaths);

  // 3. Remove duplicates and empty paths
  const uniqueExtensionPaths = [...new Set(allExtensionPaths.filter(path => path.trim()))];

  // 4. If we have extension paths, add merged arguments
  if (uniqueExtensionPaths.length > 0) {
    const allExtensionPathsStr = uniqueExtensionPaths.join(',');
    args.push(`--load-extension=${allExtensionPathsStr}`);
    args.push(`--disable-extensions-except=${allExtensionPathsStr}`);
    testDebug(`Enhanced launch options with ${uniqueExtensionPaths.length} total extensions: ${allExtensionPathsStr}`);
  } else {
    testDebug('No extensions to load');
  }

  // 5. Ensure we don't disable extensions entirely
  const disableExtensionsIndex = args.findIndex(arg => arg === '--disable-extensions');
  if (disableExtensionsIndex !== -1) {
    args.splice(disableExtensionsIndex, 1);
    testDebug('Removed --disable-extensions argument to allow extension loading');
  }

  enhancedOptions.args = args;
  return enhancedOptions;
}

/**
 * 增强的持久化上下文工厂
 * 扩展原有PersistentContextFactory，支持新的会话目录管理策略
 */
export class EnhancedPersistentContextFactory implements BrowserContextFactory {
  readonly browserConfig: FullConfig['browser'];
  readonly config: FullConfig;
  private readonly _userDataDirs = new Set<string>();

  constructor(browserConfig: FullConfig['browser'], config: FullConfig) {
    this.browserConfig = browserConfig;
    this.config = config;
  }

  async createContext(clientInfo?: { name: string, version: string }, projectInfo?: ProjectInfo): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void> }> {
    testDebug('create browser context (enhanced persistent)');

    // 使用增强的用户数据目录创建逻辑
    const userDataDir = this.browserConfig.userDataDir ?? await this._createEnhancedUserDataDir(projectInfo);

    this._userDataDirs.add(userDataDir);
    testDebug('lock user data dir (enhanced)', userDataDir);

    const browserType = playwright[this.browserConfig.browserName];
    const enhancedLaunchOptions = enhanceLaunchOptionsWithExtensions(this.browserConfig.launchOptions || {}, userDataDir);
    for (let i = 0; i < 5; i++) {
      try {
        const browserContext = await browserType.launchPersistentContext(userDataDir, {
          ...enhancedLaunchOptions,
          ...this.browserConfig.contextOptions,
          handleSIGINT: false,
          handleSIGTERM: false,
        });
        const close = () => this._closeBrowserContext(browserContext, userDataDir);
        return { browserContext, close };
      } catch (error: any) {
        if (error.message.includes('Executable doesn\'t exist'))
          throw new Error(`Browser specified in your config is not installed. Either install it (likely) or change the config.`);
        if (error.message.includes('ProcessSingleton') || error.message.includes('Invalid URL')) {
          // User data directory is already in use, try again.
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw error;
      }
    }
    throw new Error(`Browser is already in use for ${userDataDir}, use --isolated to run multiple instances of the same browser`);
  }

  private async _closeBrowserContext(browserContext: playwright.BrowserContext, userDataDir: string) {
    await browserContext.close();
    this._userDataDirs.delete(userDataDir);
    testDebug('unlock user data dir (enhanced)', userDataDir);
    testDebug('close browser context complete (enhanced persistent)');
  }

  /**
   * 增强的用户数据目录创建逻辑
   * 集成新的SessionDirectoryManager和原有逻辑
   */
  private async _createEnhancedUserDataDir(projectInfo?: ProjectInfo): Promise<string> {
    try {
      // 尝试使用增强的项目隔离管理器
      if (this.config.projectIsolation && projectInfo) {
        const enhancedUserDataDir = await EnhancedProjectIsolationManager.createUserDataDir(
            this.config,
            { projectDrive: projectInfo.projectDrive, projectPath: projectInfo.projectPath }
        );

        if (enhancedUserDataDir) {
          testDebug('using enhanced user data dir', enhancedUserDataDir);
          return enhancedUserDataDir;
        }
      }

      // 降级到原有逻辑
      return await this._createDefaultUserDataDir();
    } catch (error) {
      // Enhanced user data dir creation failed, falling back to default
      return await this._createDefaultUserDataDir();
    }
  }

  /**
   * 原有的默认用户数据目录创建逻辑
   * 保持与原PersistentContextFactory一致
   */
  private async _createDefaultUserDataDir(): Promise<string> {
    let cacheDirectory: string;
    if (process.platform === 'linux')
      cacheDirectory = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
    else if (process.platform === 'darwin')
      cacheDirectory = path.join(os.homedir(), 'Library', 'Caches');
    else if (process.platform === 'win32')
      cacheDirectory = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    else
      throw new Error('Unsupported platform: ' + process.platform);

    const result = path.join(cacheDirectory, 'ms-playwright', `mcp-${this.browserConfig.launchOptions?.channel ?? this.browserConfig?.browserName}-profile`);
    await fs.promises.mkdir(result, { recursive: true });
    testDebug('using default user data dir', result);
    return result;
  }

  /**
   * 获取会话目录信息（用于调试）
   */
  getSessionInfo(projectInfo?: ProjectInfo): {
    enhanced: boolean;
    strategy?: string;
    expectedPath?: string;
    fallbackPath?: string;
  } {
    if (!this.config.projectIsolation || !projectInfo)
      return { enhanced: false };


    const info = EnhancedProjectIsolationManager.getSessionDirectoryInfo(
        this.config,
        { projectDrive: projectInfo.projectDrive, projectPath: projectInfo.projectPath }
    );

    return {
      enhanced: info.enabled,
      strategy: info.strategy,
      expectedPath: info.expectedPath,
      fallbackPath: info.fallbackPath,
    };
  }
}

/**
 * 增强的上下文工厂创建函数
 * 根据配置决定是否使用增强功能
 */
export function createEnhancedContextFactory(config: FullConfig): BrowserContextFactory {
  // 如果启用了项目隔离，根据策略选择工厂
  if (config.projectIsolation) {
    const strategy = config.projectIsolationSessionStrategy || 'system';

    // 只有project策略使用原有逻辑，其他策略都使用增强工厂
    if (strategy === 'project') {
      // 使用原有的上下文工厂（project策略）
      const { contextFactory } = require('./browserContextFactory.js');
      return contextFactory(config.browser);
    }

    // system和custom策略使用增强工厂
    if (config.browser.remoteEndpoint) {
      // Remote endpoint 暂不支持增强功能，使用原有逻辑
      const { contextFactory } = require('./browserContextFactory.js');
      return contextFactory(config.browser);
    }

    if (config.browser.cdpEndpoint) {
      // CDP endpoint 暂不支持增强功能，使用原有逻辑
      const { contextFactory } = require('./browserContextFactory.js');
      return contextFactory(config.browser);
    }

    if (config.browser.isolated) {
      // Isolated mode 暂不支持增强功能，使用原有逻辑
      const { contextFactory } = require('./browserContextFactory.js');
      return contextFactory(config.browser);
    }

    // 使用增强的持久化上下文工厂（system和custom策略）
    return new EnhancedPersistentContextFactory(config.browser, config);
  }

  // 未启用项目隔离，使用原有的上下文工厂
  const { contextFactory } = require('./browserContextFactory.js');
  return contextFactory(config.browser);
}
