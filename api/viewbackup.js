import { db } from '../utils/firebase';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ success: false, error: 'Backup ID is required' });
    }

    try {
        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Backup: ${id}</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <a href="/" class="back-link">← Back to Backup List</a>
        <h1>Firestore Backup</h1>
        <p>Backup ID: ${id}</p>
        
        <div class="collection">
          <h2>Sample Data (Mockup)</h2>
          <p>This is a placeholder. In a real implementation, this would show actual backup data.</p>
        </div>
      </body>
      </html>
    `;

        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(html);
    } catch (error) {
        console.error('Error viewing backup:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}