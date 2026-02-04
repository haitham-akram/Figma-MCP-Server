# GitHub Copilot Instructions: Figma MCP Server Usage

## Overview

This MCP server provides structured access to Figma design data for AI-assisted development. It extracts design information in an LLM-optimized format to enable accurate code implementation based on Figma designs.

## Available Tools

### 1. `getDocumentation`

**Purpose:** Get comprehensive usage instructions for all Figma MCP tools.

**When to use:**

- When you need guidance on using other tools
- Understanding response formats and best practices
- First tool to call if unsure about MCP functionality

### 2. `getFigmaPageOverview`

**Purpose:** Get high-level file structure before detailed queries.

**Output Structure:**

```typescript
{
  pages: Array<{
    id: string // Page node ID
    name: string // Page name
    nodeCount: number // Top-level node count
    dimensions: { width; height }
    backgroundColor?: Color
  }>
  totalCount: number // Total pages in file
  limit: number
  offset: number
}
```

**When to use:**

- First step when exploring unknown Figma files
- Understanding file organization before component/token extraction
- Determining which pages to focus implementation efforts on

### 2. `getComponentMap`

**Purpose:** Get flattened component hierarchy with relationships.

**Output Structure:**

```typescript
{
  components: Array<{
    id: string // Component node ID
    name: string // Component name
    description?: string // Component description
    type: 'COMPONENT' | 'COMPONENT_SET' | 'INSTANCE'
    parentId?: string // Parent component ID (for hierarchy)
    childrenIds: string[] // Child component IDs
    variants?: Array<{
      // For component variants
      propertyName: string // e.g., "Size", "State"
      propertyValue: string // e.g., "Large", "Hover"
    }>
    dimensions: { width; height }
  }>
  totalCount: number
  limit: number
  offset: number
}
```

**When to use:**

- Understanding component structure and organization
- Identifying component variants and properties
- Mapping Figma components to code components
- Building component dependency graphs

**Key principles:**

- Components are flat with `parentId` references (not nested)
- Use `parentId`/`childrenIds` to reconstruct hierarchy as needed
- `COMPONENT_SET` = variant container, `COMPONENT` = single variant or standalone
- `INSTANCE` = component usage (less relevant for implementation planning)

### 3. `getDesignTokens`

**Purpose:** Extract reusable design values (colors, typography, spacing, etc.).

**Output Structure:**

```typescript
{
  tokens: Array<{
    name: string // Token name (e.g., "primary-500", "heading-1")
    category: 'color' | 'typography' | 'spacing' | 'borderRadius' | 'shadow' | 'opacity' | 'other'
    value: TokenValue // Type varies by category (see below)
    description?: string // Token description
    usage?: string // Usage guidance
  }>
  totalCount: number
  limit: number
  offset: number
}
```

**Token Value Types:**

- `color`: `{ r: number, g: number, b: number, a: number }` (0-1 range)
- `typography`: `{ fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textAlign? }`
- `spacing`: `number` (pixels)
- `borderRadius`: `number` (pixels)
- `shadow`: `{ offsetX, offsetY, blur, spread, color }`
- `opacity`: `number` (0-1 range)

**When to use:**

- Before implementing styling to identify available design tokens
- Setting up design system constants/variables
- Understanding design consistency and reusable values

**Key principles:**

- Use tokens to maintain design consistency
- Tokens represent extracted values from Figma styles and common patterns
- Not all design values will be tokenized (only reusable/systematic ones)

### 4. `getComponentStyles`

**Purpose:** Get detailed styling information for a specific component/frame including all visual properties, colors, fonts, images, and effects.

**Output Structure:**

