import { useState, useCallback, useEffect } from "react";
import {
  SAMPLE_REQUESTS,
  SAMPLE_DONATIONS,
} from "../components/community/sampleData";
import { API_BASE, authHeaders } from "../components/community/helpers";

// TODO: replace SAMPLE_REQUESTS/SAMPLE_DONATIONS with [] once the backend is wired up

export function useCommunitySharing() {
  const [requests, setRequests] = useState([]);
  const [donations, setDonations] = useState([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [donLoading, setDonLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/community/requests`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) setRequests(data.requests);
    } catch {
    } finally {
      setReqLoading(false);
    }
  }, []);

  const fetchDonations = useCallback(async () => {
    setDonLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/community/donations`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) setDonations(data.donations);
    } catch {
    } finally {
      setDonLoading(false);
    }
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
    fetchRequests,
    fetchDonations,
  };
}
