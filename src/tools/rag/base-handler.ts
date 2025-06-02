/**
 * Base handler for RAG-related operations
 */

import { ToolHandler } from '../../types/index.js';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export abstract class BaseRAGHandler implements ToolHandler<any> {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: any;

  /**
   * Execute a Python script and return its output
   */
  protected async executePythonScript(scriptName: string, args: string[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      // Get the path to the workflow_creator directory (parent of n8n-mcp-server)
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      
      // Navigate from src/tools/rag to workflow_creator
      const workflowCreatorPath = join(__dirname, '..', '..', '..', '..');
      
      const venvPath = join(workflowCreatorPath, 'venv');
      const pythonPath = join(venvPath, 'bin', 'python3');
      const scriptPath = join(workflowCreatorPath, scriptName);

      // Prepare environment with Python path
      const env = {
        ...process.env,
        PYTHONPATH: workflowCreatorPath
      };

      const pythonProcess = spawn(pythonPath, [scriptPath, ...args], {
        cwd: workflowCreatorPath,
        env: env
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Try to parse as JSON first
            const result = JSON.parse(output);
            resolve(result);
          } catch {
            // If not JSON, return as string
            resolve(output);
          }
        } else {
          reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
        }
      });

      pythonProcess.on('error', (err) => {
        reject(new Error(`Failed to start Python script: ${err.message}`));
      });
    });
  }

  /**
   * Call Python RAG client through a wrapper script
   */
  protected async callRAGClient(method: string, params: any): Promise<any> {
    const args = [method, JSON.stringify(params)];
    return this.executePythonScript('rag_client_wrapper.py', args);
  }

  abstract execute(args: any): Promise<any>;
}