```typescript
{
  componentId: string
  componentName: string
  componentType: string
  styles: {
    id: string
    name: string
    type: string
    dimensions?: { width, height, x, y }
    backgroundColor?: string  // hex color
    fills?: Array<{
      type: string
      color?: string          // hex color
      opacity?: number
      visible?: boolean
      imageUrl?: string       // for IMAGE fills
    }>
    strokes?: Array<{
      type: string
      color?: string          // hex color
      opacity?: number
    }>
    strokeWeight?: number
    cornerRadius?: number
    text?: {                  // for TEXT nodes
      content: string
      fontFamily: string
      fontWeight: number
      fontSize: number
      lineHeight: string
      letterSpacing: number
      textAlign: string
      textColor: string       // hex color
      mixedStyles?: Array<{   // MIXED FONT STYLES IN SAME TEXT
        startIndex: number
        endIndex: number
        fontFamily?: string
        fontWeight?: number
        fontSize?: number
        color?: string
      }>
    }
    vector?: {                // for vector/icon elements
      isVector: boolean
      vectorType: string
      hasExportSettings: boolean
    }
    effects?: Array<{         // shadows, blurs
      type: string
      radius: number
      color?: string
      offset?: { x, y }
    }>
    layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL'
    padding?: { top, right, bottom, left }
    itemSpacing?: number
    opacity?: number
    children?: ElementStyle[] // recursive child styles
  }
  images: Array<{
    nodeId: string
    nodeName: string
    imageRef?: string          // Figma image reference ID
    imageUrl: string            // URL or reference string
  }>
  vectors: Array<{             // ALL vector elements (icons, shapes)
    nodeId: string
    nodeName: string
    vectorType: string          // VECTOR, STAR, LINE, ELLIPSE, etc.
    canExport: boolean
  }>
  colors: Array<{
    value: string             // hex color
    usage: string             // "fill", "stroke", "text", "shadow"
    count: number
  }>
  fonts: Array<{
    family: string
    weight: number
    size: number
    usage: string             // "heading-1", "body", etc.
  }>
}
```

**When to use:**

- When you need exact visual details for a component
- To understand all colors, fonts, spacing used in a specific element
- Before implementing visual styling in code
- To identify images and icons that need to be extracted
- **To detect mixed font styles** (e.g., bold words in normal text)
- **To find all vector elements** that can be exported as SVG icons

**Key principles:**

- Call this AFTER identifying components with getFrameMap/getComponentMap
- Use the extracted color palette to create CSS variables
- Font information includes family, size, weight for accurate implementation
- **mixedStyles** array shows different font weights/sizes within the same text
- **vectors** array lists all icon/shape elements that should be exported
- Image detection helps identify assets that need to be exported from Figma
- **Dimensions include x, y position** for accurate placement

### 5. `getImplementationPlan`

**Purpose:** Get comprehensive implementation guidance with component-to-code mappings.

**Output Structure:**

```typescript
{
  steps: Array<{
    stepNumber: number
    title: string
    description: string
    relatedComponents?: string[]  // Component IDs
    relatedTokens?: string[]      // Token names
    codeExample?: string
  }>

  componentMappings: Array<{
    componentId: string
    componentName: string         // Figma component name
    suggestedCodeName: string     // Suggested code component name
    suggestedFilePath: string     // Suggested file path
    layoutStrategy: {
      type: 'flexbox' | 'grid' | 'absolute' | 'none'
      reasoning: string
      details?: object
    }
    stylingApproach: {
      recommendations: string[]
      tokenUsage: string[]        // Which tokens to use
      complexityNotes?: string
    }
    visualStyles?: {              // DETAILED VISUAL INFO
      colors: string[]            // All hex colors used
      fonts: Array<{              // All fonts used
        family: string
        size: number
        weight: number
      }>
      spacing: {
        padding?: string
        gap?: number
      }
      borders: {
        width?: number
        radius?: number
        color?: string
      }
      shadows: string[]           // CSS shadow strings
      hasImages: boolean
      hasVectors: boolean         // Has icons/shapes
      dimensions?: { width, height }
      position?: { x, y }         // Absolute position
    }
    complexityScore: number       // 0-10 (higher = more complex)
    props: Array<{
      name: string
      type: string
      description?: string
      required: boolean
    }>
    relatedTokens: string[]
    notes?: string
  }>

  layoutGuidance: {
    primaryStrategy: string
    patterns: Array<{
      pattern: string
      occurrences: number
      recommendation: string
    }>
    notes: string[]
  }

  stylingGuidance: {
    tokenCoverage: {
      colors: number
      typography: number
      spacing: number
    }
    recommendations: string[]
    considerations: string[]
  }

  openQuestions: Array<{
    question: string
    context: string
    relatedComponents?: string[]
  }>

  risks: Array<{
    severity: 'low' | 'medium' | 'high'
    risk: string
    impact: string
    mitigation: string
  }>

  notes?: string
}
```

