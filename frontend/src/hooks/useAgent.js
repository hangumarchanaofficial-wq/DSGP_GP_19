import { useState, useEffect, useCallback } from 'react';
import { agentAPI } from '../services/api';

export function useAgent(pollInterval = 5000) {
  const [status, setStatus] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [blockerApps, setBlockerApps] = useState({
    blocked_apps: [],
    auto_blocked_apps: [],
    effective_blocked_apps: [],
    distracted_apps: [],
  });

  const normalizeBlockerApps = useCallback((data) => ({
    blocked_apps: Array.isArray(data?.blocked_apps) ? data.blocked_apps : [],
    auto_blocked_apps: Array.isArray(data?.auto_blocked_apps) ? data.auto_blocked_apps : [],
    effective_blocked_apps: Array.isArray(data?.effective_blocked_apps) ? data.effective_blocked_apps : [],
    distracted_apps: Array.isArray(data?.distracted_apps) ? data.distracted_apps : [],
  }), []);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await agentAPI.getStatus();
      setStatus(data);
      setConnected(true);
      setError(null);
    } catch (err) {
      setConnected(false);
      setError('Agent not running');
      setStatus(null);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await agentAPI.getHistory();
      if (Array.isArray(data)) setHistory(data);
    } catch (_) {
      // History is optional for the live dashboard.
    }
  }, []);

  const fetchBlockerApps = useCallback(async () => {
    try {
      const data = await agentAPI.getBlockerApps();
      setBlockerApps(normalizeBlockerApps(data));
    } catch (_) {
      // Blocker app summaries are optional until the backend is ready.
    }
  }, [normalizeBlockerApps]);

  useEffect(() => {
    fetchStatus();
    fetchHistory();
    fetchBlockerApps();

    const interval = setInterval(() => {
      fetchStatus();
      fetchHistory();
      fetchBlockerApps();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchHistory, fetchBlockerApps, pollInterval]);

  const toggleBlocking = useCallback(async () => {
    if (!status) return;
    try {
      if (status.blocker?.is_blocking) {
        await agentAPI.disableBlocking();
      } else {
        await agentAPI.enableBlocking();
      }
      await fetchStatus();
      await fetchBlockerApps();
    } catch (err) {
      setError('Failed to toggle blocking');
    }
  }, [fetchBlockerApps, fetchStatus, status]);

  const updateBlockedApp = useCallback(async (appName, action) => {
    try {
      const result = await agentAPI.updateBlockedApp(appName, action);
      setBlockerApps(normalizeBlockerApps(result));
      await fetchStatus();
      return result;
    } catch (err) {
      setError('Failed to update blocked app');
      throw err;
    }
  }, [fetchStatus, normalizeBlockerApps]);

  const updateBlockerSettings = useCallback(async (payload) => {
    try {
      const result = await agentAPI.updateBlockerSettings(payload);
      await fetchStatus();
      await fetchBlockerApps();
      return result;
    } catch (err) {
      setError('Failed to update blocker settings');
      throw err;
    }
  }, [fetchBlockerApps, fetchStatus]);

  const forcePrediction = async () => {
    try {
      const result = await agentAPI.predict();
      await fetchStatus();
      await fetchHistory();
      await fetchBlockerApps();
      return result;
    } catch (err) {
      setError('Cannot predict — not enough data yet');
      return null;
    }
  };

  return {
    status,
    connected,
    error,
    history,
    blockerApps,
    windowCurrent: status?.window_current ?? 0,
    windowSize: status?.window_size ?? 10,
    snapshots: status?.snapshots ?? 0,
    prediction: status?.prediction ?? null,
    blocker: status?.blocker ?? null,
    contentClassifier: status?.content_classifier ?? null,
    toggleBlocking,
    updateBlockedApp,
    updateBlockerSettings,
    forcePrediction,
    refresh: fetchStatus,
  };
}
