const express = require('express');

module.exports = (db, requireAuth) => {
    const router = express.Router();

    router.get('/alerte-expirare', requireAuth, (req, res) => {
        db.all(
            `SELECT m.numar_inmatriculare, m.marca, m.model, d.tip_document, d.data_expirare,
                    CASE 
                        WHEN date(d.data_expirare) < date('now') THEN 'expirat'
                        WHEN date(d.data_expirare) <= date('now', '+30 days') THEN 'expira_curand'
                        ELSE 'ok'
                    END as status_alert
             FROM documente d
             JOIN masini m ON d.masina_id = m.id
             WHERE d.data_expirare <= date('now', '+30 days')
             ORDER BY d.data_expirare ASC`,
            (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ alerte: rows });
            }
        );
    });

    return router;
};