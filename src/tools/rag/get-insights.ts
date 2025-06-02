/**
 * Get insights about workflows and nodes for a given query
 */

import { BaseRAGHandler } from './base-handler.js';
import { ToolCallResult } from '../../types/index.js';

interface GetInsightsArgs {
  query: string;
}

export class GetInsightsHandler extends BaseRAGHandler {
  name = 'rag_get_insights';
  description = 'Get comprehensive insights about available workflows and nodes for a given use case or requirement.';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language description of what you want to build or analyze'
      }
    },
    required: ['query']
  };

  async execute(args: GetInsightsArgs): Promise<ToolCallResult> {
    try {
      const { query } = args;

      // Get insights from RAG client
      const insights = await this.callRAGClient('query_insights', { query });

      // Format the insights for better readability
      const formattedInsights = {
        query: insights.query,
        summary: this.generateSummary(insights),
        workflowMatches: insights.workflow_matches || [],
        nodeSuggestions: insights.node_suggestions || [],
        recommendedPatterns: insights.recommended_patterns || [],
        complexityEstimate: insights.complexity_estimate || 'intermediate',
        implementation: {
          suggestedApproach: this.suggestApproach(insights),
          keyComponents: this.identifyKeyComponents(insights),
          considerations: this.getConsiderations(insights)
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(formattedInsights, null, 2)
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
              details: 'Failed to get insights from RAG'
            })
          }
        ],
        isError: true
      };
    }
  }

  private generateSummary(insights: any): string {
    const workflowCount = insights.workflow_matches?.length || 0;
    const nodeCount = insights.node_suggestions?.length || 0;
    
    if (workflowCount === 0) {
      return `No exact workflow matches found for "${insights.query}", but ${nodeCount} relevant nodes were identified that could help build this solution.`;
    }
    
    return `Found ${workflowCount} relevant workflows and ${nodeCount} suggested nodes for "${insights.query}". The most similar workflow has ${(insights.workflow_matches[0]?.similarity * 100).toFixed(0)}% similarity.`;
  }

  private suggestApproach(insights: any): string {
    const patterns = insights.recommended_patterns || [];
    const topWorkflow = insights.workflow_matches?.[0];
    
    if (patterns.includes('microservice')) {
      return 'Use a microservice pattern with webhook triggers for modular design.';
    } else if (patterns.includes('ai_agent')) {
      return 'Implement an AI agent with tool integration for intelligent automation.';
    } else if (patterns.includes('rag')) {
      return 'Use RAG pattern for context-aware responses with vector database integration.';
    } else if (topWorkflow) {
      return `Consider adapting the "${topWorkflow.name}" workflow as a starting point.`;
    }
    
    return 'Start with a simple webhook trigger and build incrementally.';
  }

  private identifyKeyComponents(insights: any): string[] {
    const components: string[] = [];
    const nodes = insights.node_suggestions || [];
    
    // Identify key component types
    const hasTrigger = nodes.some((n: any) => n.type?.includes('trigger') || n.type?.includes('webhook'));
    const hasAI = nodes.some((n: any) => n.type?.includes('ai') || n.type?.includes('agent') || n.type?.includes('openai'));
    const hasDatabase = nodes.some((n: any) => n.type?.includes('supabase') || n.type?.includes('postgres'));
    const hasMessaging = nodes.some((n: any) => n.type?.includes('telegram') || n.type?.includes('slack') || n.type?.includes('email'));
    
    if (!hasTrigger) components.push('Webhook or manual trigger');
    if (hasAI) components.push('AI/LLM integration');
    if (hasDatabase) components.push('Database storage');
    if (hasMessaging) components.push('Messaging integration');
    
    // Add specific node suggestions
    nodes.slice(0, 3).forEach((node: any) => {
      components.push(`${node.name} node`);
    });
    
    return components;
  }

  private getConsiderations(insights: any): string[] {
    const considerations: string[] = [];
    
    if (insights.complexity_estimate === 'advanced') {
      considerations.push('This is a complex workflow that may require multiple sub-workflows');
    }
    
    if (insights.recommended_patterns?.includes('ai_agent')) {
      considerations.push('Configure AI agent with appropriate tools and memory management');
    }
    
    if (insights.node_suggestions?.some((n: any) => n.type?.includes('database'))) {
      considerations.push('Set up database credentials and schema before implementation');
    }
    
    considerations.push('Consider error handling and retry logic for reliability');
    considerations.push('Implement logging for debugging and monitoring');
    
    return considerations;
  }
}