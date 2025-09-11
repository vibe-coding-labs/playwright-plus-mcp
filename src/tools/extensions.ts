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

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';
import { z } from 'zod';
// @ts-ignore - crx-util doesn't have TypeScript definitions
import * as crx from 'crx-util';
import { defineTool, defineTabTool } from './tool.js';
import { createSchemaWithProjectIsolation, ProjectIsolationManager } from '../projectIsolation.js';
import type { ProjectInfo } from '../projectIsolation.js';

const extensionInstallSchema = createSchemaWithProjectIsolation({
  extensionId: z.string().optional().describe('Chrome extension ID (e.g., "cjpalhdlnbpafiamejdnhcphjbkeiagm")'),
  extensionUrl: z.string().optional().describe('Full Chrome Web Store URL of the extension'),
  waitForInstall: z.boolean().optional().default(true).describe('Whether to wait for installation to complete'),
  loadImmediately: z.boolean().optional().default(true).describe('Whether to restart browser to load the extension immediately'),
}).refine(data => data.extensionId || data.extensionUrl, {
  message: 'Either extensionId or extensionUrl must be provided'
});

const extensionListSchema = createSchemaWithProjectIsolation({});

const extensionUninstallSchema = createSchemaWithProjectIsolation({
  extensionId: z.string().describe('Chrome extension ID to uninstall (e.g., "bcjindcccaagfpapjjmafapmmgkkhgoa")'),
  restartImmediately: z.boolean().optional().default(true).describe('Whether to restart browser immediately after uninstalling'),
});

/**
 * Extract extension ID from Chrome Web Store URL
 */
function extractExtensionId(url: string): string {
  const match = url.match(/\/detail\/[^/]+\/([a-z]{32})/);
  if (!match)
    throw new Error('Invalid Chrome Web Store URL. Expected format: https://chromewebstore.google.com/detail/extension-name/extension-id');

  return match[1];
}

/**
 * Get Chrome user data directory
 */
