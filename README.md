## Playwright MCP Plus

A **enhanced** Model Context Protocol (MCP) server that provides browser automation capabilities using [Playwright](https://playwright.dev). 

### 🎯 **Key Innovation: Project-Level Session Isolation**

**⚡ The Problem We Solve:**
- Opening multiple project windows with regular Playwright MCP causes session conflicts
- Each new window overwrites the previous browser session
- **You lose all login states and have to re-authenticate every time** 
- No persistent sessions across different projects
- Testing automation constantly interrupted by re-login requirements

**🚀 Our Solution:**
**This enhanced version provides project-level session isolation** - each project gets its own persistent browser session that survives across window switches, restarts, and concurrent usage.

**✨ What This Means for You:**
- 🔄 **Never lose login states again** - each project maintains its own authenticated sessions
- 🪟 **Work on multiple projects simultaneously** - open 10 different project windows, each with its own browser state
- 🧪 **Automated testing without constant re-login** - your test suites run faster and more reliably
- 💾 **Sessions persist across IDE restarts** - close and reopen your project, sessions are still there
- 🎯 **Zero configuration required** - works out-of-the-box with sensible defaults

### 🚀 Enhanced Features (vs Official Playwright MCP)

This enhanced version maintains **100% backward compatibility** with the official Playwright MCP while adding powerful session isolation:

#### **🔒 Project Session Isolation**
- **🏗️ Automatic Project Detection**: Each project gets its own isolated browser session
- **💾 Persistent Login States**: Stay logged in across IDE restarts and window switches
- **🚪 No More Re-authentication**: Your automated tests and workflows run uninterrupted
- **📁 Clean Project Directories**: No session files cluttering your project folders (by default)
- **🌍 Cross-Platform Support**: Intelligent storage location selection for Windows, macOS, Linux

#### **🛠️ Multiple Storage Strategies**
- `system`: Store in OS cache directory (recommended, user-invisible)
- `project`: Store in project directory (legacy behavior)  
- `custom`: Store in custom location

#### **⚙️ Configuration Parameters**
- `--project-isolation`: Enable project-level session isolation (default: disabled)
- `--project-isolation-session-strategy`: Choose storage strategy (default: "system")
- `--project-isolation-session-root-dir`: Custom root directory for session storage

#### **✅ Advantages over Official Version**
- ✅ **100% Backward Compatible**: Drop-in replacement for official version
- ✅ **Multi-Project Workflow**: Work on multiple projects without session conflicts
- ✅ **Persistent Authentication**: Never lose login states between sessions
- ✅ **Test Automation Friendly**: Eliminates re-login overhead in automated tests
- ✅ **Clean Workspace**: No session files in project directories by default
- ✅ **Conflict-Free**: Uses official Playwright path structure to avoid conflicts
- ✅ **Zero Maintenance**: Automatic cleanup and management of session data

### Key Features

- **Fast and lightweight**. Uses Playwright's accessibility tree, not pixel-based input.
- **LLM-friendly**. No vision models needed, operates purely on structured data.
- **Deterministic tool application**. Avoids ambiguity common with screenshot-based approaches.
- **🆕 Project-level isolation**. Separate browser sessions per project with intelligent storage management.

### Requirements
- Node.js 18 or newer
- VS Code, Cursor, Windsurf, Claude Desktop, Goose or any other MCP client

<!--
// Generate using:
node utils/generate-links.js
-->

### Getting started

First, install the Playwright MCP server with your client.

**Standard config** (100% compatible with official Playwright MCP):

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@ai-coding-labs/playwright-mcp-plus@latest"
      ]
    }
  }
}
```

**Enhanced config** with project isolation (recommended):

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@ai-coding-labs/playwright-mcp-plus@latest",
        "--project-isolation"
      ]
    }
  }
}
```

**Advanced config** with custom session storage:

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx", 
      "args": [
        "-y",
        "@ai-coding-labs/playwright-mcp-plus@latest",
        "--project-isolation",
        "--project-isolation-session-strategy=custom",
        "--project-isolation-session-root-dir=/custom/session/path"
      ]
    }
  }
}
```

**💡 Pro Tip for Multi-Project Workflows:**

Once you enable `--project-isolation`, each of your projects will automatically get its own browser session. When you call any browser tool, simply include the project parameters:

```javascript
// Each project gets isolated sessions automatically
browser_navigate({
  url: "https://yourapp.com",
  projectDrive: "/",                    // For macOS/Linux: "/", For Windows: "C:"
  projectPath: "/path/to/your/project"  // Absolute path to your project directory
})
```

This ensures your login states, cookies, and browser data never interfere between different projects!

### 🎬 Real-World Usage Scenario

**Before (Official Playwright MCP):**
```bash
# Working on Project A - login to admin panel
browser_navigate("https://myapp-staging.com/admin")
# Login with credentials, do some testing...

