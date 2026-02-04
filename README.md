# Figma Designer MCP Server

A specialized Model Context Protocol (MCP) server that bridges the gap between Figma designs and AI-assisted development. It exposes Figma design data (pages, components, styles, and implementation plans) to AI agents in an LLM-optimized format.

## Features

- 🎨 **Figma Integration**: Deep access to Figma files using the official Figma API.
- 📐 **Page & Component Mapping**: Extract high-level file structure and detailed component hierarchies.
- 🪙 **Design Token Extraction**: Automatically identify colors, typography, spacing, and other tokens.
- 📑 **Implementation Planning**: Generate framework-agnostic architectural plans and layout strategies.
- 📚 **Self-Documenting**: Includes a built-in `getDocumentation` tool that teaches the AI agent how to interpret and use the design data correctly.
- 🚀 **Production Ready**: Built with Fastify, TypeScript, and pre-compiled JSON schemas for high performance.
- 💾 **Intelligent Caching**: Built-in cache manager to reduce API calls and improve responsiveness.

## Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd figma-mcp-server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build the project

```bash
npm run build
```

## Configuration

### Getting a Figma Token

To use this server, you need a Figma Personal Access Token:

1. Log in to your [Figma account](https://www.figma.com/).
2. Go to **Settings** (top left menu > Settings).
3. Scroll down to the **Personal access tokens** section.
4. Generate a new token and copy it immediately.

### Setup Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Open `.env` and add your token:

```dotenv
FIGMA_ACCESS_TOKEN=figd_your_token_here
PORT=5000
```

## Usage

### Connecting to an Agent (VS Code / Claude / Cursor)

Run the included setup script to get your specific registration JSON:

```bash
bash setup-production.sh
```

Copy the resulting JSON block into your IDE's MCP settings. The server will automatically load the token from your `.env` file, so the configuration stays clean and secure.

### Available Tools

| Tool                    | Description                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| `getDocumentation`      | **Call this first.** Provides rules and formatting guidelines for the agent. |
| `getFigmaPageOverview`  | Lists all pages and high-level node counts in a file.                        |
| `getComponentMap`       | Returns a flattened list of components with parent/child relationships.      |
| `getDesignTokens`       | Extracts systematic style values (colors, typography, spacing).              |
| `getImplementationPlan` | Generates step-by-step guidance and component-to-code mappings.              |

---

## Development Workflow

### Run in Dev Mode (Auto-reload)

```bash
npm run dev
```

### Testing the Server

You can use the built-in test script to verify connectivity with a specific Figma file:

```bash
bash test_script.sh
```

## License

ISC