function getChromeUserDataDir(): string {
  const platform = os.platform();
  const homeDir = os.homedir();

  switch (platform) {
    case 'win32':
      return path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome');
    case 'linux':
      return path.join(homeDir, '.config', 'google-chrome');
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Get session user data directory from context
 * This ensures we use the same directory that the browser is actually using
 */
function getSessionUserDataDirFromContext(context: any): string | undefined {
  // Get the actual user data directory from the context
  if (context && typeof context.getCurrentUserDataDir === 'function')
    return context.getCurrentUserDataDir();

  return undefined;
}

/**
 * Get session user data directory using the same logic as browser context factory
 * This uses the enhanced project isolation manager with proper configuration
 */
async function getSessionUserDataDirWithConfig(
  context: any,
  projectDrive?: string,
  projectPath?: string
): Promise<string | undefined> {
  // First try to get from context (preferred)
  const contextUserDataDir = getSessionUserDataDirFromContext(context);
  if (contextUserDataDir)
    return contextUserDataDir;


  // Fallback: use the same logic as browser context factory
  if (!projectDrive || !projectPath || !context?.config)
    return undefined;


  try {
    const { EnhancedProjectIsolationManager } = await import('../enhancedProjectIsolation.js');
    const userDataDir = await EnhancedProjectIsolationManager.createUserDataDir(
        context.config,
        { projectDrive, projectPath }
    );
    return userDataDir;
  } catch (error) {
    // If enhanced manager fails, fall back to original logic
    try {
      const projectInfo: ProjectInfo = { projectDrive, projectPath };
      return ProjectIsolationManager.createUserDataDir(projectInfo);
    } catch (fallbackError) {
      return undefined;
    }
  }
}

/**
 * Get session user data directory from project isolation parameters (legacy)
 * This is kept for backward compatibility but should be avoided
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getSessionUserDataDir(projectDrive?: string, projectPath?: string): string | undefined {
  if (!projectDrive || !projectPath)
    return undefined;

  try {
    // Use the enhanced project isolation manager to get the session directory
    const projectInfo: ProjectInfo = { projectDrive, projectPath };
    return ProjectIsolationManager.createUserDataDir(projectInfo);
  } catch (error) {
    // If project isolation fails, return undefined to fall back to global storage
    return undefined;
  }
}

/**
 * Download extension CRX file from Chrome Web Store using crx-util with fallback strategies
 */
async function downloadExtensionCrx(extensionId: string, outputPath: string): Promise<void> {
  try {
    // First try: Use crx-util to download the extension
    const result = await crx.downloadById(extensionId, 'chrome', outputPath);

    if (result.result) {
      // Successfully downloaded extension
      return;
    }

    // If crx-util fails, throw an error with helpful guidance
    throw new Error(`Chrome Web Store blocked automated download (HTTP 204). This is a security measure by Google.

Recommended solutions:
1. Manual Installation: Visit https://chromewebstore.google.com/detail/${extensionId} and install manually
2. Developer Mode: If you have a local CRX file, enable Developer Mode in chrome://extensions/ and load it
3. Alternative Extensions: Consider using similar extensions that allow local installation

The extension ID ${extensionId} appears to be valid, but Chrome Web Store restricts automated downloads to prevent abuse.`);

  } catch (error) {
    // Enhanced error handling with specific guidance for common issues
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('HTTP 204') || errorMessage.includes('204')) {
      throw new Error(`Chrome Web Store blocked automated download (HTTP 204). This is a security measure by Google.

Recommended solutions:
1. Manual Installation: Visit https://chromewebstore.google.com/detail/${extensionId} and install manually
2. Developer Mode: If you have a local CRX file, enable Developer Mode in chrome://extensions/ and load it
3. Alternative Extensions: Consider using similar extensions that allow local installation

The extension ID ${extensionId} appears to be valid, but Chrome Web Store restricts automated downloads to prevent abuse.`);
    }

    throw new Error(`Failed to download extension ${extensionId}: ${errorMessage}`);
  }
}

/**
 * Extract CRX file to directory
 * Use a more robust approach that handles different CRX formats
 */
function extractCrxFile(crxPath: string, extractDir: string): void {
  try {
    // Create extraction directory
    fs.mkdirSync(extractDir, { recursive: true });

    // Try to extract directly with unzip (ignoring warnings about extra bytes, overwrite existing files)
    try {
      execSync(`unzip -o -q "${crxPath}" -d "${extractDir}" 2>/dev/null || unzip -o "${crxPath}" -d "${extractDir}"`, { stdio: 'pipe' });
      return;
    } catch (e) {
      // If direct unzip fails, try to parse CRX header
    }

    // Read CRX file and try to find ZIP data
    const crxData = fs.readFileSync(crxPath);

    // Look for ZIP file signature (PK\x03\x04)
    const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
    let zipOffset = -1;

    for (let i = 0; i <= crxData.length - 4; i++) {
      if (crxData.subarray(i, i + 4).equals(zipSignature)) {
        zipOffset = i;
        break;
      }
    }

    if (zipOffset === -1)
      throw new Error('No ZIP data found in CRX file');


    // Extract ZIP data
    const zipData = crxData.subarray(zipOffset);

    // Write ZIP data to temporary file
    const tempZipPath = crxPath + '.zip';
    fs.writeFileSync(tempZipPath, zipData);

    // Extract ZIP file (overwrite existing files)
    execSync(`unzip -o -q "${tempZipPath}" -d "${extractDir}"`, { stdio: 'pipe' });

    // Clean up temporary ZIP file
    fs.unlinkSync(tempZipPath);

  } catch (error) {
    throw new Error(`Failed to extract CRX file: ${error}`);
  }
}

/**
 * Install extension to Chrome extensions directory (currently unused)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function installExtensionToChrome(extensionId: string, userDataDir?: string): Promise<string> {
  const chromeUserDataDir = userDataDir || getChromeUserDataDir();
  const extensionsDir = path.join(chromeUserDataDir, 'Default', 'Extensions', extensionId);

  // Create temporary directory for download
  const tempDir = path.join(os.tmpdir(), `chrome-ext-${extensionId}-${Date.now()}`);
  const crxPath = path.join(tempDir, `${extensionId}.crx`);

  try {
    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });

    // Download CRX file
    await downloadExtensionCrx(extensionId, crxPath);

    // Create version directory (remove existing if present)
    const versionDir = path.join(extensionsDir, '1.0.0_0');
    if (fs.existsSync(versionDir))
      fs.rmSync(versionDir, { recursive: true, force: true });


    // Extract CRX to version directory
    extractCrxFile(crxPath, versionDir);

    // Clean up temp files
    fs.rmSync(tempDir, { recursive: true, force: true });

    return versionDir;
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(tempDir))
      fs.rmSync(tempDir, { recursive: true, force: true });

    throw error;
  }
}

/**
 * Get the MCP extensions directory for a specific session
 * If sessionUserDataDir is provided, extensions are stored within that session
 * Otherwise, falls back to global directory for backward compatibility
 */
function getMcpExtensionsDir(sessionUserDataDir?: string): string {
  if (sessionUserDataDir) {
    // Session-based extension storage
    const extensionsDir = path.join(sessionUserDataDir, 'extensions');
    if (!fs.existsSync(extensionsDir))
      fs.mkdirSync(extensionsDir, { recursive: true });
    return extensionsDir;
  }

  // Global extension storage (backward compatibility)
  const homeDir = os.homedir();
  const mcpExtensionsDir = path.join(homeDir, '.mcp-extensions');
  if (!fs.existsSync(mcpExtensionsDir))
    fs.mkdirSync(mcpExtensionsDir, { recursive: true });

  return mcpExtensionsDir;
}

/**
 * Get the extensions registry file path for a specific session
 */
function getExtensionsRegistryPath(sessionUserDataDir?: string): string {
  return path.join(getMcpExtensionsDir(sessionUserDataDir), 'extensions.json');
}

/**
 * Load extensions registry for a specific session
 */
function loadExtensionsRegistry(sessionUserDataDir?: string): { extensions: Array<{ id: string; name: string; path: string; version: string }> } {
  const registryPath = getExtensionsRegistryPath(sessionUserDataDir);
  if (!fs.existsSync(registryPath)) {
    const defaultRegistry = { extensions: [] };
    fs.writeFileSync(registryPath, JSON.stringify(defaultRegistry, null, 2));
    return defaultRegistry;
  }

  try {
    const content = fs.readFileSync(registryPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    // If registry is corrupted, create a new one
    const defaultRegistry = { extensions: [] };
    fs.writeFileSync(registryPath, JSON.stringify(defaultRegistry, null, 2));
    return defaultRegistry;
  }
}

/**
 * Save extensions registry for a specific session
 */
function saveExtensionsRegistry(registry: { extensions: Array<{ id: string; name: string; path: string; version: string }> }, sessionUserDataDir?: string): void {
  const registryPath = getExtensionsRegistryPath(sessionUserDataDir);
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
}

/**
 * Install extension by downloading CRX and extracting to session extensions directory
 */
async function installExtensionToMcp(extensionId: string, sessionUserDataDir?: string): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `chrome-ext-${extensionId}-${Date.now()}`);

  try {
    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });

    // Download CRX file
    const crxPath = path.join(tempDir, `${extensionId}.crx`);
    await downloadExtensionCrx(extensionId, crxPath);

    // Get session extensions directory
    const mcpExtensionsDir = getMcpExtensionsDir(sessionUserDataDir);
    const extensionDir = path.join(mcpExtensionsDir, extensionId);

    // Remove existing extension directory if present
    if (fs.existsSync(extensionDir))
      fs.rmSync(extensionDir, { recursive: true, force: true });


    // Create extension directory
    fs.mkdirSync(extensionDir, { recursive: true });

    // Extract CRX to extension directory
    extractCrxFile(crxPath, extensionDir);

    // Read manifest to get extension name and version
    const manifestPath = path.join(extensionDir, 'manifest.json');
    let extensionName = extensionId;
    let extensionVersion = '1.0.0';

    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        extensionName = manifest.name || extensionId;
        extensionVersion = manifest.version || '1.0.0';
      } catch (e) {
        // Use defaults if manifest is invalid
      }
    }

    // Update extensions registry for this session
    const registry = loadExtensionsRegistry(sessionUserDataDir);

    // Remove existing entry if present
    registry.extensions = registry.extensions.filter(ext => ext.id !== extensionId);

    // Add new entry
    registry.extensions.push({
      id: extensionId,
      name: extensionName,
      path: extensionDir,
      version: extensionVersion
    });

    saveExtensionsRegistry(registry, sessionUserDataDir);

    // Clean up temp files
    fs.rmSync(tempDir, { recursive: true, force: true });

    return extensionDir;
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(tempDir))
      fs.rmSync(tempDir, { recursive: true, force: true });

    throw error;
  }
}

