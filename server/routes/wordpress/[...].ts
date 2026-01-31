// server/routes/wordpress/[...].ts
// Proxy WordPress REST API requests

export default defineEventHandler(async (event) => {
  // Get WordPress base URL
  const wpBaseUrl = process.env.WP_BASE_URL || 'http://157.85.98.150:8080';
  
  // Fix path handling - remove /wordpress prefix
  let path = event.path.replace(/^\/wordpress/, '') || '/';
  
  // Build full WordPress API URL
  const wpUrl = `${wpBaseUrl}${path}`;
  
  // Forward query string if present
  const queryString = new URLSearchParams(getQuery(event)).toString();
  const fullUrl = queryString ? `${wpUrl}?${queryString}` : wpUrl;
  
  console.log(`[wordpress-proxy] Proxying: ${event.path} -> ${fullUrl}`);
  
  try {
    // Forward the request to WordPress
    const response = await fetch(fullUrl, {
      method: event.method,
      headers: {
        ...Object.fromEntries(
          Object.entries(event.headers).filter(([key]) => 
            !['host', 'connection', 'content-length'].includes(key.toLowerCase())
          )
        ),
      },
      body: event.method !== 'GET' && event.method !== 'HEAD' 
        ? await readRawBody(event).catch(() => null)
        : undefined,
    });
    
    // Get response body
    const body = await response.text();
    
    // Set response headers
    response.headers.forEach((value, key) => {
      setHeader(event, key, value);
    });
    
    // Return response
    return body;
  } catch (error: any) {
    console.error('[wordpress-proxy] Error:', error);
    throw createError({
      statusCode: 500,
      message: `Failed to proxy WordPress request: ${error.message}`,
    });
  }
});
