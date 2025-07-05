// API configuration that works in both development and production
const getApiBaseUrl = () => {
  // In production, use relative URLs (same domain/port as the frontend)
  if (import.meta.env.PROD) {
    return '';
  }
  
  // In development, use the development server URL
  // You can adjust this port if needed for your dev setup
  return 'http://localhost:3001';
};

export const API_BASE_URL = getApiBaseUrl();

// Supabase configuration
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
};

console.log('🔧 API Base URL configured:', API_BASE_URL || 'relative URLs');
console.log('🔧 Supabase URL configured:', SUPABASE_CONFIG.url); 