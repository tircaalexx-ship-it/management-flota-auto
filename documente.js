const express = require('express');

module.exports = (db, requireAuth) => {
    const router = express.Router();

    router.get('/masini/:id/documente', requireAuth, (req, res) => {
        const masinaId = req.params.id;
        
        db.all(
            `SELECT * FROM documente WHERE masina_id = ? ORDER BY data_expirare ASC`,
            [masinaId],
            (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ documente: rows });
            }
        );
    });

    router.post('/masini/:id/documente', requireAuth, (req, res) => {
        const masinaId = req.params.id;
        const { tip_document, numar_document, data_emitere, data_expirare, cost, furnizor, observatii } = req.body;
        
        if (!tip_document || !data_expirare) {
            return res.status(400).json({ error: 'Tip document și data expirării sunt obligatorii' });
        }
        
        db.run(
            `INSERT INTO documente (masina_id, tip_document, numar_document, data_emitere, data_expirare, cost, furnizor, observatii) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [masinaId, tip_document, numar_document, data_emitere, data_expirare, cost, furnizor, observatii],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ 
                    success: true,
                    message: 'Document înregistrat cu succes!',
                    id: this.lastID 
                });
            }
        );
    });

    return router;
};