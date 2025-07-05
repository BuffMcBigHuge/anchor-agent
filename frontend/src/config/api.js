// API configuration that works in both development and production
const getApiBaseUrl = () => {
  // In production, use relative URLs (same domain/port as the frontend)
  if (import.meta.env.PROD) {
    return '';
  }
  
  // In development, use the development server URL
  // You can adjust this port if needed for your dev setup
  return 'http://localhost:3000';
};

export const API_BASE_URL = getApiBaseUrl();

// Supabase configuration
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

console.log('🔧 API Base URL configured:', API_BASE_URL || 'relative URLs');
console.log('🔧 Supabase URL configured:', SUPABASE_CONFIG.url); 