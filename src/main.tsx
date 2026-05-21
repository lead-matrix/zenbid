import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { campaignManager } from './lib/followUpCampaigns';

// Initialize background follow-up campaign automation listeners
campaignManager.initListeners();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