# Switch to Project B window - session lost! 😱
browser_navigate("https://different-app.com/dashboard") 
# All Project A login states are gone, must login again

# Switch back to Project A - login lost again! 😱
# Must re-authenticate every single time
```

**After (With Project Isolation):**
```bash
# Project A window - gets its own isolated session
browser_navigate({
  url: "https://myapp-staging.com/admin",
  projectDrive: "/",
  projectPath: "/Users/you/projects/project-a"
})
# Login once, stays logged in forever ✨

# Project B window - completely separate session  
browser_navigate({
  url: "https://different-app.com/dashboard",
  projectDrive: "/", 
  projectPath: "/Users/you/projects/project-b"
})
# Login once, independent of Project A ✨

# Switch back to Project A - STILL LOGGED IN! 🎉
# Run automated tests without re-authentication
# Perfect for CI/CD pipelines and development workflows
```

**The Result:** Your automated tests run 10x faster, your development workflow is uninterrupted, and you can work on multiple projects simultaneously without losing authentication state.

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D)


<details>
<summary>Claude Code</summary>

Use the Claude Code CLI to add the enhanced Playwright MCP server:

**Standard version:**
```bash
claude mcp add playwright npx -y @ai-coding-labs/playwright-mcp-plus@latest
```

**With project isolation (recommended):**
```bash
claude mcp add playwright npx -y @ai-coding-labs/playwright-mcp-plus@latest --project-isolation
```
</details>

<details>
<summary>Claude Desktop</summary>

Follow the MCP install [guide](https://modelcontextprotocol.io/quickstart/user), use the standard config above.

</details>

<details>
<summary>Cursor</summary>

#### Click the button to install:

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=playwright&config=eyJjb21tYW5kIjoibnB4IEBwbGF5d3JpZ2h0L21jcEBsYXRlc3QifQ%3D%3D)

#### Or install manually:

Go to `Cursor Settings` -> `MCP` -> `Add new MCP Server`. Name to your liking, use `command` type with the command `npx -y @ai-coding-labs/playwright-mcp-plus --project-isolation`. You can also verify config or add command like arguments via clicking `Edit`.

</details>

<details>
<summary>Gemini CLI</summary>

Follow the MCP install [guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#configure-the-mcp-server-in-settingsjson), use the standard config above.

</details>

<details>
<summary>Goose</summary>

#### Click the button to install:

[![Install in Goose](https://block.github.io/goose/img/extension-install-dark.svg)](https://block.github.io/goose/extension?cmd=npx&arg=%40playwright%2Fmcp%40latest&id=playwright&name=Playwright&description=Interact%20with%20web%20pages%20through%20structured%20accessibility%20snapshots%20using%20Playwright)

#### Or install manually:

Go to `Advanced settings` -> `Extensions` -> `Add custom extension`. Name to your liking, use type `STDIO`, and set the `command` to `npx -y @ai-coding-labs/playwright-mcp-plus --project-isolation`. Click "Add Extension".
</details>

<details>
<summary>LM Studio</summary>

#### Click the button to install:

[![Add MCP Server playwright to LM Studio](https://files.lmstudio.ai/deeplink/mcp-install-light.svg)](https://lmstudio.ai/install-mcp?name=playwright&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyJAcGxheXdyaWdodC9tY3BAbGF0ZXN0Il19)

#### Or install manually:

Go to `Program` in the right sidebar -> `Install` -> `Edit mcp.json`. Use the standard config above.
</details>

<details>
<summary>Qodo Gen</summary>

Open [Qodo Gen](https://docs.qodo.ai/qodo-documentation/qodo-gen) chat panel in VSCode or IntelliJ → Connect more tools → + Add new MCP → Paste the standard config above.

Click <code>Save</code>.
</details>

<details>
<summary>VS Code</summary>

#### Click the button to install:

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540playwright%252Fmcp%2540latest%2522%255D%257D)

#### Or install manually:

Follow the MCP install [guide](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server), use the standard config above. You can also install the Playwright MCP server using the VS Code CLI:

```bash
# For VS Code
code --add-mcp '{"name":"playwright","command":"npx","args":["-y","@ai-coding-labs/playwright-mcp-plus@latest","--project-isolation"]}'
```

After installation, the Playwright MCP server will be available for use with your GitHub Copilot agent in VS Code.
</details>

<details>
<summary>Windsurf</summary>

Follow Windsurf MCP [documentation](https://docs.windsurf.com/windsurf/cascade/mcp). Use the standard config above.

</details>

### Configuration

Playwright MCP server supports following arguments. They can be provided in the JSON configuration above, as a part of the `"args"` list:

<!--- Options generated by update-readme.js -->

```
> npx @ai-coding-labs/playwright-mcp-plus@latest --help
  --allowed-origins <origins>                      semicolon-separated list of origins to allow the browser to request. Default is to allow all.
  --blocked-origins <origins>                      semicolon-separated list of origins to block the browser from requesting. Blocklist is evaluated before allowlist. If used without the allowlist, requests not matching the blocklist are still allowed.
  --block-service-workers                          block service workers
  --browser <browser>                              browser or chrome channel to use, possible values: chrome, firefox, webkit, msedge.
  --caps <caps>                                    comma-separated list of additional capabilities to enable, possible values: vision, pdf.
  --cdp-endpoint <endpoint>                        CDP endpoint to connect to.
  --config <path>                                  path to the configuration file.
  --device <device>                                device to emulate, for example: "iPhone 15"
  --executable-path <path>                         path to the browser executable.
  --headless                                       run browser in headless mode, headed by default
  --host <host>                                    host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.
  --ignore-https-errors                            ignore https errors
  --isolated                                       keep the browser profile in memory, do not save it to disk.
  --image-responses <mode>                         whether to send image responses to the client. Can be "allow" or "omit", Defaults to "allow".
  --no-sandbox                                     disable the sandbox for all process types that are normally sandboxed.
  --output-dir <path>                              path to the directory for output files.
  --port <port>                                    port to listen on for SSE transport.
  --project-isolation                              enable project-level session isolation using project path from MCP context.
  --project-isolation-session-strategy <strategy>  session directory strategy for project isolation: system, project, custom. Defaults to "system". (default: "system")
  --project-isolation-session-root-dir <path>      custom root directory for session storage when using project isolation (only used with --project-isolation-session-strategy=custom).
  --proxy-bypass <bypass>                          comma-separated domains to bypass proxy, for example ".com,chromium.org,.domain.com"
  --proxy-server <proxy>                           specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"
  --save-session                                   Whether to save the Playwright MCP session into the output directory.
  --save-trace                                     Whether to save the Playwright Trace of the session into the output directory.
  --storage-state <path>                           path to the storage state file for isolated sessions.
  --user-agent <ua string>                         specify user agent string
  --user-data-dir <path>                           path to the user data directory. If not specified, a temporary directory will be created.
  --viewport-size <size>                           specify browser viewport size in pixels, for example "1280, 720"
