import { useState, useCallback, useEffect } from "react";
import { API_BASE, authHeaders } from "../components/community/helpers";

export function useCommunitySharing() {
  const [requests, setRequests] = useState([]);
  const [donations, setDonations] = useState([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [donLoading, setDonLoading] = useState(true);
  const [reqError, setReqError] = useState(null);
  const [donError, setDonError] = useState(null);

  // Community board (public anonymized view)
  const [board, setBoard] = useState({ requests: [], donations: [] });
  const [boardLoading, setBoardLoading] = useState(false);

  // Message threads keyed by requestId
  const [messages, setMessages] = useState({});
  const [messagesLoading, setMessagesLoading] = useState(false);

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

  const fetchDonations = useCallback(async () => {
    setDonLoading(true);
    setDonError(null);
    try {
      const res = await fetch(`${API_BASE}/api/community/donations`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) setDonations(data.donations);
    } catch (err) {
      setDonError(err.message);
    } finally {
      setDonLoading(false);
    }
  }, []);

  const fetchBoard = useCallback(async (barangay = "") => {
    setBoardLoading(true);
    try {
      const qs = barangay ? `?barangay=${encodeURIComponent(barangay)}` : "";
      const res = await fetch(`${API_BASE}/api/community/board${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) setBoard({ requests: data.requests, donations: data.donations });
    } catch {
      // non-fatal
    } finally {
      setBoardLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (requestId) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/community/requests/${requestId}/messages`,
        { headers: authHeaders() },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => ({ ...prev, [requestId]: data.messages }));
      }
    } catch {
      // non-fatal
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (requestId, text) => {
    const res = await fetch(
      `${API_BASE}/api/community/requests/${requestId}/messages`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ text }),
      },
    );
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to send.");
    setMessages((prev) => ({
      ...prev,
      [requestId]: [...(prev[requestId] || []), data.message],
    }));
    return data.message;
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchDonations();
  }, [fetchRequests, fetchDonations]);

  return {
    requests,
    donations,
    reqLoading,
    donLoading,
    reqError,
    donError,
    fetchRequests,
    fetchDonations,
    board,
    boardLoading,
    fetchBoard,
    messages,
    messagesLoading,
    fetchMessages,
    sendMessage,
  };
}
