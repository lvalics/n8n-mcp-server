import { Tool } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the project root directory (parent of n8n-mcp-server)
const projectRoot = path.resolve(__dirname, '..', '..', '..');

export const workflowGeneratorTool: Tool = {
  name: 'generate_complete_workflow',
  description: `Generate a complete n8n workflow implementation based on requirements. 
  This tool:
  1. Searches RAG for relevant workflows and nodes
  2. Includes examples from DemoVideoCreation and TaskManager
  3. Builds comprehensive context for LLM
  4. Generates production-ready workflow JSON(s)
  
  Use this when you need to create complex workflows with specific integrations like WhatsApp, LinkedIn, etc.`,
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Detailed description of what the workflow should do'
      },
      features: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of required features/integrations (e.g., whatsapp, linkedin, ai-agent)'
      },
      useTaskManager: {
        type: 'boolean',
        description: 'Whether to use Task Manager pattern for microservices',
        default: false
      },
      outputFormat: {
        type: 'string',
        enum: ['single', 'microservices'],
        description: 'Output as single workflow or multiple microservice workflows',
        default: 'single'
      },
      complexity: {
        type: 'string',
        enum: ['simple', 'intermediate', 'advanced'],
        default: 'intermediate'
      }
    },
    required: ['description', 'features']
  }
};

