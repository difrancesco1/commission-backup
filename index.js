const { initializeApp } = require('firebase/app');
const {
    getFirestore,
    collection,
    getDocs,
    query,
    orderBy
} = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyARxMYqLwydJpwYOMAU83JpBSo03mOX8dw",
    authDomain: "commissions-app-c6e2c.firebaseapp.com",
    projectId: "commissions-app-c6e2c",
    storageBucket: "commissions-app-c6e2c.firebasestorage.app",
    messagingSenderId: "958861552351",
    appId: "1:958861552351:web:057416d2949bdc9681576a",
    measurementId: "G-218D0VTQ2W"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Serve static files
app.use(express.static('public'));
app.use('/backups', express.static('backups'));

// Root route - serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to trigger backup
app.get('/api/backup', async (req, res) => {
    try {
        const backupPath = await backupFirestore();
        res.json({ success: true, path: backupPath });
    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint to list available backups
app.get('/api/backups', (req, res) => {
    const backupsDir = path.join(__dirname, 'backups');

    if (!fs.existsSync(backupsDir)) {
        return res.json({ backups: [] });
    }

    const backups = fs.readdirSync(backupsDir)
        .filter(file => fs.statSync(path.join(backupsDir, file)).isDirectory())
        .map(dir => {
            const stats = fs.statSync(path.join(backupsDir, dir));
            return {
                name: dir,
                created: stats.birthtime,
                path: `/backups/${dir}/index.html`
            };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({ backups });
});

// Main backup function
async function backupFirestore() {
    // Create backups directory if it doesn't exist
    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
    }

    // Create backup directory with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupDir = path.join(backupsDir, `backup-${timestamp}`);
    fs.mkdirSync(backupDir, { recursive: true });

    console.log('Starting Firestore backup...');

    // Collections to backup
    const collectionsToBackup = ['commissions'];

    // Process each collection
    for (const collectionName of collectionsToBackup) {
        console.log(`Backing up collection: ${collectionName}`);

        // Query the collection
        const q = query(
            collection(db, collectionName),
            orderBy("ARCHIVE"),
            orderBy("PAID", "desc"),
            orderBy("DUE")
        );

        const querySnapshot = await getDocs(q);

        // Create data object
        const collectionData = {};
        querySnapshot.forEach((doc) => {
            // Convert any Firestore timestamps to ISO strings
            const data = convertTimestamps(doc.data());
            collectionData[doc.id] = {
                id: doc.id,
                ...data
            };
        });

        // Save to JSON file
        const filePath = path.join(backupDir, `${collectionName}.json`);
        fs.writeFileSync(
            filePath,
            JSON.stringify(collectionData, null, 2),
            'utf8'
        );

        console.log(`Saved ${querySnapshot.size} documents from ${collectionName} to ${filePath}`);
    }

    // Generate HTML view
    generateHtmlView(backupDir);

    console.log(`Backup completed successfully! Files saved to: ${backupDir}`);
    return `/backups/${path.basename(backupDir)}/index.html`;
}

// Convert Firestore timestamps to ISO strings
function convertTimestamps(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const result = {};

    for (const [key, value] of Object.entries(obj)) {
        // Check if value is a Firestore timestamp (has toDate method)
        if (value && typeof value === 'object' && typeof value.toDate === 'function') {
            result[key] = value.toDate().toISOString();
        }
        // Handle nested objects and arrays
        else if (Array.isArray(value)) {
            result[key] = value.map(item => convertTimestamps(item));
        }
        else if (value && typeof value === 'object') {
            result[key] = convertTimestamps(value);
        }
        else {
            result[key] = value;
        }
    }

    return result;
}

function generateHtmlView(backupDir) {
    const htmlFilePath = path.join(backupDir, 'index.html');
    const collections = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));

    let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Firestore Backup</title>
  <style>
    /* Main Variables */
    :root {
      --primary-color: #5d5cd6;
      --primary-hover: #4a49c0;
      --success-bg: #d4edda;
      --success-text: #155724;
      --error-bg: #f8d7da;
      --error-text: #721c24;
      --card-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      --border-radius: 5px;
    }

    /* Base Styles */
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      color: #333;
      background-color: #f8f9fa;
      min-height: 100vh;
    }

    /* Container */
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Header */
    h1 {
      margin-top: 0;
      color: #444;
      border-bottom: 1px solid #ddd;
      padding-bottom: 10px;
    }

    /* Back Link */
    .back-link {
      display: inline-block;
      margin-bottom: 20px;
      color: var(--primary-color);
      text-decoration: none;
      font-weight: 500;
    }
    .back-link:hover {
      text-decoration: underline;
    }

    /* Navigation */
    .nav {
      position: sticky;
      top: 0;
      background-color: #fff;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: var(--border-radius);
      border: 1px solid #ddd;
      z-index: 100;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      box-shadow: var(--card-shadow);
    }
    .nav a {
      color: var(--primary-color);
      text-decoration: none;
      padding: 6px 12px;
      border-radius: 20px;
      background-color: #f0f2f5;
      transition: background-color 0.2s;
    }
    .nav a:hover {
      background-color: #e4e6f0;
    }

    /* Search */
    .search {
      width: 100%;
      padding: 12px;
      margin-bottom: 20px;
      border: 1px solid #ddd;
      border-radius: var(--border-radius);
      box-sizing: border-box;
      font-size: 16px;
    }
    
    /* Collection */
    .collection {
      background-color: white;
      border-radius: var(--border-radius);
      padding: 20px;
      margin-bottom: 30px;
      box-shadow: var(--card-shadow);
    }
    .collection h2 {
      margin-top: 0;
      color: #444;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }

    /* Document */
    .document {
      background-color: #f8f9fa;
      border-radius: var(--border-radius);
      padding: 15px;
      margin-bottom: 20px;
      border: 1px solid #eee;
    }
    .document-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .document h3 {
      margin: 0;
      color: #444;
    }

    /* Status Badges */
    .badges {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
    }
    .status {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .paid {
      background-color: #d4edda;
      color: #155724;
    }
    .pending {
      background-color: #fff3cd;
      color: #856404;
    }
    .archived {
      background-color: #f8d7da;
      color: #721c24;
    }
    .completed {
      background-color: #cce5ff;
      color: #004085;
    }

    /* JSON Content */
    pre {
      background-color: #f4f5f8;
      padding: 15px;
      border-radius: var(--border-radius);
      overflow-x: auto;
      font-family: monospace;
      font-size: 14px;
      line-height: 1.4;
      border: 1px solid #eee;
    }

    /* Footer */
    .timestamp {
      text-align: center;
      font-size: 0.85em;
      color: #888;
      margin-top: 30px;
    }

    /* Utilities */
    .hidden {
      display: none;
    }

    /* Media Queries */
    @media (max-width: 768px) {
      .document-header {
        flex-direction: column;
        align-items: flex-start;
      }
      .badges {
        margin-top: 10px;
      }
    }
  </style>
  <script>
    function filterDocuments() {
      const searchTerm = document.getElementById('search').value.toLowerCase();
      const documents = document.querySelectorAll('.document');
      
      documents.forEach(doc => {
        const text = doc.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
          doc.classList.remove('hidden');
        } else {
          doc.classList.add('hidden');
        }
      });
    }
  </script>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">← Back to Backup List</a>
    <h1>Firestore Backup</h1>
    <p>Backup created on: ${new Date().toLocaleString()}</p>
    
    <input type="text" id="search" class="search" placeholder="Search documents..." onkeyup="filterDocuments()">
    
    <div class="nav">
      ${collections.map(coll => `<a href="#${coll}">${coll}</a>`).join('')}
    </div>
`;

    for (const collectionName of collections) {
        const filePath = path.join(backupDir, `${collectionName}.json`);
        const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        htmlContent += `
    <div class="collection" id="${collectionName}">
      <h2>${collectionName} (${Object.keys(jsonData).length} documents)</h2>
`;

        for (const [docId, docData] of Object.entries(jsonData)) {
            if (collectionName === 'commissions') {
                const isPaid = docData.PAID === true;
                const isArchived = docData.ARCHIVE === true;
                const isCompleted = docData.COMPLETE === true;

                htmlContent += `
      <div class="document">
        <div class="document-header">
          <h3>${docData.TWITTER || docId}</h3>
          <div class="badges">
            ${isPaid ? '<span class="status paid">Paid</span>' : '<span class="status pending">Pending</span>'}
            ${isArchived ? '<span class="status archived">Archived</span>' : ''}
            ${isCompleted ? '<span class="status completed">Completed</span>' : ''}
            ${docData.COMPLEX ? '<span class="status">★ Complex</span>' : ''}
          </div>
        </div>
        <pre>${JSON.stringify(docData, null, 2)}</pre>
      </div>`;
            } else {
                htmlContent += `
      <div class="document">
        <div class="document-header">
          <h3>${docId}</h3>
        </div>
        <pre>${JSON.stringify(docData, null, 2)}</pre>
      </div>`;
            }
        }

        htmlContent += `
    </div>`;
    }

    htmlContent += `
    <div class="timestamp">Generated on ${new Date().toLocaleString()}</div>
  </div>
</body>
</html>
`;

    fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');
    console.log(`Generated HTML view at: ${htmlFilePath}`);
}

// Start the server
app.listen(port, () => {
    console.log(`Firestore Backup App running at http://localhost:${port}`);
});