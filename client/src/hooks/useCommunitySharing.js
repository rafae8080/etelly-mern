import { useState, useCallback, useEffect } from "react";
import { API_BASE, authHeaders } from "../components/community/helpers";
import { connectSocket } from "../utils/socket";

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

    // Real-time: keep the admin view in sync without a manual refresh.
    // community_request_updated covers matched / fulfilled / cancelled /
    // released / withdrawn; new_pledge (admin-room) updates offer counts.
    const socket = connectSocket();
    const joinAdmin = () => socket.emit("join_admin");
    joinAdmin();
    socket.on("connect", joinAdmin); // re-join after a reconnect

    socket.on("new_community_request", fetchRequests);
    socket.on("community_request_updated", fetchRequests);
    socket.on("new_pledge", fetchRequests);

    return () => {
      socket.off("connect", joinAdmin);
      socket.off("new_community_request", fetchRequests);
      socket.off("community_request_updated", fetchRequests);
      socket.off("new_pledge", fetchRequests);
    };
  }, [fetchRequests]);

  return {
    requests,
    reqLoading,
    reqError,
    fetchRequests,
  };
}