**When to use:**

- Planning implementation before writing code
- Understanding layout strategies and complexity
- Identifying component props and relationships
- Getting framework-specific guidance (via `targetFramework` parameter)
- NOW includes detailed visualStyles for each component (colors, fonts, spacing, borders, shadows)

**Key principles:**

- Use as planning tool, not code generator
- `componentMappings` provide implementation guidance with visual details
- `visualStyles` field now contains exact colors, fonts, and spacing for styling
- `openQuestions` must be resolved before full implementation
- `risks` highlight potential implementation challenges
- Combine with `getComponentStyles` for even more detailed information per component

---

## Best Practices for Accurate Implementation

### Getting Complete Visual Information

1. **Always check `visualStyles` in componentMappings** - This now includes:
   - All colors used (hex format ready for CSS)
   - All fonts with family, size, and weight
   - Spacing values (padding, gap)
   - Border properties (width, radius, color)
   - Shadow effects as CSS strings
   - Image detection flag

2. **Use `getComponentStyles` for individual components** when you need:
   - Complete hierarchical style information with children
   - Exact text content and styling
   - Image URLs (when available)
   - Full effect/shadow details
   - All layout properties

3. **Workflow for accurate implementation:**
   ```
   getFigmaPageOverview → identify pages
   ↓
   getFrameMap/getComponentMap → identify components
   ↓
   getImplementationPlan → get structure + visualStyles for all
   ↓
   getComponentStyles → get detailed styles for specific components
   ↓
   getDesignTokens → extract reusable design values
   ↓
   Implement with accurate colors, fonts, spacing, borders
   ```

### Common Issues and Solutions

**Problem:** "Generated code has structure but wrong colors/fonts"
**Solution:** Use the `visualStyles` field in componentMappings or call `getComponentStyles` for the specific component ID to get exact hex colors and font specifications.

**Problem:** "Text has mixed font weights but only one weight is applied"
**Solution:** Use `getComponentStyles` and check the `text.mixedStyles` array. This shows different font weights/sizes within the same text element with exact character ranges.

**Problem:** "Icons and images are missing"
**Solution:** Check `hasImages` and `hasVectors` flags in visualStyles. Use `getComponentStyles` to see the `vectors` array (all icons/shapes) and `images` array (all bitmap images with imageRef IDs).

**Problem:** "Component dimensions don't match Figma"
**Solution:** Check `visualStyles.dimensions` for exact width/height from Figma. Use `visualStyles.position` for x,y coordinates if absolute positioning is needed.

**Problem:** "Spacing doesn't match design"
**Solution:** Look at `visualStyles.spacing` for padding and gap values, or check the `layoutStrategy.details` for itemSpacing in auto-layout frames.

**Problem:** "Components are misaligned or wrong arrangement"
**Solution:** Use `visualStyles.position` (x, y coordinates) to understand relative positioning. Check parent's `layoutMode` (HORIZONTAL/VERTICAL) and `itemSpacing` for proper flex/grid arrangement.

---

## Required Response Structure

When using this MCP server, you MUST follow this structure:

### Step 1: Query the MCP Server

Use appropriate tool(s) to gather design information.

### Step 2: Present Structured Summary

Present findings in this exact format:

```markdown
## Design Analysis

[Concise 1-2 sentence summary of design structure]

### Key Findings

- [Bullet point findings - be specific and actionable]
- [Reference specific component/token names from responses]
- [Include relevant IDs, dimensions, or values]

### Components Identified

| Name   | Type   | Dimensions | Complexity | Notes         |
| ------ | ------ | ---------- | ---------- | ------------- |
| [name] | [type] | [w]×[h]    | [score/10] | [key details] |

### Design Tokens Available

| Name   | Category   | Value   | Usage         |
| ------ | ---------- | ------- | ------------- |
| [name] | [category] | [value] | [when to use] |

### Implementation Guidance

1. [Specific actionable step with component/token references]
2. [Layout strategy with reasoning]
3. [Styling approach with token usage]

### Open Questions

- [Question requiring developer decision]
- [Missing design details that need clarification]

### Risks & Considerations

- **[Severity]**: [Risk] - [Mitigation]
```

