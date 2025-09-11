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
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';

import * as playwright from 'playwright';

import { logUnhandledError, testDebug } from './log.js';
import { ProjectIsolationManager } from './projectIsolation.js';
import { getInstalledExtensionPaths } from './tools/extensions.js';

import type { FullConfig } from './config.js';
import type { ProjectInfo } from './projectIsolation.js';

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

export function contextFactory(browserConfig: FullConfig['browser']): BrowserContextFactory {
  if (browserConfig.remoteEndpoint)
    return new RemoteContextFactory(browserConfig);
  if (browserConfig.cdpEndpoint)
    return new CdpContextFactory(browserConfig);
  if (browserConfig.isolated)
    return new IsolatedContextFactory(browserConfig);
  return new PersistentContextFactory(browserConfig);
}

export interface BrowserContextFactory {
  createContext(clientInfo?: { name: string, version: string }, projectInfo?: ProjectInfo): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void>, userDataDir?: string }>;
}

class BaseContextFactory implements BrowserContextFactory {
  readonly browserConfig: FullConfig['browser'];
  protected _browserPromise: Promise<playwright.Browser> | undefined;
  readonly name: string;

  constructor(name: string, browserConfig: FullConfig['browser']) {
    this.name = name;
    this.browserConfig = browserConfig;
  }

  protected async _obtainBrowser(): Promise<playwright.Browser> {
    if (this._browserPromise)
      return this._browserPromise;
    testDebug(`obtain browser (${this.name})`);
    this._browserPromise = this._doObtainBrowser();
    void this._browserPromise.then(browser => {
      browser.on('disconnected', () => {
        this._browserPromise = undefined;
      });
    }).catch(() => {
      this._browserPromise = undefined;
    });
    return this._browserPromise;
  }

  protected async _doObtainBrowser(): Promise<playwright.Browser> {
    throw new Error('Not implemented');
  }

  async createContext(clientInfo?: { name: string, version: string }, projectInfo?: ProjectInfo): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void>, userDataDir?: string }> {
    testDebug(`create browser context (${this.name})`);
    const browser = await this._obtainBrowser();
    const browserContext = await this._doCreateContext(browser, projectInfo);
    return { browserContext, close: () => this._closeBrowserContext(browserContext, browser), userDataDir: undefined };
  }

  protected async _doCreateContext(browser: playwright.Browser, projectInfo?: ProjectInfo): Promise<playwright.BrowserContext> {
    throw new Error('Not implemented');
  }

  protected async _closeBrowserContext(browserContext: playwright.BrowserContext, browser: playwright.Browser) {
    testDebug(`close browser context (${this.name})`);
    if (browser.contexts().length === 1)
      this._browserPromise = undefined;
    await browserContext.close().catch(logUnhandledError);
    if (browser.contexts().length === 0) {
      testDebug(`close browser (${this.name})`);
      await browser.close().catch(logUnhandledError);
    }
  }
}

class IsolatedContextFactory extends BaseContextFactory {
  private _browserPromiseWithProject: Map<string, Promise<playwright.Browser>> = new Map();

  constructor(browserConfig: FullConfig['browser']) {
    super('isolated', browserConfig);
  }

  protected override async _obtainBrowser(): Promise<playwright.Browser> {
    // For isolated context, we need to defer browser creation until we have project info
    // This is handled in createContext method
    throw new Error('IsolatedContextFactory requires project info - use createContext directly');
  }

  protected override async _doObtainBrowser(): Promise<playwright.Browser> {
    // This should not be called directly for IsolatedContextFactory
    throw new Error('Use _doObtainBrowserWithProject instead');
  }

  private async _doObtainBrowserWithProject(projectInfo?: ProjectInfo): Promise<playwright.Browser> {
    const projectKey = projectInfo ? `${projectInfo.projectDrive}:${projectInfo.projectPath}` : 'global';

    if (this._browserPromiseWithProject.has(projectKey))
      return this._browserPromiseWithProject.get(projectKey)!;


    const browserPromise = this._createBrowserWithProject(projectInfo);
    this._browserPromiseWithProject.set(projectKey, browserPromise);

    // Handle browser disconnection
    browserPromise.then(browser => {
      browser.on('disconnected', () => {
        this._browserPromiseWithProject.delete(projectKey);
      });
    }).catch(() => {
      this._browserPromiseWithProject.delete(projectKey);
    });

    return browserPromise;
  }

