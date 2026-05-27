import { useState, useCallback, useEffect } from "react";
import { API_BASE, authHeaders } from "../components/community/helpers";

export function useCommunitySharing() {
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [reqError, setReqError] = useState(null);

  const fetchRequests = useCallback(async () => {
    setReqLoading(true);
    setReqError(null);
    try {
      const res = await fetch(`${API_BASE}/api/community/requests`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) setRequests(data.requests);
    } catch (err) {
      setReqError(err.message);
    } finally {
      setReqLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return {
    requests,
    reqLoading,
    reqError,
    fetchRequests,
  };
}
