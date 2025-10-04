const express = require('express');

module.exports = (db, requireAuth) => {
    const router = express.Router();

    router.get('/masini/:id/dashboard', requireAuth, (req, res) => {
        const masinaId = req.params.id;
        
        const dashboardData = {};
        
        // Informații de bază despre mașină
        db.get('SELECT * FROM masini WHERE id = ?', [masinaId], (err, masina) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            dashboardData.masina = masina;
            
            // Ultima alimentare și consum
            db.get(
                `SELECT km_curent, consum_mediu, data_alimentare 
                 FROM alimentari 
                 WHERE masina_id = ? AND consum_mediu IS NOT NULL 
                 ORDER BY data_alimentare DESC LIMIT 1`,
                [masinaId],
                (err, alimentare) => {
                    dashboardData.ultima_alimentare = alimentare;
                    
                    // Statistici consum ultimele 10 alimentări
                    db.all(
                        `SELECT consum_mediu, km_parcursi, cantitate_litri, cost_total, data_alimentare
                         FROM alimentari 
                         WHERE masina_id = ? AND consum_mediu IS NOT NULL 
                         ORDER BY data_alimentare DESC LIMIT 10`,
                        [masinaId],
                        (err, alimentari) => {
                            dashboardData.istoric_consum = alimentari;
                            
                            // Calcul consum mediu general
                            const consumMediu = alimentari.reduce((acc, curr) => acc + curr.consum_mediu, 0) / alimentari.length;
                            dashboardData.consum_mediu_general = consumMediu;
                            
                            // Informații revizii
                            db.get(
                                `SELECT ultima_revizie_km, urmatoarea_revizie_km, interval_km
                                 FROM setari_revizii 
                                 WHERE masina_id = ?`,
                                [masinaId],
                                (err, revizie) => {
                                    dashboardData.revizie = revizie;
                                    
                                    if (revizie && alimentare) {
                                        const kmRamas = revizie.urmatoarea_revizie_km - alimentare.km_curent;
                                        dashboardData.km_pana_la_revizie = kmRamas;
                                        dashboardData.procent_revizie = Math.max(0, Math.min(100, 
                                            ((revizie.interval_km - kmRamas) / revizie.interval_km) * 100
                                        ));
                                    }
                                    
                                    // Costuri lunare
                                    const lunaCurenta = new Date().toISOString().slice(0, 7);
                                    db.get(
                                        `SELECT SUM(cost_total) as cost_luna
                                         FROM alimentari 
                                         WHERE masina_id = ? AND strftime('%Y-%m', data_alimentare) = ?`,
                                        [masinaId, lunaCurenta],
                                        (err, cost) => {
                                            dashboardData.cost_luna = cost ? cost.cost_luna : 0;
                                            
                                            res.json(dashboardData);
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        });
    });

    // Ruta pentru setarea reviziei
    router.post('/masini/:id/setare-revizie', requireAuth, (req, res) => {
        const masinaId = req.params.id;
        const { ultima_revizie_km, ultima_revizie_data, interval_km = 10000 } = req.body;
        
        const urmatoarea_revizie_km = parseInt(ultima_revizie_km) + parseInt(interval_km);
        
        db.run(
            `INSERT OR REPLACE INTO setari_revizii 
             (masina_id, ultima_revizie_km, ultima_revizie_data, urmatoarea_revizie_km, interval_km) 
             VALUES (?, ?, ?, ?, ?)`,
            [masinaId, ultima_revizie_km, ultima_revizie_data, urmatoarea_revizie_km, interval_km],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ 
                    success: true,
                    message: 'Setări revizie salvate!',
                    urmatoarea_revizie_km: urmatoarea_revizie_km
                });
            }
        );
    });

    return router;
};