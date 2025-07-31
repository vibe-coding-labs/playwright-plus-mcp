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
import os from 'os';
import path from 'path';
import { z } from 'zod';

/**
 * 项目信息接口
 */
export interface ProjectInfo {
  projectDrive?: string;    // 项目所在盘符 (如 "C:", "/")
  projectPath?: string;     // 项目绝对路径
}

/**
 * 项目隔离参数的Zod Schema
 */
export const projectIsolationSchema = z.object({
  projectDrive: z.string().optional().describe('Project drive letter or root (e.g., "C:", "/") for session isolation'),
  projectPath: z.string().optional().describe('Absolute path to project root directory for session isolation'),
});

/**
 * 验证项目隔离参数
 */
export function validateProjectIsolationParams(params: any): boolean {
  // 两个参数要么都提供，要么都不提供
  return (!!params.projectDrive && !!params.projectPath) || (!params.projectDrive && !params.projectPath);
}

/**
 * 验证项目隔离参数（考虑配置）
 * 当项目隔离启用时，必须提供两个参数；否则参数可选
 */
export function validateProjectIsolationParamsWithConfig(
  params: any,
  projectIsolationEnabled: boolean
): boolean {
  // 首先检查参数一致性
  const paramsConsistent = validateProjectIsolationParams(params);
  if (!paramsConsistent) {
    return false;
  }

  // 如果启用了项目隔离，必须提供两个参数
  if (projectIsolationEnabled) {
    return !!(params.projectDrive && params.projectPath);
  }

  // 如果没有启用项目隔离，参数可选
  return true;
}

/**
 * 生成详细的项目隔离参数错误信息
 */
export function getProjectIsolationErrorMessage(projectIsolationEnabled: boolean): string {
  if (projectIsolationEnabled) {
    return [
      'Project isolation is enabled but required parameters are missing.',
      '',
      'Required parameters:',
      '• projectDrive: Project drive letter or root directory',
      '• projectPath: Absolute path to your project root directory',
      '',
      'Examples:',
      '• Windows: projectDrive="C:", projectPath="C:\\Users\\username\\my-project"',
      '• macOS/Linux: projectDrive="/", projectPath="/Users/username/my-project"',
      '',
      'How to obtain these values:',
      '• projectDrive: The root of your file system (Windows: drive letter like "C:", Unix: "/")',
      '• projectPath: The absolute path to your current project directory',
      '• You can get the current directory path using: pwd (Unix) or cd (Windows)',
      '',
      'This ensures each project has isolated browser sessions and prevents data mixing between projects.'
    ].join('\n');
  } else {
    return 'Both projectDrive and projectPath must be provided together, or neither should be provided.';
  }
}

/**
 * 项目隔离管理器
 * 处理基于项目路径的用户数据目录创建和管理
 */
export class ProjectIsolationManager {
  
  private static readonly SESSION_DIR_NAME = '.user-session-data-directory';
  private static readonly GITIGNORE_COMMENT = '# Playwright MCP session data (auto-generated)';
  private static readonly MAX_PATH_LENGTH_WINDOWS = 260;

  /**
   * 根据项目信息创建用户数据目录路径
   */
  static createUserDataDir(projectInfo: ProjectInfo): string | undefined {
    if (!projectInfo.projectPath || !projectInfo.projectDrive) {
      return undefined;
    }

    try {
      // 验证项目路径
      if (!this.validateProjectPath(projectInfo.projectPath)) {
        return undefined;
      }

      // 规范化路径
      const normalizedPath = path.resolve(projectInfo.projectPath);
      
      // 创建会话数据目录路径
      const sessionDataDir = path.join(normalizedPath, this.SESSION_DIR_NAME);
      
      // Windows路径长度检查
      if (process.platform === 'win32' && sessionDataDir.length > this.MAX_PATH_LENGTH_WINDOWS) {
        console.warn(`⚠️  Warning: Path length (${sessionDataDir.length}) exceeds Windows limit (${this.MAX_PATH_LENGTH_WINDOWS})`);
        console.warn(`   Path: ${sessionDataDir}`);
      }

      return sessionDataDir;
    } catch (error) {
      console.error('❌ Failed to create user data directory path:', error);
      return undefined;
    }
  }

