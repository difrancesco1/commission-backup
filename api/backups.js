export default function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const backups = [
            {
                name: 'backup-2025-03-10T12:00:00.000Z',
                created: new Date('2025-03-10T12:00:00.000Z'),
                path: '/api/view-backup?id=backup-2025-03-10T12:00:00.000Z'
            },
            {
                name: 'backup-2025-03-09T12:00:00.000Z',
                created: new Date('2025-03-09T12:00:00.000Z'),
                path: '/api/view-backup?id=backup-2025-03-09T12:00:00.000Z'
            }
        ];

        res.status(200).json({ backups });
    } catch (error) {
        console.error('Error listing backups:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}