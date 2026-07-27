# ⚡ SwiftLink - Smart URL Shortener & Click Analytics Dashboard and Timer

SwiftLink is a premium, high-fidelity URL shortener application. It is designed with a modern, dark-mode glassmorphic user interface and includes powerful link management tools, live click analytics logs, custom aliases, auto-expiration, and dynamic QR Code generation.

It features a robust **Node.js & Express** backend that handles redirection, statistics tracking, and validation, backed by a portable JSON-file database. The frontend is built using clean semantic HTML5, modern CSS3 layout systems (Grid, Flexbox, custom variables, keyframe animations, and filter glows), and reactive Vanilla JavaScript.

---

## 🌟 Key Features

- **🚀 Instant URL Shortening:** Convert long URLs into compact base62 short URLs.
- **✨ Custom Short Aliases:** Generate customized short slugs (e.g., `swift/my-resume`) with validation for branding.
- **🕒 Expiration Scheduling:** Define optional auto-expiry dates & times. The links automatically deactivate when the date passes.
- **📊 Real-time Click Analytics:** View cumulative click tallies and expand cards to read precise logs for the last 5 click events (Timestamp, IP Address, User Agent).
- **🎛️ Live Status Toggles:** Instantly activate/deactivate links using smooth interactive slider switches.
- **🖼️ QR Code Modal:** Instantly generate QR Codes for shortened URLs with client-side PNG downloads.
- **🎨 Ultra-Premium Dark Theme:** Rich design language with radial glows, custom-designed input indicators, interactive toast notifications, and backdrop filter glass panels.
- **📱 Fully Responsive:** Optimised for fluid mobile and desktop dashboard presentations.
- **📂 Zero-Configuration Database:** Stores records in `db.json` locally for out-of-the-box operation (no external databases required).

---

## 📂 Directory Structure

```text
url-shortener/
├── public/                 # Static Frontend assets served by Express
│   ├── index.html          # Dashboard structure, forms, and modals
│   ├── style.css           # Modern design theme, glassmorphic filters, and layouts
│   └── app.js              # Client state, event listeners, API binding, and canvas helpers
├── server.js               # Node.js Express server & REST API
├── db.json                 # Portably stored local JSON database
├── package.json            # Node configurations & project scripts
└── README.md               # User and developer documentation
```

---

## 🛠️ API Reference

### 1. Shorten a URL
- **Endpoint:** `POST /api/shorten`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "longUrl": "https://example.com/some/long/link/path",
    "customAlias": "my-promo", // Optional
    "expiresAt": "2026-12-31T23:59:59.000Z" // Optional
  }
  ```
- **Response:** `201 Created`

### 2. Retrieve All URL Entries
- **Endpoint:** `GET /api/urls`
- **Response:** `200 OK` (Array of URL Objects sorted by creation date descending)

### 3. Toggle Status Active / Inactive
- **Endpoint:** `PATCH /api/urls/:code/toggle`
- **Response:** `200 OK` (Returns the updated URL entry)

### 4. Delete shortened URL
- **Endpoint:** `DELETE /api/urls/:code`
- **Response:** `200 OK` (`{ "success": true }`)

### 5. URL Redirection
- **Endpoint:** `GET /:code`
- **Redirects:** Redirects to target `longUrl` and logs client details (timestamp, IP address, user agent) if the link is active.
- **Error Pages:** Beautifully handles and displays "URL Not Found", "Link Deactivated", or "Link Expired" templates if access conditions fail.

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (version 16 or higher is recommended).

### Setup and Launch

1. **Install Dependencies:**
   Run this command in your project directory to install Express and CORS:
   ```bash
   npm install
   ```

2. **Start the Server:**
   Run the start script:
   ```bash
   npm start
   ```

3. **Explore Dashboard:**
   Open your browser and navigate to:
   ```text
   http://localhost:3000
   ```

---

## 💻 Technical Details

- **Short ID Generation:** Standard base62 alphanumeric code generator.
- **Redirection Logic:** Tracks requests, performs validation, updates analytical lists synchronously, and redirects via `302 Found` to prevent browser caching of redirects (ensuring accurate click metrics).
- **Error Handling:** Features customized server-rendered styling templates for 404 and 410 HTTP statuses if URLs are inactive, missing, or expired.
