import { useState, useEffect, useCallback } from 'react';
import { agentAPI } from '../services/api';

export function useAgent(pollInterval = 5000) {
  const [status, setStatus] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

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
      // silently ignore — history is optional
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchHistory();
    const interval = setInterval(() => {
      fetchStatus();
      fetchHistory();
    }, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchHistory, pollInterval]);

  const toggleBlocking = async () => {
    if (!status) return;
    try {
      if (status.blocker?.is_blocking) {
        await agentAPI.disableBlocking();
      } else {
        await agentAPI.enableBlocking();
      }
      await fetchStatus();
    } catch (err) {
      setError('Failed to toggle blocking');
    }
  };

  const forcePrediction = async () => {
    try {
      const result = await agentAPI.predict();
      await fetchStatus();
      await fetchHistory();
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
    // Convenience aliases
    windowCurrent: status?.window_current ?? 0,
    windowSize: status?.window_size ?? 10,
    snapshots: status?.snapshots ?? 0,
    prediction: status?.prediction ?? null,
    blocker: status?.blocker ?? null,
    toggleBlocking,
    forcePrediction,
    refresh: fetchStatus,
  };
}
