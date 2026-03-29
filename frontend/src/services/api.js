// E:\SDPPS\frontend\src\services\api.js
const API_BASE = '/api';

export const agentAPI = {
  async getStatus() {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error('Agent not running');
    return res.json();
  },

  async predict() {
    const res = await fetch(`${API_BASE}/predict`);
    if (!res.ok) throw new Error('Cannot predict yet');
    return res.json();
  },

  async getFeatures() {
    const res = await fetch(`${API_BASE}/features`);
    return res.json();
  },

  async getHistory() {
    const res = await fetch(`${API_BASE}/history`);
    return res.json();
  },

  async enableBlocking() {
    const res = await fetch(`${API_BASE}/block`, { method: 'POST' });
    return res.json();
  },

  async disableBlocking() {
    const res = await fetch(`${API_BASE}/unblock`, { method: 'POST' });
    return res.json();
  },

  async getContentHealth() {
    const res = await fetch(`${API_BASE}/content/health`);
    return res.json();
  },

  async checkContent(payload) {
    const res = await fetch(`${API_BASE}/content/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Content classification failed');
    return data;
  },
};
