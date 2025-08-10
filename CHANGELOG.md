# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.39] - 2025-01-10

### Enhanced
- **🏠 Session-Level Extension Isolation**: Complete redesign of Chrome extension storage to follow project isolation principles
  - **Session-Based Storage**: Extensions now stored in `<session-dir>/extensions/` instead of global `~/.mcp-extensions/`
  - **Session-Specific Registry**: Each session maintains its own extension registry
  - **Project Isolation Parameters**: All extension tools now accept `projectDrive` and `projectPath` parameters
  - **Data Consistency**: Extension data stored alongside browser session data for logical grouping
  - **Easy Cleanup**: Deleting a session directory removes all associated extensions automatically
- **🔄 Backward Compatibility**: Global extension storage maintained when project isolation is not used
- **📁 Improved User Experience**: Clear messaging about session vs global extension storage

### Technical Details
- Modified `getMcpExtensionsDir()`, `getExtensionsRegistryPath()`, and related functions to support session directories
- Updated all extension management tools (`browser_extension_install`, `browser_extension_list`, `browser_extension_uninstall`) with project isolation parameters
- Enhanced browser context factories to pass session directory information to extension loading
- Maintained full backward compatibility for non-project-isolated usage

## [0.0.38] - 2025-01-10

### Fixed
- **🐛 Chrome Extension Loading Bug**: Fixed critical bug where configuration file `--load-extension` arguments were being overridden by MCP extension management
  - **Root Cause**: Multiple `--load-extension` arguments caused Chrome to only use the last one, ignoring config file extensions
  - **Solution**: Enhanced `enhanceLaunchOptionsWithExtensions` function to merge existing and MCP-managed extension paths into a single argument
  - **Impact**: Configuration file extensions now load correctly alongside MCP-managed extensions
- **🔧 Extension Path Deduplication**: Added automatic deduplication of extension paths to prevent conflicts
- **📝 Enhanced Debug Logging**: Added detailed debug logs for extension loading process to aid troubleshooting

### Technical Details
- Modified `src/browserContextFactory.ts` and `src/enhancedBrowserContextFactory.ts`
- Extension paths from config files are now extracted, merged with MCP paths, deduplicated, and combined into single Chrome arguments
- Improved error handling and validation for extension path processing

## [0.0.37] - 2025-01-08

### Added
- **🧩 Chrome Extension Management**: Complete Chrome extension management system
  - `browser_extension_install`: Install Chrome extensions from Chrome Web Store URLs or extension IDs
  - `browser_extension_uninstall`: Uninstall Chrome extensions with automatic cleanup
  - `browser_extension_list`: List all MCP-managed Chrome extensions
- **🔄 Automatic Browser Restart**: Extensions become available immediately after installation/uninstallation
- **🏠 Local Extension Registry**: Extensions stored in `~/.mcp-extensions/` with automatic management
- **📋 Extension Metadata**: Automatic extraction of extension name, version, and details from manifest
- **🚀 One-Click Installation**: Install extensions directly from Chrome Web Store with automatic restart

### Enhanced
- **Project Session Isolation**: Chrome extensions are automatically loaded for all project sessions
- **Launch Arguments**: Automatic generation of `--load-extension` and `--disable-extensions-except` Chrome arguments
- **Documentation**: Updated README with comprehensive Chrome extension management examples and usage

### Technical Details
- Extensions are downloaded as CRX files and extracted locally
- Registry maintained in JSON format for persistence across sessions
- Automatic cleanup of extension files on uninstallation
- Support for both extension ID and Chrome Web Store URL installation methods
- Robust error handling and validation for extension operations

## [0.0.36] - Previous Release

### Features
- Enhanced Playwright MCP server with project-level session isolation
- Concurrent browser automation support
- Multiple storage strategies (system, project, custom)
- 100% backward compatibility with official Playwright MCP
- Cross-platform support for Windows, macOS, and Linux