  private async _createBrowserWithProject(projectInfo?: ProjectInfo): Promise<playwright.Browser> {
    await injectCdpPort(this.browserConfig);
    const browserType = playwright[this.browserConfig.browserName];

    // Get session user data directory for extension loading
    const sessionUserDataDir = this._getSessionUserDataDir(projectInfo);
    const enhancedLaunchOptions = enhanceLaunchOptionsWithExtensions(this.browserConfig.launchOptions || {}, sessionUserDataDir);

    return browserType.launch({
      ...enhancedLaunchOptions,
      handleSIGINT: false,
      handleSIGTERM: false,
    }).catch(error => {
      if (error.message.includes('Executable doesn\'t exist'))
        throw new Error(`Browser specified in your config is not installed. Either install it (likely) or change the config.`);
      throw error;
    });
  }

  async createContext(clientInfo?: { name: string, version: string }, projectInfo?: ProjectInfo): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void>, userDataDir?: string }> {
    testDebug(`create browser context (${this.name})`);
    const browser = await this._doObtainBrowserWithProject(projectInfo);
    const browserContext = await this._doCreateContext(browser, projectInfo);
    const userDataDir = this._getSessionUserDataDir(projectInfo);
    return { browserContext, close: () => this._closeBrowserContext(browserContext, browser), userDataDir };
  }

  protected override async _doCreateContext(browser: playwright.Browser, projectInfo?: ProjectInfo): Promise<playwright.BrowserContext> {
    return browser.newContext(this.browserConfig.contextOptions);
  }

  private _getSessionUserDataDir(projectInfo?: ProjectInfo): string | undefined {
    if (!projectInfo?.projectDrive || !projectInfo?.projectPath)
      return undefined;


    try {
      // Use the enhanced project isolation manager to get the session directory
      return ProjectIsolationManager.createUserDataDir(projectInfo);
    } catch (error) {
      // If project isolation fails, return undefined to fall back to global storage
      return undefined;
    }
  }
}

class CdpContextFactory extends BaseContextFactory {
  constructor(browserConfig: FullConfig['browser']) {
    super('cdp', browserConfig);
  }

  protected override async _doObtainBrowser(): Promise<playwright.Browser> {
    return playwright.chromium.connectOverCDP(this.browserConfig.cdpEndpoint!);
  }

  protected override async _doCreateContext(browser: playwright.Browser, projectInfo?: ProjectInfo): Promise<playwright.BrowserContext> {
    return this.browserConfig.isolated ? await browser.newContext() : browser.contexts()[0];
  }
}

class RemoteContextFactory extends BaseContextFactory {
  constructor(browserConfig: FullConfig['browser']) {
    super('remote', browserConfig);
  }

  protected override async _doObtainBrowser(): Promise<playwright.Browser> {
    const url = new URL(this.browserConfig.remoteEndpoint!);
    url.searchParams.set('browser', this.browserConfig.browserName);
    if (this.browserConfig.launchOptions)
      url.searchParams.set('launch-options', JSON.stringify(this.browserConfig.launchOptions));
    return playwright[this.browserConfig.browserName].connect(String(url));
  }

  protected override async _doCreateContext(browser: playwright.Browser, projectInfo?: ProjectInfo): Promise<playwright.BrowserContext> {
    return browser.newContext();
  }
}

class PersistentContextFactory implements BrowserContextFactory {
  readonly browserConfig: FullConfig['browser'];
  private _userDataDirs = new Set<string>();

  constructor(browserConfig: FullConfig['browser']) {
    this.browserConfig = browserConfig;
  }

  async createContext(clientInfo?: { name: string, version: string }, projectInfo?: ProjectInfo): Promise<{ browserContext: playwright.BrowserContext, close: () => Promise<void>, userDataDir?: string }> {
    await injectCdpPort(this.browserConfig);
    testDebug('create browser context (persistent)');
    const userDataDir = this.browserConfig.userDataDir ?? await this._createUserDataDir(projectInfo);

    this._userDataDirs.add(userDataDir);
    testDebug('lock user data dir', userDataDir);

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
        return { browserContext, close, userDataDir };
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
    testDebug('close browser context (persistent)');
    testDebug('release user data dir', userDataDir);
    await browserContext.close().catch(() => {});
    this._userDataDirs.delete(userDataDir);
    testDebug('close browser context complete (persistent)');
  }

  private async _createUserDataDir(projectInfo?: ProjectInfo): Promise<string> {
    // 如果提供了项目信息，使用项目隔离管理器
    if (projectInfo?.projectPath && projectInfo?.projectDrive) {
      const projectUserDataDir = ProjectIsolationManager.createUserDataDir(projectInfo);
      if (projectUserDataDir) {
        await ProjectIsolationManager.ensureProjectDataDir(projectUserDataDir);
        return projectUserDataDir;
      }
    }

    // 否则使用默认逻辑
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
    return result;
  }
}

async function injectCdpPort(browserConfig: FullConfig['browser']) {
  if (browserConfig.browserName === 'chromium')
    (browserConfig.launchOptions as any).cdpPort = await findFreePort();
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}
