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
import os from 'os';
import crypto from 'crypto';

/**
 * 会话目录存放策略
 */
export type SessionDirectoryStrategy = 
  | 'system'     // 系统默认位置 + 项目标识符后缀
  | 'project'    // 项目目录下
  | 'custom';    // 自定义根目录

/**
 * 会话目录配置选项
 */
export interface SessionDirectoryOptions {
  /** 存放策略 */
  strategy: SessionDirectoryStrategy;
  /** 项目驱动器标识（如 "C:" 或 "/"） */
  projectDrive?: string;
  /** 项目绝对路径 */
  projectPath?: string;
  /** 自定义根目录（当strategy为'custom'时使用） */
  customRootDir?: string;
  /** 浏览器名称 */
  browserName?: string;
  /** 浏览器渠道 */
  browserChannel?: string;
}

/**
 * 用户会话目录管理器
 * 支持多种存放策略，减少与原有代码的冲突
 */
export class SessionDirectoryManager {
  private static readonly SESSION_DIR_NAME = '.user-session-data-directory';
  private static readonly GITIGNORE_COMMENT = '# Playwright MCP session data (auto-generated)';
  private static readonly MAX_PATH_LENGTH_WINDOWS = 260;

  /**
   * 根据配置选项创建用户数据目录路径
   */
  static createUserDataDir(options: SessionDirectoryOptions): string | undefined {
    try {
      switch (options.strategy) {
        case 'system':
          return this.createSystemUserDataDir(options);
        case 'project':
          return this.createProjectUserDataDir(options);
        case 'custom':
          return this.createCustomUserDataDir(options);
        default:
          throw new Error(`Unknown session directory strategy: ${options.strategy}`);
      }
    } catch (error) {
      console.error('Failed to create session directory:', error);
      return undefined;
    }
  }

  /**
   * 系统默认位置 + 项目标识符后缀
   */
  private static createSystemUserDataDir(options: SessionDirectoryOptions): string {
    const systemDataDir = this.getSystemDataDirectory();
    const projectId = this.generateProjectIdentifier(options.projectDrive, options.projectPath);
    
    // 构建与Playwright官方一致的浏览器配置文件名
    const browserName = options.browserName || 'chromium';
    const channel = options.browserChannel;
    const browserProfile = `mcp-${channel || browserName}-profile`;
    
    // 使用与Playwright官方一致的路径结构：
    // Windows: %LOCALAPPDATA%/ms-playwright/mcp-浏览器名-profile/playwright-plus-mcp/项目名-哈希值/
    // macOS: ~/Library/Caches/ms-playwright/mcp-浏览器名-profile/playwright-plus-mcp/项目名-哈希值/
    // Linux: ~/.cache/ms-playwright/mcp-浏览器名-profile/playwright-plus-mcp/项目名-哈希值/
    const sessionDir = path.join(systemDataDir, 'ms-playwright', browserProfile, 'playwright-plus-mcp', projectId);
    this.ensureDirectoryExists(sessionDir);
    
    return sessionDir;
  }

  /**
   * 项目目录下存放
   */
  private static createProjectUserDataDir(options: SessionDirectoryOptions): string {
    if (!options.projectPath) {
      throw new Error('Project path is required for project strategy');
    }

    const sessionDir = path.join(options.projectPath, this.SESSION_DIR_NAME);
    this.ensureDirectoryExists(sessionDir);
    this.ensureGitignore(options.projectPath);
    
    return sessionDir;
  }

  /**
   * 自定义根目录下存放
   */
  private static createCustomUserDataDir(options: SessionDirectoryOptions): string {
    if (!options.customRootDir) {
      throw new Error('Custom root directory is required for custom strategy');
    }

    const projectId = this.generateProjectIdentifier(options.projectDrive, options.projectPath);
    
    // 构建与Playwright官方一致的浏览器配置文件名
    const browserName = options.browserName || 'chromium';
    const channel = options.browserChannel;
    const browserProfile = `mcp-${channel || browserName}-profile`;
    
    // 在自定义根目录下也使用相同的路径结构
    const sessionDir = path.join(options.customRootDir, 'ms-playwright', browserProfile, 'playwright-plus-mcp', projectId);
    
    this.ensureDirectoryExists(sessionDir);
    
    return sessionDir;
  }

  /**
   * 获取系统数据目录
   * 使用与Playwright官方一致的缓存目录
   */
  private static getSystemDataDirectory(): string {
    const platform = os.platform();
    
    switch (platform) {
      case 'win32':
        // Windows: 使用LOCALAPPDATA，与Playwright官方一致
        return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
      case 'darwin':
        // macOS: 使用Library/Caches，与Playwright官方一致
        return path.join(os.homedir(), 'Library', 'Caches');
      case 'linux':
        // Linux: 使用XDG_CACHE_HOME或~/.cache，与Playwright官方一致
        return process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
      default:
        // 其他Unix-like系统，使用缓存目录
        return path.join(os.homedir(), '.cache');
    }
  }