/**
 * Get all installed extension paths for Chrome launch args for a specific session
 */
export function getInstalledExtensionPaths(sessionUserDataDir?: string): string[] {
  try {
    const registry = loadExtensionsRegistry(sessionUserDataDir);
    return registry.extensions
        .filter(ext => fs.existsSync(ext.path)) // Only include existing paths
        .map(ext => ext.path);
  } catch (error) {
    return [];
  }
}

/**
 * Uninstall extension by removing from session extensions directory and registry
 */
async function uninstallExtensionFromMcp(extensionId: string, sessionUserDataDir?: string): Promise<{ name: string; path: string }> {
  const registry = loadExtensionsRegistry(sessionUserDataDir);

  // Find the extension in registry
  const extensionIndex = registry.extensions.findIndex(ext => ext.id === extensionId);
  if (extensionIndex === -1)
    throw new Error(`Extension ${extensionId} not found in session registry`);


  const extension = registry.extensions[extensionIndex];
  const extensionPath = extension.path;

  // Remove extension directory if it exists
  if (fs.existsSync(extensionPath))
    fs.rmSync(extensionPath, { recursive: true, force: true });


  // Remove from registry
  registry.extensions.splice(extensionIndex, 1);
  saveExtensionsRegistry(registry, sessionUserDataDir);

  return { name: extension.name, path: extensionPath };
}

