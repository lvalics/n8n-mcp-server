/**
 * Search workflows using RAG semantic search
 */

import { BaseRAGHandler } from './base-handler.js';
import { ToolCallResult } from '../../types/index.js';

interface SearchWorkflowsArgs {
  query: string;
  limit?: number;
  threshold?: number;
  includeNodes?: boolean;
}

export class SearchWorkflowsHandler extends BaseRAGHandler {
  name = 'rag_search_workflows';
  description = 'Search for workflows using semantic similarity. Find workflows based on natural language descriptions.';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language query to search for workflows (e.g., "AI chatbot with memory")'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 5
      },
      threshold: {
        type: 'number',
        description: 'Similarity threshold (0.0-1.0). Lower values return more results.',
        default: 0.5
      },
      includeNodes: {
        type: 'boolean',
        description: 'Include suggested nodes in the response',
        default: false
      }
    },
    required: ['query']
  };

  async execute(args: SearchWorkflowsArgs): Promise<ToolCallResult> {
    try {
      const { query, limit = 5, threshold = 0.5, includeNodes = false } = args;

      // Call RAG client to search workflows
      const searchResults = await this.callRAGClient('search_workflows', {
        query,
        limit,
        threshold
      });

      let nodeResults = [];
      if (includeNodes) {
        // Also search for relevant nodes
        nodeResults = await this.callRAGClient('search_nodes', {
          query,
          limit: limit * 2,
          threshold
        });
      }

      // Format response
      const formattedResults = {
        query,
        workflowMatches: searchResults.map((result: any) => ({
          name: result.name,
          description: result.description,
          similarity: result.similarity,
          id: result.id,
          complexity: result.data?.complexity,
          patterns: result.data?.patterns || [],
          tags: result.data?.tags || []
        })),
        ...(includeNodes && {
          suggestedNodes: nodeResults.map((result: any) => ({
            type: result.data?.node_type || result.name,
            name: result.name,
            description: result.description,
            similarity: result.similarity,
            useCases: result.data?.use_cases || []
          }))
        }),
        totalMatches: searchResults.length
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(formattedResults, null, 2)
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
              details: 'Failed to search workflows using RAG'
            })
          }
        ],
        isError: true
      };
    }
  }
}