  /**
   * 生成项目唯一标识符
   * 基于驱动器和项目路径的MD5哈希
   */
  private static generateProjectIdentifier(projectDrive?: string, projectPath?: string): string {
    if (!projectDrive || !projectPath) {
      return 'default';
    }

    // 规范化路径分隔符
    const normalizedPath = projectPath.replace(/\\/g, '/');
    const identifierSource = `${projectDrive}${normalizedPath}`;
    
    // 生成MD5哈希
    const hash = crypto.createHash('md5').update(identifierSource).digest('hex');
    
    // 取前12位哈希值，加上路径的最后一部分作为可读标识
    const baseName = path.basename(normalizedPath) || 'root';
    const sanitizedBaseName = this.sanitizeForFilePath(baseName);
    
    return `${sanitizedBaseName}-${hash.substring(0, 12)}`;
  }

  /**
   * 清理文件路径中的非法字符
   */
  private static sanitizeForFilePath(name: string): string {
    // Windows保留名称列表
    const windowsReservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];

    let sanitized = name
      .replace(/[<>:"/\\|?*]/g, '-')  // 替换Windows非法字符
      .replace(/[\x00-\x1f\x80-\x9f]/g, '-')  // 替换控制字符
      .replace(/\s+/g, '-')           // 替换空格
      .replace(/\.+$/g, '')           // 移除末尾的点（Windows不允许）
      .replace(/-+/g, '-')            // 合并多个连字符
      .replace(/^-|-$/g, '')          // 移除首尾连字符
      .toLowerCase();

    // 处理空字符串
    if (!sanitized) {
      sanitized = 'default';
    }

    // 检查是否是Windows保留名称
    if (windowsReservedNames.includes(sanitized.toUpperCase())) {
      sanitized = `${sanitized}-dir`;
    }

    // 限制长度（考虑到后面还要加哈希值）
    const maxLength = 50;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength).replace(/-+$/, '');
    }

    return sanitized;
  }

  /**
   * 确保目录存在
   */
  private static ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * 确保项目根目录有.gitignore条目
   */
  private static ensureGitignore(projectPath: string): void {
    const gitignorePath = path.join(projectPath, '.gitignore');
    const ignoreEntry = this.SESSION_DIR_NAME;
    
    try {
      let gitignoreContent = '';
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      }

      // 检查是否已经包含ignore条目
      const lines = gitignoreContent.split('\n');
      const hasIgnoreEntry = lines.some(line => line.trim() === ignoreEntry);
      const hasComment = lines.some(line => line.trim() === this.GITIGNORE_COMMENT);

      if (!hasIgnoreEntry) {
        // 添加注释和ignore条目
        const newLines = [];
        if (!hasComment) {
          newLines.push('', this.GITIGNORE_COMMENT);
        }
        newLines.push(ignoreEntry);
        
        const updatedContent = gitignoreContent + newLines.join('\n') + '\n';
        fs.writeFileSync(gitignorePath, updatedContent, 'utf-8');
      }
    } catch (error) {
      // 忽略gitignore更新错误，不影响主要功能
      console.warn('Failed to update .gitignore:', error);
    }
  }

  /**
   * 检查路径长度是否在Windows限制内
   */
  private static isPathTooLong(filePath: string): boolean {
    return os.platform() === 'win32' && filePath.length > this.MAX_PATH_LENGTH_WINDOWS;
  }

  /**
   * 验证会话目录配置
   */
  static validateOptions(options: SessionDirectoryOptions): { valid: boolean; error?: string } {
    if (!options.strategy) {
      return { valid: false, error: 'Strategy is required' };
    }

    if (options.strategy === 'custom' && !options.customRootDir) {
      return { valid: false, error: 'Custom root directory is required for custom strategy' };
    }

    if ((options.strategy === 'system' || options.strategy === 'project') && 
        (!options.projectPath || !options.projectDrive)) {
      return { valid: false, error: 'Project path and drive are required for system/project strategy' };
    }

    return { valid: true };
  }

  /**
   * 清理旧的会话数据（可选功能）
   */
  static cleanupOldSessions(sessionDir: string, maxAgeInDays: number = 30): void {
    try {
      if (!fs.existsSync(sessionDir)) {
        return;
      }

      const cutoffTime = Date.now() - (maxAgeInDays * 24 * 60 * 60 * 1000);
      const entries = fs.readdirSync(sessionDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(sessionDir, entry.name);
        const stats = fs.statSync(fullPath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          if (entry.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old sessions:', error);
    }
  }
} 