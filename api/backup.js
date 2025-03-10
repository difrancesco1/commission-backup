import { backupFirestore } from '../utils/backup-utils';
import { db } from '../utils/firebase';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const backupPath = await backupFirestore(db);
        res.status(200).json({ success: true, path: backupPath });
    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}