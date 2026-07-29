const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' || 
   window.location.hostname.startsWith('192.168.'));

export const BACKEND_URL = import.meta.env.VITE_API_URL || 
  (isLocalhost ? "http://localhost:8000" : "https://options-api-m098.onrender.com");
