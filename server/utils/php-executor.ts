// server/utils/php-executor.ts
// Execute PHP scripts and return JSON response

import { spawn } from 'child_process';
import { join } from 'path';

interface PhpExecutorOptions {
  script: string;
  queryParams?: Record<string, string | number | boolean>;
  method?: 'GET' | 'POST';
  body?: any;
}

/**
 * Execute PHP script and return parsed JSON response
 * Uses PHP CLI to execute scripts directly (no HTTP server needed)
 */
export async function executePhpScript(options: PhpExecutorOptions): Promise<any> {
  const { script, queryParams = {}, method = 'GET', body } = options;
  
  // Build PHP script path
  const scriptPath = join(process.cwd(), 'server', 'api', 'php', script);
  
  // Log for debugging
  console.log(`[php-executor] Executing PHP script: ${script} with params:`, queryParams);
  
  // Build query string for $_GET superglobal
  const queryString = Object.entries(queryParams)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  
  // Set environment variables to simulate web server environment
  const env = {
    ...process.env,
    REQUEST_METHOD: method,
    QUERY_STRING: queryString,
    SERVER_NAME: 'localhost',
    SERVER_PORT: '80',
    REQUEST_URI: `/server/api/php/${script}${queryString ? '?' + queryString : ''}`,
    SCRIPT_NAME: `/server/api/php/${script}`,
    ...(method === 'POST' && body ? { 
      HTTP_CONTENT_TYPE: 'application/json',
      CONTENT_LENGTH: JSON.stringify(body).length.toString(),
      REQUEST_BODY: JSON.stringify(body) // Send body via environment variable for CLI
    } : {}),
  };
  
  // Log environment setup
  console.log(`[php-executor] PHP script path: ${scriptPath}`);
  console.log(`[php-executor] Query string: ${queryString}`);
  if (method === 'POST' && body) {
    const bodyJson = JSON.stringify(body);
    console.log(`[php-executor] POST body: ${bodyJson}`);
    console.log(`[php-executor] REQUEST_BODY env var will be set: ${bodyJson.substring(0, 100)}...`);
  }
  
  return new Promise((resolve, reject) => {
    const phpProcess = spawn('php', [scriptPath], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    // For POST requests, body is sent via REQUEST_BODY environment variable
    // We still write to stdin as a fallback, but PHP script will prefer REQUEST_BODY
    if (method === 'POST' && body) {
      const bodyJson = JSON.stringify(body);
      phpProcess.stdin.write(bodyJson);
      phpProcess.stdin.end();
    } else {
      phpProcess.stdin.end();
    }
    
    phpProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    phpProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    phpProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`[php-executor] PHP script exited with code ${code}`);
        console.error(`[php-executor] stderr: ${stderr}`);
        console.error(`[php-executor] stdout (first 500 chars): ${stdout.substring(0, 500)}`);
        
        // Try to parse error response if it's JSON
        let errorMessage = `PHP script failed with code ${code}`;
        if (stderr) {
          errorMessage += `: ${stderr}`;
        } else if (stdout) {
          try {
            const errorData = JSON.parse(stdout);
            if (errorData.error) {
              errorMessage = errorData.error;
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          } catch (e) {
            // Not JSON, use raw output
            errorMessage += `: ${stdout.substring(0, 200)}`;
          }
        }
        
        reject(new Error(errorMessage));
        return;
      }
      
      try {
        // Try to parse JSON response
        const jsonData = JSON.parse(stdout);
        resolve(jsonData);
      } catch (error) {
        console.error('[php-executor] Failed to parse JSON response:', stdout.substring(0, 500));
        reject(new Error(`Failed to parse PHP response as JSON: ${stdout.substring(0, 200)}`));
      }
    });
    
    phpProcess.on('error', (error: any) => {
      console.error('[php-executor] Failed to spawn PHP process:', error);
      // If PHP is not installed, provide helpful error message
      if (error.code === 'ENOENT') {
        reject(new Error('PHP is not installed or not in PATH. Please install PHP CLI.'));
      } else {
        reject(error);
      }
    });
  });
}
