/**
 * Generate workflow suggestions based on RAG context
 */

import { BaseRAGHandler } from './base-handler.js';
import { ToolCallResult } from '../../types/index.js';

interface GenerateWorkflowArgs {
  description: string;
  requirements?: {
    trigger?: string;
    integrations?: string[];
    complexity?: 'simple' | 'intermediate' | 'advanced';
    patterns?: string[];
  };
  examplesLimit?: number;
}

export class GenerateWorkflowHandler extends BaseRAGHandler {
  name = 'rag_generate_workflow';
  description = 'Generate a workflow structure based on description and requirements using RAG context from existing workflows.';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      description: {
        type: 'string',
        description: 'Natural language description of the workflow to generate'
      },
      requirements: {
        type: 'object',
        description: 'Specific requirements for the workflow',
        properties: {
          trigger: {
            type: 'string',
            description: 'Type of trigger (webhook, schedule, manual, etc.)'
          },
          integrations: {
            type: 'array',
            items: { type: 'string' },
            description: 'Required integrations (e.g., slack, telegram, openai)'
          },
          complexity: {
            type: 'string',
            enum: ['simple', 'intermediate', 'advanced'],
            description: 'Desired complexity level'
          },
          patterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Patterns to follow (microservice, ai_agent, rag, etc.)'
          }
        }
      },
      examplesLimit: {
        type: 'number',
        description: 'Number of example workflows to use for context',
        default: 3
      }
    },
    required: ['description']
  };

  async execute(args: GenerateWorkflowArgs): Promise<ToolCallResult> {
    try {
      const { description, requirements = {}, examplesLimit = 3 } = args;

      // Build generation context from RAG
      const context = await this.callRAGClient('build_generation_context', {
        query: description,
        examples_limit: examplesLimit
      });

      // Generate workflow structure based on context
      const workflowStructure = this.generateWorkflowStructure(description, requirements, context);

      // Format the response
      const response = {
        description,
        requirements,
        context: {
          relevantWorkflows: context.relevant_workflows?.map((w: any) => ({
            name: w.name,
            complexity: w.complexity,
            patterns: w.patterns
          })),
          suggestedNodes: context.suggested_nodes?.map((n: any) => ({
            type: n.type,
            name: n.name,
            purpose: n.description
          })),
          patterns: context.patterns
        },
        generatedStructure: workflowStructure,
        implementationSteps: this.generateImplementationSteps(workflowStructure, context),
        notes: this.generateNotes(requirements, context)
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error occurred',
              details: 'Failed to generate workflow structure'
            })
          }
        ],
        isError: true
      };
    }
  }

  private generateWorkflowStructure(description: string, requirements: any, context: any): any {
    const nodes: any[] = [];
    const connections: any = {};
    
    // Add trigger node
    const triggerType = requirements.trigger || this.inferTrigger(context);
    const triggerId = 'trigger_1';
    nodes.push({
      id: triggerId,
      type: this.getTriggerNodeType(triggerType),
      name: `${triggerType} Trigger`,
      parameters: {},
      position: [250, 300]
    });

    // Add main processing nodes based on context
    let previousNodeId = triggerId;
    let nodeCount = 1;

    // Add AI agent if patterns suggest it
    if (context.patterns?.includes('ai_agent') || description.toLowerCase().includes('ai') || description.toLowerCase().includes('chat')) {
      nodeCount++;
      const agentId = `agent_${nodeCount}`;
      nodes.push({
        id: agentId,
        type: '@n8n/n8n-nodes-langchain.agent',
        name: 'AI Agent',
        parameters: {},
        position: [450, 300]
      });
      connections[previousNodeId] = { main: [[{ node: agentId, type: 'main', index: 0 }]] };
      previousNodeId = agentId;
    }

    // Add integration nodes based on requirements
    if (requirements.integrations) {
      requirements.integrations.forEach((integration: string) => {
        nodeCount++;
        const nodeId = `node_${nodeCount}`;
        const nodeType = this.getIntegrationNodeType(integration);
        nodes.push({
          id: nodeId,
          type: nodeType,
          name: `${integration} Integration`,
          parameters: {},
          position: [250 + nodeCount * 200, 300]
        });
        connections[previousNodeId] = { main: [[{ node: nodeId, type: 'main', index: 0 }]] };
        previousNodeId = nodeId;
      });
    }

    // Add suggested nodes from context
    const suggestedNodes = context.suggested_nodes?.slice(0, 3) || [];
    suggestedNodes.forEach((suggested: any) => {
      nodeCount++;
      const nodeId = `node_${nodeCount}`;
      nodes.push({
        id: nodeId,
        type: suggested.type,
        name: suggested.name,
        parameters: suggested.parameters || {},
        position: [250 + nodeCount * 200, 300]
      });
      connections[previousNodeId] = { main: [[{ node: nodeId, type: 'main', index: 0 }]] };
      previousNodeId = nodeId;
    });

    return {
      nodes,
      connections,
      settings: {
        executionOrder: 'v1'
      }
    };
  }

  private inferTrigger(context: any): string {
    const patterns = context.patterns || [];
    if (patterns.includes('microservice')) return 'webhook';
    if (patterns.includes('scheduled')) return 'schedule';
    return 'manual';
  }

  private getTriggerNodeType(trigger: string): string {
    const triggerMap: any = {
      webhook: 'n8n-nodes-base.webhook',
      schedule: 'n8n-nodes-base.scheduleTrigger',
      manual: 'n8n-nodes-base.manualTrigger',
      chat: '@n8n/n8n-nodes-langchain.chatTrigger'
    };
    return triggerMap[trigger] || 'n8n-nodes-base.manualTrigger';
  }

  private getIntegrationNodeType(integration: string): string {
    const integrationMap: any = {
      slack: 'n8n-nodes-base.slack',
      telegram: 'n8n-nodes-base.telegram',
      email: 'n8n-nodes-base.emailSend',
      openai: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      supabase: '@n8n/n8n-nodes-langchain.supabaseVectorStore',
      http: 'n8n-nodes-base.httpRequest'
    };
    return integrationMap[integration.toLowerCase()] || 'n8n-nodes-base.httpRequest';
  }

  private generateImplementationSteps(structure: any, context: any): string[] {
    const steps: string[] = [];
    
    steps.push('1. Create a new workflow in n8n');
    steps.push('2. Add the trigger node and configure its settings');
    
    if (structure.nodes.some((n: any) => n.type.includes('agent'))) {
      steps.push('3. Configure the AI agent with appropriate model and tools');
    }
    
    steps.push(`${steps.length + 1}. Connect all nodes as shown in the structure`);
    steps.push(`${steps.length + 1}. Configure credentials for each integration`);
    steps.push(`${steps.length + 1}. Test the workflow with sample data`);
    steps.push(`${steps.length + 1}. Add error handling and logging nodes`);
    
    return steps;
  }

  private generateNotes(requirements: any, context: any): string[] {
    const notes: string[] = [];
    
    if (context.patterns?.includes('microservice')) {
      notes.push('Consider implementing as a microservice with proper error responses');
    }
    
    if (requirements.complexity === 'advanced') {
      notes.push('This workflow may benefit from being split into sub-workflows');
    }
    
    notes.push('Remember to add proper error handling and logging');
    notes.push('Test thoroughly with edge cases before deploying to production');
    
    return notes;
  }
}