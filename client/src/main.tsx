import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient.js';
import App from './App.js';
import './index.css';

import { hydrateQueryCacheFromStorage } from './services/prefetch.js';

// Instant 0ms cache hydration from local disk
hydrateQueryCacheFromStorage();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);