### Step 3: Provide Targeted Guidance Only

- Explain HOW to implement (architecture, patterns, token usage)
- Do NOT generate complete component code
- Do NOT guess design details not present in MCP response
- Do NOT provide verbose explanations—be direct and specific

---

## Strict DO Rules

1. **DO** call `getFigmaPageOverview` first when exploring unknown files
2. **DO** reference specific component IDs, names, and token names from responses
3. **DO** surface all `openQuestions` from `getImplementationPlan` to the user
4. **DO** highlight `risks` with appropriate severity levels
5. **DO** use `componentMappings.layoutStrategy` to inform layout approach
6. **DO** recommend specific design tokens by name for styling
7. **DO** note component `complexityScore` when planning implementation order
8. **DO** use pagination (limit/offset) for large responses
9. **DO** use filter parameters (`tokenType`, `componentType`, `pageId`) to narrow results
10. **DO** explain layout strategy reasoning from `layoutStrategy.reasoning`
11. **DO** present findings in structured table format (as shown above)
12. **DO** provide actionable, specific guidance tied to actual response data

---

## Strict DO-NOT Rules

1. **DO NOT** generate full component implementations—only provide architectural guidance
2. **DO NOT** invent component names, props, or design values not present in MCP response
3. **DO NOT** assume design details (colors, spacing, typography) not in response
4. **DO NOT** provide generic advice—always reference specific components/tokens from response
5. **DO NOT** skip `openQuestions`—these must be resolved before implementation
6. **DO NOT** ignore `risks`—always surface them to the user
7. **DO NOT** write verbose explanations—be concise and direct
8. **DO NOT** create code without explicit user request after analysis
9. **DO NOT** guess `layoutStrategy` details—use exactly what the response provides
10. **DO NOT** suggest tokens that aren't in the `getDesignTokens` response
11. **DO NOT** proceed with implementation if response has empty arrays or missing critical data
12. **DO NOT** hallucinate component relationships not present in `parentId`/`childrenIds`

---

## Error Handling

If MCP server returns an error:

1. Present the error message clearly
2. Suggest corrective action (e.g., verify fileKey, check API access)
3. Do NOT attempt to proceed with implementation

If response has empty arrays:

1. State clearly: "No [components/tokens/pages] found in response"
2. Suggest using filters or checking different pages
3. Do NOT make assumptions about what should be there

---

## Example Workflow

**User Request:**
"Analyze the button components in this Figma file: abc123"

**Correct Response:**

1. Call `getFigmaPageOverview` with `fileKey: "abc123"`
2. Identify pages with button components
3. Call `getComponentMap` with `fileKey: "abc123"`, `componentName: "button"`
4. Call `getDesignTokens` with `fileKey: "abc123"`, `tokenType: "color"` (and other relevant types)
5. Call `getImplementationPlan` with `fileKey: "abc123"`, `componentIds: [button IDs from step 3]`
6. Present structured analysis:

