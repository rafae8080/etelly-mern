const res = await fetch("http://localhost:5000/api/reports/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userName: "rafael",
    emergencyType: "fire",
    severity: "high",
    description: "isa pang test ",
    source: "direct_wifi",
    offlineSubmittedAt: "2025-05-23T10:00:00.000Z",
    barangay: "Bagong Nayon",
  }),
});
const data = await res.json();
console.log(data);
