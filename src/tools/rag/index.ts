/**
 * RAG tools module exports
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SearchWorkflowsHandler } from './search-workflows.js';
import { GetInsightsHandler } from './get-insights.js';
import { GenerateWorkflowHandler } from './generate-workflow.js';

// Export handlers
export { SearchWorkflowsHandler } from './search-workflows.js';
export { GetInsightsHandler } from './get-insights.js';
export { GenerateWorkflowHandler } from './generate-workflow.js';

/**
 * Set up RAG tools and return their definitions
 */
export async function setupRAGTools(): Promise<Tool[]> {
  const searchHandler = new SearchWorkflowsHandler();
  const insightsHandler = new GetInsightsHandler();
  const generateHandler = new GenerateWorkflowHandler();

  return [
    {
      name: searchHandler.name,
      description: searchHandler.description,
      inputSchema: searchHandler.inputSchema
    },
    {
      name: insightsHandler.name,
      description: insightsHandler.description,
      inputSchema: insightsHandler.inputSchema
    },
    {
      name: generateHandler.name,
      description: generateHandler.description,
      inputSchema: generateHandler.inputSchema
    }
  ];
}