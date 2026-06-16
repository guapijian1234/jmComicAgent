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

interface RegisteredTool {
  def: ToolDefinition
  execute: (params: Record<string, unknown>) => Promise<ToolResult>
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>()

  register(def: ToolDefinition, execute: (params: Record<string, unknown>) => Promise<ToolResult>) {
    this.tools.set(def.name, { def, execute })
  }

  getDefinitions(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => t.def)
  }

  async execute(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) return { success: false, error: `Tool "${name}" not found` }
    try {
      return await tool.execute(params)
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
}

export const toolRegistry = new ToolRegistry()
