/**
 * Response Utilities
 * Standard response formatting and CORS handling
 */

/**
 * Create a JSON response with standard headers
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...additionalHeaders,
    },
  });
}

/**
 * Create a standardized success response
 */
export function successResponse(data: unknown, status = 200): Response {
  return jsonResponse(
    {
      success: true,
      data,
      error: null,
    },
    status
  );
}

/**
 * Create a standardized error response
 */
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse(
    {
      success: false,
      data: null,
      error: {
        code: status,
        message,
      },
    },
    status
  );
}

/**
 * Generate CORS headers
 */
export function corsHeaders(allowedOrigins = "*"): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigins,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handle CORS preflight requests
 */
export function handleCORS(allowedOrigins = "*"): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(allowedOrigins),
  });
}

/**
 * Add CORS headers to an existing response
 */
export function addCORSHeaders(response: Response, allowedOrigins = "*"): Response {
  const newHeaders = new Headers(response.headers);
  const cors = corsHeaders(allowedOrigins);

  Object.entries(cors).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
