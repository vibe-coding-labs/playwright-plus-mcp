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

import { SessionDirectoryManager, type SessionDirectoryOptions, type SessionDirectoryStrategy } from './sessionDirectoryManager.js';
import { ProjectIsolationManager, type ProjectInfo, validateProjectIsolationParams } from './projectIsolation.js';
import type { Config } from '../config.js';

/**
 * 增强的项目隔离配置
 */
export interface EnhancedProjectIsolationConfig {
  /** 是否启用项目隔离 */
  enabled: boolean;
  /** 会话目录策略 */
  strategy: SessionDirectoryStrategy;
  /** 项目信息 */
  projectInfo?: ProjectInfo;
  /** 自定义根目录（strategy为'custom'时使用） */
  customRootDir?: string;
}

/**
 * 增强的项目隔离管理器
 * 集成新的SessionDirectoryManager和现有的ProjectIsolationManager
 * 保持向后兼容性，同时提供扩展功能
 */
export class EnhancedProjectIsolationManager {
  /**
   * 从配置和MCP工具参数创建用户数据目录
   */
  static async createUserDataDir(
    config: Config,
    toolParams?: { projectDrive?: string; projectPath?: string }
  ): Promise<string | undefined> {
    // 如果没有启用项目隔离，使用默认行为
    if (!config.projectIsolation) {
      return undefined;
    }

    // 获取项目信息
    const projectInfo = this.extractProjectInfo(toolParams);
    if (!projectInfo || !validateProjectIsolationParams(projectInfo)) {
      throw new Error('Project isolation is enabled but required parameters are missing. Please provide both projectDrive and projectPath parameters.');
    }

    // 获取会话策略（默认为'system'，用户无感知）
    const strategy = config.projectIsolationSessionStrategy || 'system';
    
    try {
      // 使用新的SessionDirectoryManager
      const sessionOptions: SessionDirectoryOptions = {
        strategy,
        projectDrive: projectInfo.projectDrive,
        projectPath: projectInfo.projectPath,
        customRootDir: config.projectIsolationSessionRootDir,
        browserName: config.browser?.browserName,
        browserChannel: config.browser?.launchOptions?.channel,
      };

      // 验证配置
      const validation = SessionDirectoryManager.validateOptions(sessionOptions);
      if (!validation.valid) {
        console.error(`❌ Invalid session directory configuration: ${validation.error}`);
        return undefined;
      }

      const userDataDir = SessionDirectoryManager.createUserDataDir(sessionOptions);
      
      if (userDataDir) {
        // 如果是项目策略，使用原有的ProjectIsolationManager来处理.gitignore等
        if (strategy === 'project') {
          await ProjectIsolationManager.ensureProjectDataDir(userDataDir);
        }
        
        console.log(`✅ Created session directory (${strategy} strategy): ${userDataDir}`);
        
        // 可选：清理旧的会话数据
        if (strategy !== 'project') {
          SessionDirectoryManager.cleanupOldSessions(userDataDir);
        }
      }

      return userDataDir;
    } catch (error) {
      console.error('❌ Failed to create enhanced user data directory:', error);
      
      // 降级到原有的ProjectIsolationManager作为备选
      console.log('🔄 Falling back to original project isolation...');
      return ProjectIsolationManager.createUserDataDir(projectInfo);
    }
  }

  /**
   * 从MCP工具参数提取项目信息
   */
  private static extractProjectInfo(toolParams?: { projectDrive?: string; projectPath?: string }): ProjectInfo | undefined {
    if (!toolParams?.projectDrive || !toolParams?.projectPath) {
      return undefined;
    }

    return {
      projectDrive: toolParams.projectDrive,
      projectPath: toolParams.projectPath,
    };
  }

  /**
   * 获取会话目录信息（用于调试和管理）
   */
  static getSessionDirectoryInfo(
    config: Config,
    toolParams?: { projectDrive?: string; projectPath?: string }
  ): {
    enabled: boolean;
    strategy?: SessionDirectoryStrategy;
    expectedPath?: string;
    fallbackPath?: string;
  } {
    const info = {
      enabled: !!config.projectIsolation,
      strategy: config.projectIsolationSessionStrategy || 'system' as SessionDirectoryStrategy,
      expectedPath: undefined as string | undefined,
      fallbackPath: undefined as string | undefined,
    };

    if (!info.enabled) {
      return info;
    }

    const projectInfo = this.extractProjectInfo(toolParams);
    if (projectInfo) {
      // 计算预期路径
      const sessionOptions: SessionDirectoryOptions = {
        strategy: info.strategy,
        projectDrive: projectInfo.projectDrive,
        projectPath: projectInfo.projectPath,
        customRootDir: config.projectIsolationSessionRootDir,
        browserName: config.browser?.browserName,
        browserChannel: config.browser?.launchOptions?.channel,
      };

      try {
        info.expectedPath = SessionDirectoryManager.createUserDataDir(sessionOptions);
      } catch {
        // 忽略错误
      }

      // 计算降级路径
      try {
        info.fallbackPath = ProjectIsolationManager.createUserDataDir(projectInfo);
      } catch {
        // 忽略错误
      }
    }

    return info;
  }

  /**
   * 迁移现有的项目会话目录到新策略
   * 这是一个可选的工具函数，用于帮助用户迁移数据
   */
  static async migrateSessionDirectory(
    fromStrategy: SessionDirectoryStrategy,
    toStrategy: SessionDirectoryStrategy,
    projectInfo: ProjectInfo,
    customRootDir?: string
  ): Promise<{ success: boolean; fromPath?: string; toPath?: string; error?: string }> {
    try {
      // 计算源路径
      const fromOptions: SessionDirectoryOptions = {
        strategy: fromStrategy,
        projectDrive: projectInfo.projectDrive,
        projectPath: projectInfo.projectPath,
        customRootDir,
      };
      
      // 计算目标路径
      const toOptions: SessionDirectoryOptions = {
        strategy: toStrategy,
        projectDrive: projectInfo.projectDrive,
        projectPath: projectInfo.projectPath,
        customRootDir,
      };

      const fromPath = SessionDirectoryManager.createUserDataDir(fromOptions);
      const toPath = SessionDirectoryManager.createUserDataDir(toOptions);

      if (!fromPath || !toPath) {
        return {
          success: false,
          error: 'Failed to calculate migration paths',
        };
      }

      if (fromPath === toPath) {
        return {
          success: true,
          fromPath,
          toPath,
        };
      }

      // 这里可以实现实际的迁移逻辑
      // 目前只是返回路径信息，实际迁移需要更复杂的逻辑
      console.log(`Migration would move from: ${fromPath}`);
      console.log(`Migration would move to: ${toPath}`);

      return {
        success: true,
        fromPath,
        toPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 获取所有策略的可能路径（用于调试）
   */
  static getAllPossiblePaths(
    projectInfo: ProjectInfo,
    customRootDir?: string
  ): Record<SessionDirectoryStrategy, string | undefined> {
    const strategies: SessionDirectoryStrategy[] = ['system', 'project', 'custom'];
    const paths: Record<SessionDirectoryStrategy, string | undefined> = {} as any;

    for (const strategy of strategies) {
      try {
        const options: SessionDirectoryOptions = {
          strategy,
          projectDrive: projectInfo.projectDrive,
          projectPath: projectInfo.projectPath,
          customRootDir,
        };
        paths[strategy] = SessionDirectoryManager.createUserDataDir(options);
      } catch {
        paths[strategy] = undefined;
      }
    }

    return paths;
  }
} 