const installExtension = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_extension_install',
    title: 'Install Chrome Extension',
    description: 'Install a Chrome extension from the Chrome Web Store by downloading and managing it locally',
    inputSchema: extensionInstallSchema,
    type: 'destructive',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    // Extract extension ID
    let extensionId: string;
    if (params.extensionId)
      extensionId = params.extensionId;
    else if (params.extensionUrl)
      extensionId = extractExtensionId(params.extensionUrl);
    else
      throw new Error('Either extensionId or extensionUrl must be provided');


    // Get session user data directory using the same logic as browser context factory
    const sessionUserDataDir = await getSessionUserDataDirWithConfig(
        tab.context,
        params.projectDrive,
        params.projectPath
    );

    response.addCode(`// Installing Chrome extension: ${extensionId}`);
    if (sessionUserDataDir)
      response.addResult(`📁 Using session-isolated extension storage: ${sessionUserDataDir}/extensions`);
    else
      response.addResult(`📁 Using global extension storage (no project isolation)`);

    try {
      const installPath = await installExtensionToMcp(extensionId, sessionUserDataDir);
      response.addResult(`✅ Chrome extension ${extensionId} installed successfully to: ${installPath}`);

      // Show current installed extensions for this session
      const registry = loadExtensionsRegistry(sessionUserDataDir);
      response.addResult(`📋 Total installed extensions in this session: ${registry.extensions.length}`);

      // Restart browser to load the extension immediately if requested
      if (params.loadImmediately) {
        response.addCode(`// Restarting browser to load extension immediately`);

        try {
          // Close current browser context
          response.addResult(`🔄 Restarting browser to load the new extension...`);

          // Close the current page/context
          await tab.waitForCompletion(async () => {
            await tab.page.close();
          });

          // The browser context will be recreated automatically on next navigation
          // with the new extension loaded via launch args
          response.addResult(`✅ Browser restart initiated. The extension will be loaded automatically.`);
          response.addResult(`🚀 Navigate to any page to see the extension in action!`);

        } catch (restartError) {
          response.addResult(`⚠️  Could not restart browser: ${restartError}`);
          response.addResult(`🔄 Please manually restart the browser to load the extension.`);
        }
      } else {
        response.addResult(`🔄 The extension will be automatically loaded when you restart the browser or start a new session.`);
      }

      response.addResult(`📁 Extension registry: ${getExtensionsRegistryPath(sessionUserDataDir)}`);

    } catch (error) {
      throw new Error(`Failed to install extension ${extensionId}: ${error}`);
    }
  },
});

