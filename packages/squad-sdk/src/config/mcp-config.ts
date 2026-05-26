export type McpConfigMode = 'copilot-file' | 'agent-frontmatter' | 'none';

export interface McpServerSpec {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export function buildMcpServerSpecs(isGitHub: boolean): McpServerSpec[] {
  const servers: McpServerSpec[] = [
    {
      name: 'squad_state',
      command: 'npx',
      args: ['-y', '@bradygaster/squad-cli', 'state-mcp'],
    },
  ];

  servers.push(isGitHub
    ? {
        name: 'EXAMPLE-github',
        command: 'npx',
        args: ['-y', '@anthropic/github-mcp-server'],
        env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
      }
    : {
        name: 'EXAMPLE-azure-devops',
        command: 'npx',
        args: ['-y', '@azure/devops-mcp-server'],
        env: {
          AZURE_DEVOPS_ORG: '${AZURE_DEVOPS_ORG}',
          AZURE_DEVOPS_PAT: '${AZURE_DEVOPS_PAT}',
        },
      });

  return servers;
}

export function buildMcpConfigJson(servers: McpServerSpec[]): Record<string, unknown> {
  return {
    mcpServers: Object.fromEntries(servers.map(({ name, ...server }) => [name, server])),
  };
}

function yamlSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function yamlEnvValue(value: string): string {
  if (/^\$\{[A-Z0-9_]+\}$/.test(value)) {
    return value;
  }
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function buildMcpFrontmatterBlock(servers: McpServerSpec[]): string {
  const lines = ['mcp-servers:'];

  for (const server of servers) {
    lines.push(`  ${server.name}:`);
    lines.push('    type: local');
    lines.push(`    command: ${server.command}`);
    lines.push(`    args: [${server.args.map(yamlSingleQuoted).join(', ')}]`);
    lines.push('    tools: ["*"]');

    if (server.env && Object.keys(server.env).length > 0) {
      lines.push('    env:');
      for (const [key, value] of Object.entries(server.env)) {
        lines.push(`      ${key}: ${yamlEnvValue(value)}`);
      }
    }
  }

  return lines.join('\n');
}

export function injectMcpFrontmatter(content: string, servers: McpServerSpec[]): string {
  const closingStart = content.indexOf('\n---', 4);
  if (!content.startsWith('---') || closingStart === -1) {
    return content;
  }

  return content.slice(0, closingStart)
    + '\n'
    + buildMcpFrontmatterBlock(servers)
    + content.slice(closingStart);
}

export function hasMcpFrontmatter(content: string): boolean {
  const frontmatterEnd = content.indexOf('\n---', 4);
  if (!content.startsWith('---') || frontmatterEnd === -1) {
    return false;
  }
  return content.slice(0, frontmatterEnd).includes('mcp-servers:');
}