```

<!--- End of options generated section -->

### User profile

You can run Playwright MCP with persistent profile like a regular browser (default), or in the isolated contexts for the testing sessions.

**Persistent profile**

All the logged in information will be stored in the persistent profile, you can delete it between sessions if you'd like to clear the offline state.
Persistent profile is located at the following locations and you can override it with the `--user-data-dir` argument.

```bash
# Windows
%USERPROFILE%\AppData\Local\ms-playwright\mcp-{channel}-profile

# macOS
- ~/Library/Caches/ms-playwright/mcp-{channel}-profile

# Linux
- ~/.cache/ms-playwright/mcp-{channel}-profile
```

**Isolated**

In the isolated mode, each session is started in the isolated profile. Every time you ask MCP to close the browser,
the session is closed and all the storage state for this session is lost. You can provide initial storage state
to the browser via the config's `contextOptions` or via the `--storage-state` argument. Learn more about the storage
state [here](https://playwright.dev/docs/auth).

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@ai-coding-labs/playwright-mcp-plus@latest",
        "--isolated",
        "--storage-state={path/to/storage.json}"
      ]
    }
  }
}
```

### 🔒 Project Isolation (Enhanced Feature)

**Project Isolation** allows each project to maintain its own separate browser session with independent login states, cookies, and localStorage. This prevents cross-project interference while keeping your workspace clean.

#### **Default Behavior (Backward Compatible)**
Without any isolation flags, sessions are shared between all projects (identical to official Playwright MCP):

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@ai-coding-labs/playwright-mcp-plus@latest"]
    }
  }
}
```

#### **Recommended: System Strategy (Zero Config)**
Enable project isolation with sessions stored in OS cache directory (invisible to users):

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx", 
      "args": [
        "@ai-coding-labs/playwright-mcp-plus@latest",
        "--project-isolation"
      ]
    }
  }
}
```

