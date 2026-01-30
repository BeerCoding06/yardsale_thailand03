// server/utils/php-executor.ts
// Execute PHP scripts via HTTP request to WordPress container

interface PhpExecutorOptions {
  script: string;
  queryParams?: Record<string, string | number | boolean>;
  method?: 'GET' | 'POST';
  body?: any;
}

/**
 * Execute PHP script via HTTP request to WordPress container
 * Calls PHP scripts through HTTP instead of PHP CLI
 */
export async function executePhpScript(options: PhpExecutorOptions): Promise<any> {
  const { script, queryParams = {}, method = 'GET', body } = options;
  
  // Build URL with query parameters for GET requests
  let url = `http://wp_app/server/api/php/${script}`;
  
  if (method === 'GET' && Object.keys(queryParams).length > 0) {
    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    url += `?${queryString}`;
  }
  
  // Log for debugging
  console.log(`[php-executor] Calling PHP script via HTTP: ${url}`);
  if (method === 'POST' && body) {
    console.log(`[php-executor] POST body:`, JSON.stringify(body).substring(0, 100) + '...');
  }
  
  try {
    const response = await fetch(url, {
      method: method,
      body: method === 'POST' ? JSON.stringify(body) : undefined,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMessage = `PHP API error (status ${response.status})`;
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.details) {
          errorMessage = errorData.details;
        }
      } catch (e) {
        if (errorText) {
          errorMessage = errorText.substring(0, 200);
        }
      }
      
      const error: any = new Error(errorMessage);
      error.statusCode = response.status;
      error.data = errorText;
      throw error;
    }
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('[php-executor] PHP API Error:', error);
    
    // Extract error message from response if available
    if (error.data) {
      try {
        const errorData = JSON.parse(error.data);
        if (errorData.error) {
          throw new Error(errorData.error);
        } else if (errorData.message) {
          throw new Error(errorData.message);
        }
      } catch (e) {
        // Not JSON, use as is
      }
    }
    
    throw error;
  }
}
