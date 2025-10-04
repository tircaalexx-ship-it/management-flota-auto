const express = require('express');

module.exports = (db, requireAuth) => {
    const router = express.Router();

    router.get('/masini/:id/revizii', requireAuth, (req, res) => {
        const masinaId = req.params.id;
        
        db.all(
            `SELECT * FROM revizii WHERE masina_id = ? ORDER BY data_revizie DESC`,
            [masinaId],
            (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ revizii: rows });
            }
        );
    });

    router.post('/masini/:id/revizii', requireAuth, (req, res) => {
        const masinaId = req.params.id;
        const { tip_revizie, data_revizie, km_curent, urmatoarea_revizie_km, urmatoarea_revizie_data, cost, service, observatii } = req.body;
        
        if (!tip_revizie || !data_revizie || !km_curent) {
            return res.status(400).json({ error: 'Tip revizie, data și kilometraj sunt obligatorii' });
        }
        
        db.run(
            `INSERT INTO revizii (masina_id, tip_revizie, data_revizie, km_curent, urmatoarea_revizie_km, urmatoarea_revizie_data, cost, service, observatii) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [masinaId, tip_revizie, data_revizie, km_curent, urmatoarea_revizie_km, urmatoarea_revizie_data, cost, service, observatii],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ 
                    success: true,
                    message: 'Revizie înregistrată cu succes!',
                    id: this.lastID 
                });
            }
        );
    });

    return router;
};