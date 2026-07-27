const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Read DB
function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ urls: [] }, null, 2));
      return { urls: [] };
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data || '{"urls":[]}');
  } catch (error) {
    console.error('Error reading database file:', error);
    return { urls: [] };
  }
}

// Helper: Write DB
function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing database file:', error);
  }
}

// Helper: Generate a unique random short code (Base62 format)
function generateShortCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper: Validate URL format
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// API: Get all URLs
app.get('/api/urls', (req, res) => {
  const db = readDb();
  // Sort URLs by creation date (newest first)
  const sortedUrls = [...db.urls].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sortedUrls);
});

// API: Shorten a URL
app.post('/api/shorten', (req, res) => {
  let { longUrl, customAlias, expiresAt } = req.body;

  if (!longUrl) {
    return res.status(400).json({ error: 'Long URL is required.' });
  }

  // Prepend protocol if missing
  if (!/^https?:\/\//i.test(longUrl)) {
    longUrl = 'https://' + longUrl;
  }

  if (!isValidUrl(longUrl)) {
    return res.status(400).json({ error: 'Please enter a valid HTTP or HTTPS URL.' });
  }

  const db = readDb();

  let code = '';
  if (customAlias) {
    // Sanitize and validate alias
    const sanitizedAlias = customAlias.trim().replace(/[^a-zA-Z0-9-_]/g, '');
    
    if (sanitizedAlias.length < 3) {
      return res.status(400).json({ error: 'Custom alias must be at least 3 characters long and alphanumeric.' });
    }

    // Reserved paths checks
    const reserved = ['api', 'public', 'static', 'assets', 'favicon.ico'];
    if (reserved.includes(sanitizedAlias.toLowerCase())) {
      return res.status(400).json({ error: 'This custom alias is reserved and cannot be used.' });
    }

    // Check if alias is already in use
    const exists = db.urls.some(u => u.code.toLowerCase() === sanitizedAlias.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: 'Custom alias is already in use. Please try another one.' });
    }

    code = sanitizedAlias;
  } else {
    // Generate unique short code
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      code = generateShortCode();
      isUnique = !db.urls.some(u => u.code === code);
      attempts++;
    }
    if (!isUnique) {
      return res.status(500).json({ error: 'Failed to generate a unique short code. Please try again.' });
    }
  }

  // Handle expiration validation
  let expirationDate = null;
  if (expiresAt) {
    expirationDate = new Date(expiresAt);
    if (isNaN(expirationDate.getTime()) || expirationDate <= new Date()) {
      return res.status(400).json({ error: 'Expiration date must be in the future.' });
    }
  }

  const newUrl = {
    code,
    longUrl,
    customAlias: customAlias ? code : null,
    createdAt: new Date().toISOString(),
    expiresAt: expirationDate ? expirationDate.toISOString() : null,
    clicks: 0,
    isActive: true,
    clicksHistory: []
  };

  db.urls.push(newUrl);
  writeDb(db);

  res.status(201).json(newUrl);
});

// API: Toggle URL active status
app.patch('/api/urls/:code/toggle', (req, res) => {
  const { code } = req.params;
  const db = readDb();
  const index = db.urls.findIndex(u => u.code === code);

  if (index === -1) {
    return res.status(404).json({ error: 'URL not found.' });
  }

  db.urls[index].isActive = !db.urls[index].isActive;
  writeDb(db);

  res.json(db.urls[index]);
});

// API: Delete URL
app.delete('/api/urls/:code', (req, res) => {
  const { code } = req.params;
  const db = readDb();
  const index = db.urls.findIndex(u => u.code === code);

  if (index === -1) {
    return res.status(404).json({ error: 'URL not found.' });
  }

  db.urls.splice(index, 1);
  writeDb(db);

  res.json({ success: true, message: 'URL successfully deleted.' });
});

// Redirection handler: GET /:code
app.get('/:code', (req, res) => {
  const { code } = req.params;
  
  // Skip public assets or reserved endpoints that somehow hit this
  if (code === 'favicon.ico') {
    return res.status(404).end();
  }

  const db = readDb();
  const urlRecord = db.urls.find(u => u.code === code);

  if (!urlRecord) {
    return res.status(404).send(getErrorPage('URL Not Found', 'The shortened link you are trying to access does not exist or has been deleted.'));
  }

  // Check if active
  if (!urlRecord.isActive) {
    return res.status(410).send(getErrorPage('Link Deactivated', 'This shortened link has been deactivated by the owner.', urlRecord.longUrl));
  }

  // Check expiration
  if (urlRecord.expiresAt) {
    const expired = new Date(urlRecord.expiresAt) < new Date();
    if (expired) {
      return res.status(410).send(getErrorPage('Link Expired', `This shortened link expired on ${new Date(urlRecord.expiresAt).toLocaleString()}.`, urlRecord.longUrl));
    }
  }

  // Record Click Analytics
  urlRecord.clicks += 1;
  if (!urlRecord.clicksHistory) {
    urlRecord.clicksHistory = [];
  }
  
  // Record click details
  urlRecord.clicksHistory.push({
    timestamp: new Date().toISOString(),
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown'
  });

  // Save changes
  writeDb(db);

  // Redirect
  res.redirect(urlRecord.longUrl);
});

// Custom Elegant Error Page Template
function getErrorPage(title, message, originalUrl = '') {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} | SwiftLink</title>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Space Grotesk', sans-serif;
          background: radial-gradient(circle at center, #1e1b4b 0%, #0f172a 100%);
          color: #f8fafc;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .container {
          max-width: 480px;
          width: 90%;
          text-align: center;
          background: rgba(30, 41, 59, 0.4);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 40px 30px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          animation: scaleIn 0.5s ease-out;
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          background: radial-gradient(135deg, #a855f7 0%, #6366f1 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
        }
        h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 12px;
          background: linear-gradient(to right, #f8fafc, #cbd5e1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        p {
          color: #94a3b8;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .btn {
          display: inline-block;
          background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
          color: white;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 600;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
        }
        .original-url {
          margin-top: 20px;
          word-break: break-all;
          font-size: 12px;
          color: #64748b;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">⚠️</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="/" class="btn">Back to Dashboard</a>
        ${originalUrl ? `<div class="original-url">Target URL: ${originalUrl}</div>` : ''}
      </div>
    </body>
    </html>
  `;
}

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser.`);
});
