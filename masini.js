const express = require('express');

module.exports = (db, requireAuth) => {
    const router = express.Router();

    router.get('/masini', requireAuth, (req, res) => {
        db.all('SELECT * FROM masini ORDER BY numar_inmatriculare', (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ masini: rows });
        });
    });

    router.get('/masini/:id', requireAuth, (req, res) => {
        const masinaId = req.params.id;
        db.get('SELECT * FROM masini WHERE id = ?', [masinaId], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (!row) {
                return res.status(404).json({ error: 'Mașina nu a fost găsită' });
            }
            res.json({ masina: row });
        });
    });

    router.post('/masini', requireAuth, (req, res) => {
        const { numar_inmatriculare, marca, model, an_fabricatie, tip_combustibil, culoare, serie_sasiu } = req.body;
        
        if (!numar_inmatriculare || !marca || !model) {
            return res.status(400).json({ error: 'Număr înmatriculare, marcă și model sunt obligatorii' });
        }
        
        db.run(
            `INSERT INTO masini (numar_inmatriculare, marca, model, an_fabricatie, tip_combustibil, culoare, serie_sasiu) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [numar_inmatriculare, marca, model, an_fabricatie, tip_combustibil, culoare, serie_sasiu],
            function(err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT') {
                        return res.status(400).json({ error: 'Numărul de înmatriculare există deja' });
                    }
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ 
                    success: true,
                    message: 'Mașină adăugată cu succes!',
                    id: this.lastID 
                    
                });
            }
        );
    });

    router.delete('/masini/:id', requireAuth, (req, res) => {
        const masinaId = req.params.id;
        
        db.run('DELETE FROM masini WHERE id = ?', [masinaId], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Mașina nu a fost găsită' });
            }
            res.json({ 
                success: true,
                message: 'Mașina a fost ștearsă cu succes!'
            });
        });
    });

    return router;
};