**Storage locations by OS:**
- **Windows:** `%LOCALAPPDATA%/ms-playwright/mcp-chrome-profile/playwright-plus-mcp/project-hash/`
- **macOS:** `~/Library/Caches/ms-playwright/mcp-chrome-profile/playwright-plus-mcp/project-hash/`  
- **Linux:** `~/.cache/ms-playwright/mcp-chrome-profile/playwright-plus-mcp/project-hash/`

#### **Project Strategy**
Store sessions in project directory (creates `.user-session-data-directory/`):

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@ai-coding-labs/playwright-mcp-plus@latest", 
        "--project-isolation",
        "--project-isolation-session-strategy=project"
      ]
    }
  }
}
```

#### **Custom Strategy**
Store sessions in a custom location:

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@ai-coding-labs/playwright-mcp-plus@latest",
        "--project-isolation", 
        "--project-isolation-session-strategy=custom",
        "--project-isolation-session-root-dir=/custom/sessions"
      ]
    }
  }
}
```

#### **Strategy Comparison**

| Configuration | Session Location | Project Directory | User Visibility | Use Case |
|---------------|------------------|-------------------|-----------------|----------|
| **No isolation** (default) | Shared cache | Clean | Hidden | Backward compatibility |
| **System** (isolation default) | OS cache directory | Clean | Hidden | Best user experience |
| **Project** | `.user-session-data-directory/` | Has session files | Visible | Legacy/debugging |
| **Custom** | Custom path | Clean | Hidden | Advanced setups |

### Configuration file

The Playwright MCP server can be configured using a JSON configuration file. You can specify the configuration file
using the `--config` command line option:

```bash
npx @ai-coding-labs/playwright-mcp-plus@latest --config path/to/config.json
```

<details>
<summary>Configuration file schema</summary>

```typescript
{
  // Browser configuration
  browser?: {
    // Browser type to use (chromium, firefox, or webkit)
    browserName?: 'chromium' | 'firefox' | 'webkit';

    // Keep the browser profile in memory, do not save it to disk.
    isolated?: boolean;

    // Path to user data directory for browser profile persistence
    userDataDir?: string;

    // Browser launch options (see Playwright docs)
    // @see https://playwright.dev/docs/api/class-browsertype#browser-type-launch
    launchOptions?: {
      channel?: string;        // Browser channel (e.g. 'chrome')
      headless?: boolean;      // Run in headless mode
      executablePath?: string; // Path to browser executable
      // ... other Playwright launch options
    };

    // Browser context options
    // @see https://playwright.dev/docs/api/class-browser#browser-new-context
    contextOptions?: {
      viewport?: { width: number, height: number };
      // ... other Playwright context options
    };

    // CDP endpoint for connecting to existing browser
    cdpEndpoint?: string;

    // Remote Playwright server endpoint
    remoteEndpoint?: string;
  },

  // Server configuration
  server?: {
    port?: number;  // Port to listen on
    host?: string;  // Host to bind to (default: localhost)
  },

  // List of additional capabilities
  capabilities?: Array<
    'tabs' |    // Tab management
    'install' | // Browser installation
    'pdf' |     // PDF generation
    'vision' |  // Coordinate-based interactions
  >;

  // Directory for output files
  outputDir?: string;

  // Network configuration
  network?: {
    // List of origins to allow the browser to request. Default is to allow all. Origins matching both `allowedOrigins` and `blockedOrigins` will be blocked.
    allowedOrigins?: string[];

    // List of origins to block the browser to request. Origins matching both `allowedOrigins` and `blockedOrigins` will be blocked.
    blockedOrigins?: string[];
  };
 
  /**
   * Whether to send image responses to the client. Can be "allow" or "omit". 
   * Defaults to "allow".
   */
  imageResponses?: 'allow' | 'omit';

  /**
   * Enable project-level session isolation using project path from MCP context.
   * When enabled, each project gets its own isolated browser session.
   * Defaults to false (shared sessions, compatible with official Playwright MCP).
   */
  projectIsolation?: boolean;

  /**
   * Session directory storage strategy for project isolation.
   * Only used when projectIsolation is enabled.
   * - 'system': Store in OS cache directory (recommended, user-invisible)
   * - 'project': Store in project directory (legacy behavior)
   * - 'custom': Store in custom location specified by projectIsolationSessionRootDir
   * Defaults to "system".
   */
  projectIsolationSessionStrategy?: 'system' | 'project' | 'custom';

  /**
   * Custom root directory for session storage when using project isolation.
   * Only used when projectIsolationSessionStrategy is 'custom'.
   * Example: "/custom/session/storage/path"
   */
  projectIsolationSessionRootDir?: string;
}
```
</details>

