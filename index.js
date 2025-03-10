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
const port = 3000;

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
    return backupDir;
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

// Generate HTML view of the data
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
  <link rel="stylesheet" href="/styles.css">
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
  <a href="/" class="back-link">← Back to Backup List</a>
  <h1>Firestore Backup</h1>
  <p>Backup created on: ${new Date().toLocaleString()}</p>
  
  <input type="text" id="search" class="search" placeholder="Search documents..." onkeyup="filterDocuments()">
  
  <div class="nav">
    ${collections.map(coll => `<a href="#${coll}">${coll}</a>`).join('')}
  </div>
`;

    // Process each collection JSON file
    for (const collectionName of collections) {
        const filePath = path.join(backupDir, `${collectionName}.json`);
        const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        htmlContent += `
  <div class="collection" id="${collectionName}">
    <h2>${collectionName} (${Object.keys(jsonData).length} documents)</h2>
`;

        // Add each document
        for (const [docId, docData] of Object.entries(jsonData)) {
            // For commissions collection, add special styling
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
                // Generic document display
                htmlContent += `
    <div class="document">
      <h3>${docId}</h3>
      <pre>${JSON.stringify(docData, null, 2)}</pre>
    </div>`;
            }
        }

        htmlContent += `
  </div>`;
    }

    htmlContent += `
  <div class="timestamp">Generated on ${new Date().toLocaleString()}</div>
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