# E-Telly Barangay Hall — Offline Setup Guide

This folder contains everything needed to run E-Telly offline during a disaster.

---

## First Time Setup (Do This Once)

> Only needs to be done once when the laptop is first received.

1. Plug in the USB drive
2. Open the `barangay-setup` folder
3. Double-click **`INSTALL.bat`**
4. Follow the on-screen instructions — it will install everything automatically
5. When you see **"Setup Complete!"**, the laptop is ready

---

## During a Disaster (No Internet)

Run these two files. Each one opens its own window — **do not close either window**.

### Step 1 — Start the server
Double-click **`start-local.bat`**

Wait until you see:
```
Connected to MongoDB — LOCAL (etelly_local)
Server running on port 5000
```

### Step 2 — Start the dashboard
Double-click **`start-dashboard.bat`**

Wait until you see:
```
Local:   http://localhost:5173
```

### Step 3 — Open the dashboard
Open a browser and go to:
```
http://localhost:5173
```

### Step 4 — Log in
Use your barangay credentials to log in.

You will see an amber banner at the top:
> **Local Mode Active** — Reports are stored on this device. They will sync to CDRRMO when internet is restored.

This confirms the system is running offline. Reports submitted by residents will appear here in real time.

---

## When Internet is Restored

**Do nothing.** The system automatically syncs all reports to CDRRMO within 5 minutes of detecting internet. No action required from the barangay official.

---

## WiFi Router Setup

The laptop must be connected to the barangay hall WiFi router during the disaster.

| Setting | Value |
|---------|-------|
| SSID (network name) | `ETelly-BagongNayon` |
| Laptop IP address | `192.168.1.100` (set this as fixed IP on the router) |
| Internet required | No — the router only needs power |

Residents' phones connect to this WiFi to submit reports directly to this laptop.

---

## Troubleshooting

**Dashboard shows blank / cannot connect**
- Make sure `start-local.bat` is running and shows "Server running on port 5000"
- Try refreshing the browser

**Login says incorrect password**
- Contact your system administrator to reset the local account

**Reports not appearing**
- Check that the resident's phone is connected to the `ETelly-BagongNayon` WiFi
- Try refreshing the dashboard

**Reports not syncing after internet returns**
- The sync runs every 5 minutes — wait a few minutes
- Check that the server window (`start-local.bat`) is still open

---

## Files in This Folder

| File | Purpose |
|------|---------|
| `INSTALL.bat` | One-time setup — run this first on a new laptop |
| `start-local.bat` | Starts the offline server during a disaster |
| `start-dashboard.bat` | Starts the web dashboard during a disaster |
| `README.md` | This guide |
| `installers/` | Node.js and MongoDB installers (copy from USB) |
