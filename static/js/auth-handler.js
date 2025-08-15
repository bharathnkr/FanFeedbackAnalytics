/**
 * Auth handler for Fan Feedback Analytics
 * Handles authentication-related functionality for API requests
 */

// Function to handle API response authentication errors
function handleApiAuthError(response) {
    if (response.status === 401) {
        // Check if the response has auth error code
        return response.json().then(data => {
            if (data.code === 'AUTH_REQUIRED') {
                console.log('Authentication required, redirecting to login page');
                window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
                return Promise.reject(new Error('Authentication required'));
            }
            return Promise.reject(response);
        }).catch(err => {
            // Handle parsing errors for 401 responses
            return Promise.reject(new Error(`Authentication error: ${response.status}`));
        });
    }
    
    if (response.status === 500) {
        console.error('Server error occurred:', response.statusText);
        return Promise.reject(new Error(`Server error: ${response.status}. Check server logs for details.`));
    }
    
    if (!response.ok) {
        return Promise.reject(new Error(`HTTP error! Status: ${response.status}`));
    }
    
    return response;
}

// Enhanced fetch function that handles auth errors
function fetchWithAuth(url, options = {}) {
    return fetch(url, options)
        .then(handleApiAuthError)
        .then(response => response.json())
        .catch(error => {
            console.error(`Error fetching ${url}:`, error);
            throw error; // Re-throw the error for the calling function to handle
        });
}