  /**
   * 确保项目数据目录存在
   */
  static async ensureProjectDataDir(userDataDir: string): Promise<void> {
    try {
      // 检查父目录是否存在且可写
      const parentDir = path.dirname(userDataDir);
      await this.checkDirectoryPermissions(parentDir);

      // 创建会话数据目录
      await fs.promises.mkdir(userDataDir, { recursive: true });
      
      // 检查.gitignore并提示用户
      await this.checkAndPromptGitignore(parentDir);

      console.log(`📁 Project session directory created: ${userDataDir}`);
      
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        throw new Error(`Permission denied: Cannot create session directory at ${userDataDir}. Please check directory permissions.`);
      } else if (error.code === 'ENOSPC') {
        throw new Error(`No space left on device: Cannot create session directory at ${userDataDir}.`);
      } else {
        throw new Error(`Failed to create session directory: ${error.message}`);
      }
    }
  }

  /**
   * 验证项目路径的有效性
   */
  static validateProjectPath(projectPath: string): boolean {
    if (!projectPath || typeof projectPath !== 'string') {
      return false;
    }

    try {
      // 基本路径验证
      const normalizedPath = path.resolve(projectPath);
      
      // 检查路径是否为绝对路径
      if (!path.isAbsolute(normalizedPath)) {
        return false;
      }

      // 安全检查：防止路径遍历攻击
      if (normalizedPath.includes('..') || normalizedPath.includes('./')) {
        return false;
      }

      // 检查路径是否存在
      try {
        const stats = fs.statSync(normalizedPath);
        return stats.isDirectory();
      } catch {
        // 目录不存在也是有效的（可能会创建）
        return true;
      }

    } catch {
      return false;
    }
  }

  /**
   * 生成 .gitignore 提示信息
   */
  static getGitignoreHint(): string {
    return [
      '📌 Playwright MCP Notice:',
      `   Session data directory created at: ${this.SESSION_DIR_NAME}/`,
      '   Please add the following line to your .gitignore file:',
      '',
      `   ${this.SESSION_DIR_NAME}/`,
      '',
      '   This will prevent browser session data from being committed to your repository.',
    ].join('\n');
  }

  /**
   * 检查目录权限
   */
  private static async checkDirectoryPermissions(dirPath: string): Promise<void> {
    try {
      await fs.promises.access(dirPath, fs.constants.F_OK | fs.constants.W_OK);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Directory does not exist: ${dirPath}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied: Cannot write to directory ${dirPath}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * 检查并提示.gitignore配置
   */
  private static async checkAndPromptGitignore(projectDir: string): Promise<void> {
    try {
      const gitignorePath = path.join(projectDir, '.gitignore');
      
      // 检查.gitignore文件是否存在
      let gitignoreExists = false;
      let gitignoreContent = '';
      
      try {
        gitignoreContent = await fs.promises.readFile(gitignorePath, 'utf-8');
        gitignoreExists = true;
      } catch {
        // .gitignore文件不存在
      }

      // 检查是否已经包含忽略规则
      const hasIgnoreRule = gitignoreContent.includes(this.SESSION_DIR_NAME);
      
      if (!hasIgnoreRule) {
        // 输出提示信息
        console.log('');
        console.log(this.getGitignoreHint());
        console.log('');

        // 可选：自动添加到.gitignore（如果文件存在）
        if (gitignoreExists) {
          try {
            const newContent = gitignoreContent + 
              (gitignoreContent.endsWith('\n') ? '' : '\n') +
              '\n' + this.GITIGNORE_COMMENT + '\n' +
              this.SESSION_DIR_NAME + '/\n';
            
            await fs.promises.writeFile(gitignorePath, newContent);
            console.log(`✅ Automatically added ${this.SESSION_DIR_NAME}/ to .gitignore`);
          } catch (error) {
            console.log(`ℹ️  Could not automatically update .gitignore: ${error}`);
          }
        }
      }
    } catch (error) {
      // 忽略.gitignore检查错误，不影响主要功能
      console.debug('Could not check .gitignore file:', error);
    }
  }

  /**
   * 清理工具：列出所有项目会话目录
   */
  static async listProjectSessionDirs(): Promise<string[]> {
    // 这个功能可以在后续版本中实现
    // 用于帮助用户清理不再使用的项目会话数据
    return [];
  }

  /**
   * 清理工具：删除指定项目的会话数据
   */
  static async cleanupProjectSessionDir(projectPath: string): Promise<boolean> {
    try {
      const sessionDir = path.join(projectPath, this.SESSION_DIR_NAME);
      await fs.promises.rm(sessionDir, { recursive: true, force: true });
      console.log(`🗑️  Cleaned up session directory: ${sessionDir}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to cleanup session directory: ${error}`);
      return false;
    }
  }
} 