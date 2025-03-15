// utils/api.js
export async function apiRequest(endpoint, options = {}) {
    try {
      const { method = 'GET', body, params = {} } = options;
      
      // Build URL with query parameters
      const url = new URL(`/api/${endpoint}`, window.location.origin);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });
      
      // Prepare request options
      const requestOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      
      // Add body for non-GET requests
      if (body && method !== 'GET') {
        requestOptions.body = JSON.stringify(body);
      }
      
      // Make the request
      const response = await fetch(url.toString(), requestOptions);
      
      // Handle non-2xx responses
      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `HTTP error ${response.status}`,
        }));
        throw new Error(error.message || `Request failed with status ${response.status}`);
      }
      
      // Parse the JSON response
      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }