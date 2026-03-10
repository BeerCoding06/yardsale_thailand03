// server/routes/wordpress/[...].ts
// Proxy WordPress REST API requests

export default defineEventHandler(async (event) => {
  // Get WordPress base URL
  const wpBaseUrl = process.env.WP_BASE_URL || 'https://cms.yardsaleth.com';
  
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
    
    // Get response body (use arrayBuffer for images/binary)
    // fetch() in Node decompresses automatically, so body is already decoded
    const contentType = response.headers.get('content-type') || '';
    const isBinary = /^image\//.test(contentType) || contentType.includes('octet-stream');
    const body = isBinary ? await response.arrayBuffer() : await response.text();
    
    // Copy response headers but REMOVE content-encoding (and content-length).
    // We send the decoded body, so browser must not try to decompress again → fixes ERR_CONTENT_DECODING_FAILED
    const skipHeaders = ['content-encoding', 'content-length', 'transfer-encoding'];
    response.headers.forEach((value, key) => {
      if (skipHeaders.includes(key.toLowerCase())) return;
      setHeader(event, key, value);
    });
    
    return body;
  } catch (error: any) {
    console.error('[wordpress-proxy] Error:', error);
    throw createError({
      statusCode: 500,
      message: `Failed to proxy WordPress request: ${error.message}`,
    });
  }
});
