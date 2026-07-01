export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required: string[]
  }
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

/** Per-invocation context handed to a tool's execute(). Used so search_comic
 *  can dedupe against albums already shown this session without tools needing
 *  their own session state. `sessionId` is the conversation id; `shownAlbums`
 *  is the set of album ids the user has already been offered. */
export interface ToolContext {
  sessionId: string
  shownAlbums: Set<string>
}

interface RegisteredTool {
  def: ToolDefinition
  execute: (params: Record<string, unknown>, ctx?: ToolContext) => Promise<ToolResult>
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>()

  register(def: ToolDefinition, execute: (params: Record<string, unknown>, ctx?: ToolContext) => Promise<ToolResult>) {
    this.tools.set(def.name, { def, execute })
  }

  getDefinitions(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => t.def)
  }

  async execute(name: string, params: Record<string, unknown>, ctx?: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) return { success: false, error: `Tool "${name}" not found` }
    try {
      return await tool.execute(params, ctx)
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
}

export const toolRegistry = new ToolRegistry()