### Standalone MCP server

When running headed browser on system w/o display or from worker processes of the IDEs,
run the MCP server from environment with the DISPLAY and pass the `--port` flag to enable HTTP transport.

```bash
npx @ai-coding-labs/playwright-mcp-plus@latest --port 8931
```

And then in MCP client config, set the `url` to the HTTP endpoint:

```js
{
  "mcpServers": {
    "playwright": {
      "url": "http://localhost:8931/mcp"
    }
  }
}
```

<details>
<summary><b>Docker</b></summary>

**NOTE:** The Docker implementation only supports headless chromium at the moment.

```js
{
  "mcpServers": {
    "playwright": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "--pull=always", "mcr.microsoft.com/playwright/mcp"]
    }
  }
}
```

You can build the Docker image yourself.

```
docker build -t mcr.microsoft.com/playwright/mcp .
```
</details>

<details>
<summary><b>Programmatic usage</b></summary>

```js
import http from 'http';

import { createConnection } from '@ai-coding-labs/playwright-mcp-plus';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

http.createServer(async (req, res) => {
  // ...

  // Creates a headless Playwright MCP server with SSE transport
  const connection = await createConnection({ browser: { launchOptions: { headless: true } } });
  const transport = new SSEServerTransport('/messages', res);
  await connection.sever.connect(transport);

  // ...
});
```
</details>

### Tools

<!--- Tools generated by update-readme.js -->

<details>
<summary><b>Core automation</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_click**
  - Title: Click
  - Description: Perform click on a web page
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot
    - `doubleClick` (boolean, optional): Whether to perform a double click instead of a single click
    - `button` (string, optional): Button to click, defaults to left
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_close**
  - Title: Close browser
  - Description: Close the page
  - Parameters:
    - `projectDrive` (string, optional): Project drive letter or root (e.g., "C:", "/") for session isolation
    - `projectPath` (string, optional): Absolute path to project root directory for session isolation
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_console_messages**
  - Title: Get console messages
  - Description: Returns all console messages
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_drag**
  - Title: Drag mouse
  - Description: Perform drag and drop between two elements
  - Parameters:
    - `startElement` (string): Human-readable source element description used to obtain the permission to interact with the element
    - `startRef` (string): Exact source element reference from the page snapshot
    - `endElement` (string): Human-readable target element description used to obtain the permission to interact with the element
    - `endRef` (string): Exact target element reference from the page snapshot
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_evaluate**
  - Title: Evaluate JavaScript
  - Description: Evaluate JavaScript expression on page or element
  - Parameters:
    - `function` (string): () => { /* code */ } or (element) => { /* code */ } when element is provided
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string, optional): Exact target element reference from the page snapshot
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_file_upload**
  - Title: Upload files
  - Description: Upload one or multiple files
  - Parameters:
    - `paths` (array): The absolute paths to the files to upload. Can be a single file or multiple files.
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_handle_dialog**
  - Title: Handle a dialog
  - Description: Handle a dialog
  - Parameters:
    - `accept` (boolean): Whether to accept the dialog.
    - `promptText` (string, optional): The text of the prompt in case of a prompt dialog.
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_hover**
  - Title: Hover mouse
  - Description: Hover over element on page
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate**
  - Title: Navigate to a URL
  - Description: Navigate to a URL
  - Parameters:
    - `url` (string): The URL to navigate to
    - `projectDrive` (string, optional): Project drive letter or root (e.g., "C:", "/") for session isolation
    - `projectPath` (string, optional): Absolute path to project root directory for session isolation
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate_back**
  - Title: Go back
  - Description: Go back to the previous page
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate_forward**
  - Title: Go forward
  - Description: Go forward to the next page
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_network_requests**
  - Title: List network requests
  - Description: Returns all network requests since loading the page
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_press_key**
  - Title: Press a key
  - Description: Press a key on the keyboard
  - Parameters:
    - `key` (string): Name of the key to press or a character to generate, such as `ArrowLeft` or `a`
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_resize**
  - Title: Resize browser window
  - Description: Resize the browser window
  - Parameters:
    - `width` (number): Width of the browser window
    - `height` (number): Height of the browser window
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_select_option**
  - Title: Select option
  - Description: Select an option in a dropdown
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot
    - `values` (array): Array of values to select in the dropdown. This can be a single value or multiple values.
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_snapshot**
  - Title: Page snapshot
  - Description: Capture accessibility snapshot of the current page, this is better than screenshot
  - Parameters:
    - `projectDrive` (string, optional): Project drive letter or root (e.g., "C:", "/") for session isolation
    - `projectPath` (string, optional): Absolute path to project root directory for session isolation
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_take_screenshot**
  - Title: Take a screenshot
  - Description: Take a screenshot of the current page. You can't perform actions based on the screenshot, use browser_snapshot for actions.
  - Parameters:
    - `type` (string, optional): Image format for the screenshot. Default is png.
    - `filename` (string, optional): File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified.
    - `element` (string, optional): Human-readable element description used to obtain permission to screenshot the element. If not provided, the screenshot will be taken of viewport. If element is provided, ref must be provided too.
    - `ref` (string, optional): Exact target element reference from the page snapshot. If not provided, the screenshot will be taken of viewport. If ref is provided, element must be provided too.
    - `fullPage` (boolean, optional): When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_type**
  - Title: Type text
  - Description: Type text into editable element
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot
    - `text` (string): Text to type into the element
    - `submit` (boolean, optional): Whether to submit entered text (press Enter after)
    - `slowly` (boolean, optional): Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_wait_for**
  - Title: Wait for
  - Description: Wait for text to appear or disappear or a specified time to pass
  - Parameters:
    - `time` (number, optional): The time to wait in seconds
    - `text` (string, optional): The text to wait for
    - `textGone` (string, optional): The text to wait for to disappear
    - `projectDrive` (string, optional): Project drive letter or root (e.g., "C:", "/") for session isolation
    - `projectPath` (string, optional): Absolute path to project root directory for session isolation
  - Read-only: **true**