```markdown
## Design Analysis

File contains 3 button variants across 2 component sets with comprehensive token coverage.

### Key Findings

- Primary button component set with Size (Small, Medium, Large) and State (Default, Hover, Disabled) variants
- Secondary button uses same size variants but different color tokens
- All buttons use `flexbox` layout with consistent padding from spacing tokens

### Components Identified

| Name             | Type          | Dimensions | Complexity | Notes                                   |
| ---------------- | ------------- | ---------- | ---------- | --------------------------------------- |
| Button/Primary   | COMPONENT_SET | 120×40     | 4/10       | 6 variants, uses primary color tokens   |
| Button/Secondary | COMPONENT_SET | 120×40     | 3/10       | 6 variants, uses secondary color tokens |
| IconButton       | COMPONENT     | 40×40      | 2/10       | Single variant, icon-only               |

### Design Tokens Available

| Name        | Category   | Value                | Usage                     |
| ----------- | ---------- | -------------------- | ------------------------- |
| primary-500 | color      | rgba(37, 99, 235, 1) | Primary button background |
| spacing-md  | spacing    | 16                   | Button horizontal padding |
| button-text | typography | Inter, 14px, 600     | Button label text         |

### Implementation Guidance

1. **Create base Button component** (complexity: 4/10)
   - Props: `variant` ('primary' | 'secondary'), `size` ('sm' | 'md' | 'lg'), `disabled` (boolean)
   - Layout: Flexbox with `flex-direction: row`, `align-items: center`, `justify-content: center`
   - Use `spacing-md` (16px) for horizontal padding, `spacing-sm` (8px) for vertical padding

2. **Implement variant styling**
   - Primary: Background uses `primary-500` token, text uses `neutral-0` (white)
   - Secondary: Background uses `neutral-100` token, text uses `neutral-900`
   - Hover states: Reduce opacity to 0.9 (no specific hover token defined)

3. **Typography implementation**
   - Use `button-text` token for all sizes (14px, 600 weight)
   - Apply `letter-spacing: 0.5px` from typography token

### Open Questions

- **Hover state animation**: Design shows hover state but no transition duration specified. Recommend 150ms?
- **Focus state**: No focus indicator defined in Figma. Should we add 2px outline for accessibility?
- **Icon placement**: IconButton shown but no guidance on icon-with-text buttons. Left icon, right icon, or both?

### Risks & Considerations

- **Medium**: Disabled state uses opacity but no specific disabled color token—verify with design team for accessibility contrast ratios
- **Low**: Button width varies by content—no max-width constraint defined, may need constraint for long text scenarios
```

---

## Example of INCORRECT Response

**DO NOT** respond like this:

"I'll create a button component for you. Here's the code:

```typescript
// Button.tsx
export const Button = ({ children, variant = 'primary' }) => {
  return (
    <button className={`btn btn-${variant}`}>
      {children}
    </button>
  );
};
```

This implements the primary and secondary variants with proper styling..."

**Why this is WRONG:**

- ❌ Generated complete code without user requesting it
- ❌ Didn't show MCP server response data
- ❌ Invented props without referencing `componentMappings.props`
- ❌ No structured analysis table
- ❌ Didn't surface `openQuestions` or `risks`
- ❌ No design token references
- ❌ Verbose explanation instead of concise guidance

---

## Framework-Specific Guidance

When user requests framework-specific implementation:

1. **DO** pass `targetFramework` parameter to `getImplementationPlan`
2. **DO** use framework conventions from `suggestedCodeName` and `suggestedFilePath`
3. **DO** reference `codeExample` snippets from response if provided
4. **DO NOT** expand beyond the guidance in response—keep it concise

---

## Token Usage Best Practices

When presenting design tokens:

1. Show actual token values from response (don't abstract them further)
2. For colors, convert RGBA if needed: `{ r: 0.145, g: 0.388, b: 0.922, a: 1 }` → `rgba(37, 99, 235, 1)` or `#2563EB`
3. Reference tokens by their exact `name` from response
4. Group tokens by `category` in presentation
5. Include `usage` guidance when present in response

---

## Pagination Handling

For large datasets:

1. Use default `limit: 100` for initial queries
2. If `totalCount > limit`, inform user: "Showing 100 of [totalCount] [items]. Use offset parameter for more."
3. Only increase `limit` or use `offset` if user explicitly requests more data
4. DO NOT automatically fetch all pages—let user drive pagination

---

## Final Reminders

- **Be concise**: One line where one line suffices
- **Be specific**: Reference actual IDs, names, and values from responses
- **Be actionable**: Provide guidance that developers can immediately act on
- **Be honest**: If data is missing, say so—don't guess
- **Be structured**: Use tables and sections consistently

This is a design-to-code bridge tool, not a code generator. Your role is to translate Figma design data into actionable implementation guidance.

---

## Appendix: Color Conversion Reference

MCP server returns colors in normalized RGB format (0-1 range):

```typescript
{ r: 0.145, g: 0.388, b: 0.922, a: 1 }
```

Convert to formats developers expect:

**To rgba() string:**

```
rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})
→ rgba(37, 99, 235, 1)
```

**To hex:**

```
#${((r * 255) << 16 | (g * 255) << 8 | (b * 255)).toString(16).padStart(6, '0')}
→ #2563EB
```

**Alpha handling:**

- If `a < 1`, use `rgba()` format (hex doesn't support alpha well)
- If `a === 1`, hex format is acceptable

Always show both formats in token tables for developer convenience.
