// Proxy all WordPress requests to external WordPress instance
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  
  // Get environment variables directly (they should be available at runtime)
  const wpMediaHost = process.env.WP_MEDIA_HOST || config.wpMediaHost || '';
  const baseUrl = process.env.BASE_URL || config.baseUrl || 'http://localhost/yardsale_thailand';
  
  // Get the WordPress base URL
  let wpBaseUrl = wpMediaHost || baseUrl;
  
  // Ensure it doesn't end with a slash
  wpBaseUrl = wpBaseUrl.replace(/\/$/, '');
  
  // If wpMediaHost is set, use it directly, otherwise append /wordpress
  const wpUrl = wpMediaHost 
    ? wpBaseUrl 
    : `${wpBaseUrl}/wordpress`;
  
  // Get the path after /wordpress (handle both with and without trailing slash)
  let path = event.path.replace(/^\/wordpress\/?/, '') || '/';
  // Ensure path starts with /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  // Get query string if present
  const queryString = getQuery(event);
  const queryParams = new URLSearchParams(queryString as Record<string, string>).toString();
  
  // Build the target URL
  const finalUrl = queryParams ? `${wpUrl}${path}?${queryParams}` : `${wpUrl}${path}`;
  
  // Log for debugging (remove in production if needed)
  console.log(`[WordPress Proxy] Config - wpMediaHost: ${wpMediaHost}, baseUrl: ${baseUrl}`);
  console.log(`[WordPress Proxy] Proxying ${event.method} ${event.path} to ${finalUrl}`);
  
  try {
    // Forward the request to WordPress
    const response = await fetch(finalUrl, {
      method: event.method,
      headers: {
        ...Object.fromEntries(
          Object.entries(getHeaders(event)).filter(([key]) => 
            !['host', 'connection', 'content-length'].includes(key.toLowerCase())
          )
        ),
        // Add basic auth if configured
        ...(config.wpBasicAuth ? { 'Authorization': `Basic ${config.wpBasicAuth}` } : {}),
      },
      body: event.method !== 'GET' && event.method !== 'HEAD' 
        ? await readRawBody(event).catch(() => null)
        : undefined,
    });
    
    // Get response body
    const body = await response.arrayBuffer();
    
    // Set response headers (exclude some that shouldn't be forwarded)
    const headersToExclude = ['connection', 'transfer-encoding', 'content-encoding'];
    response.headers.forEach((value, key) => {
      if (!headersToExclude.includes(key.toLowerCase())) {
        setHeader(event, key, value);
      }
    });
    
    // Set status code
    setResponseStatus(event, response.status);
    
    // Return the response
    return new Uint8Array(body);
  } catch (error: any) {
    console.error(`[WordPress Proxy] Error proxying to ${finalUrl}:`, error);
    
    // Provide more helpful error message
    const errorMessage = error?.message || String(error);
    const isConnectionError = errorMessage.includes('ECONNREFUSED') || 
                             errorMessage.includes('ENOTFOUND') ||
                             errorMessage.includes('fetch failed');
    
    throw createError({
      statusCode: 502,
      statusMessage: 'Bad Gateway',
      message: isConnectionError 
        ? `Cannot connect to WordPress at ${finalUrl}. Please check that WordPress is running and WP_MEDIA_HOST/BASE_URL environment variables are correct.`
        : `Failed to proxy request to WordPress: ${errorMessage}`,
    });
  }
});
