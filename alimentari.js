const express = require('express');

module.exports = (db, requireAuth) => {
    const router = express.Router();

    // Ruta pentru primirea datelor din aplicația pompei
    router.post('/sincronizare-pompa', requireAuth, (req, res) => {
        const { numar_inmatriculare, data_alimentare, cantitate_litri, cost_total, km_curent, pret_per_litru, locatie, tip_combustibil } = req.body;
        
        if (!numar_inmatriculare || !cantitate_litri || !cost_total || !km_curent) {
            return res.status(400).json({ error: 'Date incomplete de la pompa' });
        }
        
        // Găsește mașina după număr de înmatriculare
        db.get('SELECT id FROM masini WHERE numar_inmatriculare = ?', [numar_inmatriculare], (err, masina) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            if (!masina) {
                return res.status(404).json({ error: 'Mașina nu a fost găsită în sistem' });
            }
            
            const masinaId = masina.id;
            
            // Calculează kilometrii parcurși și consumul
            calculeazaConsumSiKm(db, masinaId, km_curent, cantitate_litri, (kmParcursi, consumMediu) => {
                
                // Salvează alimentarea
                db.run(
                    `INSERT INTO alimentari (masina_id, data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, km_parcursi, consum_mediu, locatie, tip_combustibil, numar_inmatriculare_pompa, sincronizat_cu_pompa) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [masinaId, data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, kmParcursi, consumMediu, locatie, tip_combustibil, numar_inmatriculare, 1],
                    function(err) {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        
                        // Verifică dacă este necesară o revizie
                        verificaNecesitateRevizie(db, masinaId, km_curent);
                        
                        res.json({ 
                            success: true,
                            message: 'Alimentare sincronizată cu succes!',
                            consum_mediu: consumMediu,
                            km_parcursi: kmParcursi,
                            id: this.lastID 
                        });
                    }
                );
            });
        });
    });

    // Funcție pentru calcularea consumului și km parcurși
    function calculeazaConsumSiKm(db, masinaId, kmCurent, cantitateLitri, callback) {
        // Găsește ultima alimentare pentru această mașină
        db.get(
            `SELECT km_curent FROM alimentari 
             WHERE masina_id = ? AND km_curent IS NOT NULL 
             ORDER BY data_alimentare DESC LIMIT 1`,
            [masinaId],
            (err, row) => {
                if (err) {
                    console.error('Eroare la calcul consum:', err);
                    callback(0, 0);
                    return;
                }
                
                let kmParcursi = 0;
                let consumMediu = 0;
                
                if (row && row.km_curent) {
                    kmParcursi = kmCurent - row.km_curent;
                    if (kmParcursi > 0) {
                        consumMediu = (cantitateLitri / kmParcursi) * 100; // litri/100km
                    }
                }
                
                callback(kmParcursi, consumMediu);
            }
        );
    }

    // Funcție pentru verificarea necesității reviziei
    function verificaNecesitateRevizie(db, masinaId, kmCurent) {
        // Obține setările de revizie pentru mașină
        db.get(
            `SELECT sr.ultima_revizie_km, sr.urmatoarea_revizie_km, m.numar_inmatriculare
             FROM setari_revizii sr 
             JOIN masini m ON sr.masina_id = m.id 
             WHERE sr.masina_id = ?`,
            [masinaId],
            (err, row) => {
                if (err) {
                    console.error('Eroare la verificare revizie:', err);
                    return;
                }
                
                if (row && row.urmatoarea_revizie_km) {
                    const kmRamas = row.urmatoarea_revizie_km - kmCurent;
                    
                    // Alertă dacă mai sunt mai puțin de 500 km până la revizie
                    if (kmRamas <= 500 && kmRamas > 0) {
                        console.log(`⚠️ ALERTĂ REVIZIE: ${row.numar_inmatriculare} - Mai sunt ${kmRamas} km până la revizie`);
                        // Aici vom integra cu Telegram mai târziu
                    }
                    
                    // Alertă dacă s-a depășit limita
                    if (kmCurent >= row.urmatoarea_revizie_km) {
                        console.log(`🚨 REVIZIE URGENTĂ: ${row.numar_inmatriculare} - Depășit cu ${kmCurent - row.urmatoarea_revizie_km} km`);
                    }
                }
            }
        );
    }

    // Ruta pentru alimentări manuale
    router.get('/masini/:id/alimentari', requireAuth, (req, res) => {
        const masinaId = req.params.id;
        
        db.all(
            `SELECT * FROM alimentari WHERE masina_id = ? ORDER BY data_alimentare DESC`,
            [masinaId],
            (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ alimentari: rows });
            }
        );
    });

    router.post('/masini/:id/alimentari', requireAuth, (req, res) => {
        const masinaId = req.params.id;
        const { data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, locatie, tip_combustibil } = req.body;
        
        if (!cantitate_litri || !cost_total || !km_curent) {
            return res.status(400).json({ error: 'Cantitate, cost și kilometraj sunt obligatorii' });
        }
        
        // Calculează consumul și km parcurși
        calculeazaConsumSiKm(db, masinaId, km_curent, cantitate_litri, (kmParcursi, consumMediu) => {
            db.run(
                `INSERT INTO alimentari (masina_id, data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, km_parcursi, consum_mediu, locatie, tip_combustibil) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [masinaId, data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, kmParcursi, consumMediu, locatie, tip_combustibil],
                function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ 
                        success: true,
                        message: 'Alimentare înregistrată cu succes!',
                        id: this.lastID 
                    });
                }
            );
        });
    });

    return router;
};