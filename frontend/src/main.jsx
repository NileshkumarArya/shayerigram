import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1a1a2e', color: '#f8f4ff', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '12px' },
            success: { iconTheme: { primary: '#8b5cf6', secondary: '#f8f4ff' } },
            error:   { iconTheme: { primary: '#f43f5e', secondary: '#f8f4ff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