const listExtensions = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_extension_list',
    title: 'List Installed Extensions',
    description: 'List all MCP-managed Chrome extensions',
    inputSchema: extensionListSchema,
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    try {
      // Get session user data directory using the same logic as browser context factory
      const sessionUserDataDir = await getSessionUserDataDirWithConfig(
          context,
          params.projectDrive,
          params.projectPath
      );
      const registry = loadExtensionsRegistry(sessionUserDataDir);

      if (sessionUserDataDir)
        response.addResult(`📁 Session-isolated extension storage: ${sessionUserDataDir}/extensions`);
      else
        response.addResult(`📁 Global extension storage (no project isolation)`);

      if (registry.extensions.length === 0) {
        response.addResult(`📋 No MCP-managed extensions found in this session.`);
        response.addResult(`📁 Extension registry: ${getExtensionsRegistryPath(sessionUserDataDir)}`);
        response.addResult(`💡 Use browser_extension_install to install extensions.`);
        return;
      }

      response.addResult(`📋 Found ${registry.extensions.length} MCP-managed extensions in this session:`);

      for (const ext of registry.extensions) {
        const exists = fs.existsSync(ext.path);
        const status = exists ? '✅' : '❌';
        response.addResult(`  ${status} ${ext.name} (${ext.id}) - v${ext.version}`);
        if (!exists)
          response.addResult(`      ⚠️  Path not found: ${ext.path}`);

      }

      response.addResult(`📁 Extension registry: ${getExtensionsRegistryPath(sessionUserDataDir)}`);
      response.addResult(`📂 Extensions directory: ${getMcpExtensionsDir(sessionUserDataDir)}`);

      // Show extension paths for Chrome launch args
      const extensionPaths = getInstalledExtensionPaths(sessionUserDataDir);
      if (extensionPaths.length > 0) {
        response.addResult(`🚀 Chrome launch args will include:`);
        response.addResult(`   --load-extension=${extensionPaths.join(',')}`);
        response.addResult(`   --disable-extensions-except=${extensionPaths.join(',')}`);
      }

    } catch (error) {
      throw new Error(`Failed to list extensions: ${error}`);
    }
  },
});

const uninstallExtension = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_extension_uninstall',
    title: 'Uninstall Chrome Extension',
    description: 'Uninstall a Chrome extension from MCP management and restart browser',
    inputSchema: extensionUninstallSchema,
    type: 'destructive',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    // Get session user data directory using the same logic as browser context factory
    const sessionUserDataDir = await getSessionUserDataDirWithConfig(
        tab.context,
        params.projectDrive,
        params.projectPath
    );

    const extensionId = params.extensionId;
    response.addCode(`// Uninstalling Chrome extension: ${extensionId}`);

    if (sessionUserDataDir)
      response.addResult(`📁 Using session-isolated extension storage: ${sessionUserDataDir}/extensions`);
    else
      response.addResult(`📁 Using global extension storage (no project isolation)`);

    try {
      const uninstallResult = await uninstallExtensionFromMcp(extensionId, sessionUserDataDir);
      response.addResult(`✅ Chrome extension "${uninstallResult.name}" (${extensionId}) uninstalled successfully`);
      response.addResult(`🗑️  Removed from: ${uninstallResult.path}`);

      // Show current installed extensions for this session
      const registry = loadExtensionsRegistry(sessionUserDataDir);
      response.addResult(`📋 Remaining installed extensions in this session: ${registry.extensions.length}`);

      // Restart browser to apply changes if requested
      if (params.restartImmediately) {
        response.addCode(`// Restarting browser to apply uninstall changes`);

        try {
          // Close current browser context
          response.addResult(`🔄 Restarting browser to apply uninstall changes...`);

          // Close the current page/context
          await tab.waitForCompletion(async () => {
            await tab.page.close();
          });

          // The browser context will be recreated automatically on next navigation
          // without the uninstalled extension
          response.addResult(`✅ Browser restart initiated. The extension has been removed.`);
          response.addResult(`🚀 Navigate to any page to see the changes!`);

        } catch (restartError) {
          response.addResult(`⚠️  Could not restart browser: ${restartError}`);
          response.addResult(`🔄 Please manually restart the browser to apply changes.`);
        }
      } else {
        response.addResult(`🔄 The extension will be removed when you restart the browser or start a new session.`);
      }

      response.addResult(`📁 Extension registry: ${getExtensionsRegistryPath(sessionUserDataDir)}`);

    } catch (error) {
      throw new Error(`Failed to uninstall extension ${extensionId}: ${error}`);
    }
  },
});

export default [
  installExtension,
  uninstallExtension,
  listExtensions,
];