</details>

<details>
<summary><b>Tab management</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_close**
  - Title: Close a tab
  - Description: Close a tab
  - Parameters:
    - `index` (number, optional): The index of the tab to close. Closes current tab if not provided.
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_list**
  - Title: List tabs
  - Description: List browser tabs
  - Parameters:
    - `projectDrive` (string, optional): Project drive letter or root (e.g., "C:", "/") for session isolation
    - `projectPath` (string, optional): Absolute path to project root directory for session isolation
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_new**
  - Title: Open a new tab
  - Description: Open a new tab
  - Parameters:
    - `url` (string, optional): The URL to navigate to in the new tab. If not provided, the new tab will be blank.
    - `projectDrive` (string, optional): Project drive letter or root (e.g., "C:", "/") for session isolation
    - `projectPath` (string, optional): Absolute path to project root directory for session isolation
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_select**
  - Title: Select a tab
  - Description: Select a tab by index
  - Parameters:
    - `index` (number): The index of the tab to select
  - Read-only: **true**

</details>

<details>
<summary><b>Browser installation</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_install**
  - Title: Install the browser specified in the config
  - Description: Install the browser specified in the config. Call this if you get an error about the browser not being installed.
  - Parameters:
    - `projectDrive` (string, optional): Project drive letter or root (e.g., "C:", "/") for session isolation
    - `projectPath` (string, optional): Absolute path to project root directory for session isolation
  - Read-only: **false**

</details>

<details>
<summary><b>Coordinate-based (opt-in via --caps=vision)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_click_xy**
  - Title: Click
  - Description: Click left mouse button at a given position
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `x` (number): X coordinate
    - `y` (number): Y coordinate
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_drag_xy**
  - Title: Drag mouse
  - Description: Drag left mouse button to a given position
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `startX` (number): Start X coordinate
    - `startY` (number): Start Y coordinate
    - `endX` (number): End X coordinate
    - `endY` (number): End Y coordinate
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_move_xy**
  - Title: Move mouse
  - Description: Move mouse to a given position
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `x` (number): X coordinate
    - `y` (number): Y coordinate
  - Read-only: **true**

</details>

<details>
<summary><b>PDF generation (opt-in via --caps=pdf)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_pdf_save**
  - Title: Save as PDF
  - Description: Save page as PDF
  - Parameters:
    - `filename` (string, optional): File name to save the pdf to. Defaults to `page-{timestamp}.pdf` if not specified.
  - Read-only: **true**

</details>


<!--- End of tools generated section -->
