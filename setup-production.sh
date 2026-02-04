#!/bash
# Figma MCP Server Production Setup Script

echo "--- Figma MCP Server Production Setup ---"

# 1. Install & Build
echo "[1/3] Installing dependencies and building..."
npm install && npm run build

# 2. Check Environment
if [ ! -f .env ]; then
    echo "Creating .env from example..."
    cp .env.example .env
fi

# Load .env
source .env

if [ -z "$FIGMA_ACCESS_TOKEN" ] || [[ "$FIGMA_ACCESS_TOKEN" == *"YOUR_PERSONAL_ACCESS_TOKEN"* ]]; then
    echo "!!! WARNING: FIGMA_ACCESS_TOKEN is not set in .env !!!"
    echo "Please edit the .env file and add your Figma Personal Access Token."
else
    echo "FIGMA_ACCESS_TOKEN found."
fi

# 3. Registration Info
SERVER_PATH=$(pwd)/dist/index.js

# Detect OS and format path
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Convert /e/path/to/project to E:\\path\\to\\project (escaped for JSON)
    DRIVE_LETTER=$(echo $SERVER_PATH | cut -d'/' -f2 | tr '[:lower:]' '[:upper:]')
    REMAINING_PATH=$(echo $SERVER_PATH | cut -d'/' -f3-)
    SERVER_PATH_CLEAN="${DRIVE_LETTER}:\\\\${REMAINING_PATH//\//\\\\}"
else
    SERVER_PATH_CLEAN=$SERVER_PATH
fi

echo ""
echo "[3/3] REGISTRATION INFORMATION"
echo "To use this server with an MCP-capable agent (Claude Desktop, Cursor, VS Code), add this to your config:"
echo ""
echo "----------------------------------------------------------------"
echo "{"
echo "  \"mcpServers\": {"
echo "    \"figma-designer\": {"
echo "      \"command\": \"node\","
echo "      \"args\": [\"$SERVER_PATH_CLEAN\"],"
echo "      \"env\": {"
echo "        \"FIGMA_ACCESS_TOKEN\": \"$FIGMA_ACCESS_TOKEN\","
echo "        \"PORT\": \"5000\""
echo "      }"
echo "    }"
echo "  }"
echo "}"
echo "----------------------------------------------------------------"
echo ""
echo "Note: If you change your token later, just update it in your agent's config or the .env file."
echo "Workflow: Open any new project, and the agent will automatically see these figma-designer tools."
echo ""
echo "Setup Complete!"
