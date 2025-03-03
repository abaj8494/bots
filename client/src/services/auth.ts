/**
 * Authentication service utility functions
 */

/**
 * Get the authentication token from local storage
 * @returns The authentication token or null if not found
 */
export const getToken = (): string | null => {
  return localStorage.getItem('token');
};

/**
 * Set the authentication token in local storage
 * @param token The token to set
 */
export const setToken = (token: string): void => {
  localStorage.setItem('token', token);
};

/**
 * Remove the authentication token from local storage
 */
export const removeToken = (): void => {
  localStorage.removeItem('token');
};

/**
 * Check if the user is authenticated
 * @returns Whether the user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!getToken();
}; 