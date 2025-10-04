const express = require('express');

module.exports = (db, requireAuth) => {
    const router = express.Router();

    router.get('/masini/:id/echipamente', requireAuth, (req, res) => {
        const masinaId = req.params.id;
        
        db.all(
            `SELECT * FROM echipamente WHERE masina_id = ? ORDER BY data_expirare ASC`,
            [masinaId],
            (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ echipamente: rows });
            }
        );
    });

    router.post('/masini/:id/echipamente', requireAuth, (req, res) => {
        const masinaId = req.params.id;
        const { tip_echipament, data_expirare, observatii } = req.body;
        
        if (!tip_echipament) {
            return res.status(400).json({ error: 'Tip echipament este obligatoriu' });
        }
        
        db.run(
            `INSERT INTO echipamente (masina_id, tip_echipament, data_expirare, observatii) 
             VALUES (?, ?, ?, ?)`,
            [masinaId, tip_echipament, data_expirare, observatii],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ 
                    success: true,
                    message: 'Echipament înregistrat cu succes!',
                    id: this.lastID 
                });
            }
        );
    });

    return router;
};