export async function handleGenerateCompleteWorkflow(args: any) {
  try {
    const { description, features, useTaskManager, outputFormat, complexity } = args;
    
    // Step 1: Search for relevant workflows using RAG
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const pythonPath = path.join(projectRoot, 'venv', 'bin', 'python');
    const wrapperPath = path.join(projectRoot, 'rag_client_wrapper.py');
    
    // Search for relevant workflows
    const workflowSearchParams = {
      query: `${description} ${features.join(' ')}`,
      limit: 5,
      threshold: 0.3
    };
    
    const workflowSearchCmd = `"${pythonPath}" "${wrapperPath}" search_workflows '${JSON.stringify(workflowSearchParams)}'`;
    const { stdout: workflowResults } = await execAsync(workflowSearchCmd, { 
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024 
    });
    
    const relevantWorkflows = JSON.parse(workflowResults);
    
    // Step 2: Search for relevant nodes
    const nodeSearchParams = {
      query: features.join(' '),
      limit: 10,
      threshold: 0.3
    };
    
    const nodeSearchCmd = `"${pythonPath}" "${wrapperPath}" search_nodes '${JSON.stringify(nodeSearchParams)}'`;
    const { stdout: nodeResults } = await execAsync(nodeSearchCmd, { 
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024 
    });
    
    const relevantNodes = JSON.parse(nodeResults);
    
    // Step 3: Load example workflows if needed
    let demoExamples = [];
    let taskManagerExamples = [];
    
    if (outputFormat === 'microservices' || useTaskManager) {
      // Load DemoVideoCreation examples
      const demoDir = path.join(projectRoot, 'DemoVideoCreation');
      const demoFiles = await fs.readdir(demoDir);
      for (const file of demoFiles) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(demoDir, file), 'utf-8');
          demoExamples.push({
            name: file,
            workflow: JSON.parse(content)
          });
        }
      }
      
      // Load TaskManager examples
      const taskDir = path.join(projectRoot, 'TaskManager');
      const taskFiles = await fs.readdir(taskDir);
      for (const file of taskFiles) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(taskDir, file), 'utf-8');
          taskManagerExamples.push({
            name: file,
            workflow: JSON.parse(content)
          });
        }
      }
    }
    
    // Step 4: Load CLAUDE.md for additional context
    const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
    const claudeMdContent = await fs.readFile(claudeMdPath, 'utf-8');
    
    // Step 5: Build comprehensive prompt
    const systemPrompt = buildSystemPrompt({
      description,
      features,
      relevantWorkflows,
      relevantNodes,
      demoExamples,
      taskManagerExamples,
      useTaskManager,
      outputFormat,
      complexity,
      claudeMdContent
    });
    
    // Step 6: Generate implementation plan
    const implementationPlan = {
      description,
      requirements: {
        features,
        complexity,
        patterns: outputFormat === 'microservices' ? ['microservice', 'modular'] : ['standalone'],
        useTaskManager
      },
      context: {
        relevantWorkflows: relevantWorkflows.slice(0, 3).map((w: any) => ({
          name: w.name,
          description: w.description,
          similarity: w.similarity
        })),
        suggestedNodes: relevantNodes.map((n: any) => ({
          type: n.type,
          name: n.name,
          description: n.description
        })),
        examplePatterns: {
          microservices: demoExamples.length > 0 ? 'DemoVideoCreation pattern' : null,
          taskManager: taskManagerExamples.length > 0 ? 'TaskManager pattern' : null
        }
      },
      implementationSteps: generateImplementationSteps(features, outputFormat, useTaskManager),
      systemPrompt: systemPrompt.substring(0, 1000) + '... [truncated for display]'
    };
    
    return {
      success: true,
      plan: implementationPlan,
      prompt: systemPrompt,
      instructions: `
## Workflow Generation Ready

I've prepared a comprehensive context for generating your n8n workflow(s). The system has:

1. **Found ${relevantWorkflows.length} relevant workflows** matching your requirements
2. **Identified ${relevantNodes.length} relevant nodes** for the features you need
3. **Loaded ${demoExamples.length} microservice examples** (if applicable)
4. **Loaded ${taskManagerExamples.length} Task Manager examples** (if applicable)

### Next Steps:
1. Use the provided system prompt with an LLM to generate the workflow JSON(s)
2. The LLM will create ${outputFormat === 'microservices' ? 'multiple interconnected workflows' : 'a single workflow'}
3. Each workflow will follow the patterns and best practices from the examples

### Key Features to be Implemented:
${features.map((f: string) => `- ${f}`).join('\n')}

The generated workflow(s) will be production-ready with:
- Proper error handling
- Comprehensive logging
- Modular architecture
- Clear documentation via Sticky Notes
      `.trim()
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function buildSystemPrompt(context: any): string {
  const { 
    description, 
    features, 
    relevantWorkflows, 
    relevantNodes, 
    demoExamples, 
    taskManagerExamples,
    useTaskManager,
    outputFormat,
    complexity,
    claudeMdContent
  } = context;
  
  return `
# n8n Workflow Generation System Prompt

${claudeMdContent}

## Current Task

Generate a ${complexity} complexity n8n workflow implementation with the following requirements:

**Description**: ${description}
**Required Features**: ${features.join(', ')}
**Output Format**: ${outputFormat}
**Use Task Manager**: ${useTaskManager}

## Relevant Context

### Similar Workflows Found:
${relevantWorkflows.slice(0, 3).map((w: any) => `
- **${w.name}** (${Math.round(w.similarity * 100)}% match)
  ${w.description.substring(0, 200)}...
`).join('\n')}

### Recommended Nodes:
${relevantNodes.map((n: any) => `
- **${n.name}** (${n.type})
  ${n.description}
`).join('\n')}

${outputFormat === 'microservices' ? `
### Microservice Pattern Examples:
${demoExamples.map((e: any) => `
#### ${e.name}
- Webhook triggers for inter-service communication
- Modular design with single responsibility
- Clear input/output documentation
`).join('\n')}
` : ''}

${useTaskManager ? `
### Task Manager Integration:
${taskManagerExamples.map((e: any) => `
#### ${e.name}
- Task creation and monitoring
- Status updates via webhooks
- Centralized task orchestration
`).join('\n')}
` : ''}

## Implementation Requirements

1. **Architecture**:
   - ${outputFormat === 'microservices' ? 'Create separate workflows for each major function' : 'Create a single comprehensive workflow'}
   - ${useTaskManager ? 'Integrate with Task Manager for orchestration' : 'Use direct workflow connections'}
   - Implement proper error handling at each step
   - Add comprehensive logging nodes

2. **Features to Implement**:
${features.map((f: string) => `   - ${f}: Full integration with all necessary nodes`).join('\n')}

3. **Best Practices**:
   - Use Sticky Notes for documentation
   - Implement proper credential references
   - Add error handling and logging
   - Follow the patterns from similar workflows
   - Ensure all nodes are properly connected

4. **Output Requirements**:
   - Generate complete, valid JSON workflow(s)
   - Include all necessary node configurations
   - Ensure proper connections between nodes
   - Add helpful Sticky Notes for documentation

Generate the complete workflow implementation(s) now.
`.trim();
}

function generateImplementationSteps(features: string[], outputFormat: string, useTaskManager: boolean): string[] {
  const steps = [];
  
  if (outputFormat === 'microservices') {
    steps.push('Create main orchestrator workflow with webhook trigger');
    steps.push('Design separate microservice workflows for each feature');
    features.forEach((f: string) => {
      steps.push(`Implement ${f} microservice with webhook trigger and response`);
    });
    if (useTaskManager) {
      steps.push('Integrate Task Manager for workflow orchestration');
      steps.push('Add task creation and monitoring capabilities');
    }
    steps.push('Connect microservices via HTTP requests');
    steps.push('Add centralized logging and error handling');
  } else {
    steps.push('Create main workflow with appropriate trigger');
    features.forEach((f: string) => {
      steps.push(`Add ${f} integration nodes and configuration`);
    });
    steps.push('Implement error handling and logging');
    steps.push('Add documentation via Sticky Notes');
    steps.push('Test all connections and data flow');
  }
  
  return steps;
}