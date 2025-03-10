import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

// Convert Firestore timestamps to ISO strings
export function convertTimestamps(obj) {
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

export function generateHtmlContent(collections) {
    let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Firestore Backup</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .back-link {
      display: inline-block;
      margin-bottom: 20px;
      color: #0066cc;
      text-decoration: none;
    }
    .collection {
      margin-bottom: 40px;
      border: 1px solid #eee;
      border-radius: 5px;
      padding: 20px;
    }
    .document {
      margin-bottom: 20px;
      background-color: #f9f9f9;
      border-radius: 5px;
      padding: 15px;
    }
    .document-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .badges {
      display: flex;
      gap: 5px;
    }
    .status {
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 12px;
      background-color: #eee;
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
      background-color: #d1ecf1;
      color: #0c5460;
    }
    .completed {
      background-color: #c3e6cb;
      color: #155724;
    }
    pre {
      background-color: #f8f9fa;
      border: 1px solid #eee;
      border-radius: 3px;
      padding: 10px;
      overflow: auto;
      font-size: 13px;
    }
    .search {
      width: 100%;
      padding: 10px;
      margin-bottom: 20px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .nav {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .nav a {
      padding: 5px 10px;
      background-color: #f0f0f0;
      border-radius: 4px;
      text-decoration: none;
      color: #333;
    }
    .hidden {
      display: none;
    }
    .timestamp {
      margin-top: 20px;
      font-size: 12px;
      color: #777;
      text-align: center;
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
  <a href="/" class="back-link">← Back to Backup List</a>
  <h1>Firestore Backup</h1>
  <p>Backup created on: ${new Date().toLocaleString()}</p>
  
  <input type="text" id="search" class="search" placeholder="Search documents..." onkeyup="filterDocuments()">
  
  <div class="nav">
    ${Object.keys(collections).map(coll => `<a href="#${coll}">${coll}</a>`).join('')}
  </div>
`;

    // Process each collection
    for (const [collectionName, collectionData] of Object.entries(collections)) {
        htmlContent += `
  <div class="collection" id="${collectionName}">
    <h2>${collectionName} (${Object.keys(collectionData).length} documents)</h2>
`;

        // Add each document
        for (const [docId, docData] of Object.entries(collectionData)) {
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

    return htmlContent;
}

// Main backup function
export async function backupFirestore(db) {
    console.log('Starting Firestore backup...');

    // Create a timestamp for the backup
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupId = `backup-${timestamp}`;

    // Collections to backup
    const collectionsToBackup = ['commissions'];

    // Object to store all collection data
    const backupData = {};

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

        backupData[collectionName] = collectionData;
        console.log(`Processed ${querySnapshot.size} documents from ${collectionName}`);
    }

    // Get Firebase Storage from our centralized firebase.js
    const { storage } = await import('./firebase');

    // Save JSON data to Firebase Storage
    const jsonData = JSON.stringify(backupData, null, 2);
    const jsonRef = ref(storage, `backups/${backupId}/data.json`);
    await uploadString(jsonRef, jsonData, 'raw');

    // Generate and save HTML view
    const htmlContent = generateHtmlContent(backupData);
    const htmlRef = ref(storage, `backups/${backupId}/index.html`);
    await uploadString(htmlRef, htmlContent, 'raw');

    // Get the HTML URL to return
    const htmlUrl = await getDownloadURL(htmlRef);

    console.log(`Backup completed successfully! Files saved to Firebase Storage`);

    // Return the backup information
    return {
        id: backupId,
        url: htmlUrl,
        timestamp: new Date().toISOString()
    };
}