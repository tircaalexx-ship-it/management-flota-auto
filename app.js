const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de bază
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configurare session pentru production
app.use(session({
    secret: process.env.SESSION_SECRET || 'flota-auto-secret-online-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// Baza de date în memorie pentru online
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('❌ Eroare baza de date:', err.message);
    } else {
        console.log('✅ Conectat la baza de date în memorie');
        initDatabase();
    }
});

// ==================== INIȚIALIZARE BAZĂ DE DATE ====================
function initDatabase() {
    // Tabel utilizatori
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            nume TEXT NOT NULL,
            email TEXT,
            telefon TEXT,
            is_admin INTEGER DEFAULT 0,
            status TEXT DEFAULT 'activ',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel users:', err);
        else {
            console.log('✅ Tabel users creat');
            createDefaultUser();
        }
    });

    // Tabel mașini
    db.run(`
        CREATE TABLE IF NOT EXISTS masini (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numar_inmatriculare TEXT UNIQUE NOT NULL,
            marca TEXT NOT NULL,
            model TEXT NOT NULL,
            an_fabricatie INTEGER,
            tip_combustibil TEXT,
            culoare TEXT,
            serie_sasiu TEXT,
            status TEXT DEFAULT 'activ',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel masini:', err);
        else console.log('✅ Tabel masini creat');
    });

    // Tabel revizii
    db.run(`
        CREATE TABLE IF NOT EXISTS revizii (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            masina_id INTEGER NOT NULL,
            tip_revizie TEXT NOT NULL,
            data_revizie DATE NOT NULL,
            km_curent INTEGER NOT NULL,
            urmatoarea_revizie_km INTEGER,
            urmatoarea_revizie_data DATE,
            cost REAL,
            service TEXT,
            observatii TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (masina_id) REFERENCES masini (id)
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel revizii:', err);
        else console.log('✅ Tabel revizii creat');
    });

    // Tabel documente
    db.run(`
        CREATE TABLE IF NOT EXISTS documente (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            masina_id INTEGER NOT NULL,
            tip_document TEXT NOT NULL,
            numar_document TEXT,
            data_emitere DATE,
            data_expirare DATE NOT NULL,
            cost REAL,
            furnizor TEXT,
            observatii TEXT,
            status TEXT DEFAULT 'activ',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (masina_id) REFERENCES masini (id)
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel documente:', err);
        else console.log('✅ Tabel documente creat');
    });

    // Tabel alimentări
    db.run(`
        CREATE TABLE IF NOT EXISTS alimentari (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            masina_id INTEGER NOT NULL,
            data_alimentare DATETIME DEFAULT CURRENT_TIMESTAMP,
            cantitate_litri REAL NOT NULL,
            cost_total REAL NOT NULL,
            pret_per_litru REAL,
            km_curent INTEGER NOT NULL,
            km_parcursi INTEGER,
            consum_mediu REAL,
            locatie TEXT,
            tip_combustibil TEXT,
            numar_inmatriculare_pompa TEXT,
            sincronizat_cu_pompa INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (masina_id) REFERENCES masini (id)
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel alimentari:', err);
        else console.log('✅ Tabel alimentari creat');
    });

    // Tabel setări revizii
    db.run(`
        CREATE TABLE IF NOT EXISTS setari_revizii (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            masina_id INTEGER NOT NULL,
            interval_km INTEGER DEFAULT 10000,
            interval_luni INTEGER DEFAULT 12,
            ultima_revizie_km INTEGER,
            ultima_revizie_data DATE,
            urmatoarea_revizie_km INTEGER,
            urmatoarea_revizie_data DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (masina_id) REFERENCES masini (id)
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel setari_revizii:', err);
        else console.log('✅ Tabel setari_revizii creat');
    });

    console.log('✅ Toate tabelele au fost create cu succes');
}

// Crează utilizatorul principal
function createDefaultUser() {
    const passwordHash = bcrypt.hashSync('Ro27821091', 10);
    
    db.run(
        `INSERT OR IGNORE INTO users (username, password_hash, nume, email, is_admin) VALUES (?, ?, ?, ?, ?)`,
        ['Tzindex', passwordHash, 'Alexandru Tirca', 'tzindex@example.com', 1],
        function(err) {
            if (err) {
                console.error('Eroare creare utilizator principal:', err);
            } else {
                console.log('✅ Utilizator principal creat: Tzindex / Ro27821091');
                addSampleData();
            }
        }
    );
}

// Adaugă date exemplu
function addSampleData() {
    const sampleCars = [
        { 
            numar_inmatriculare: "GJ07ZR", 
            marca: "BMW", 
            model: "740XD", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2018,
            culoare: "Negru",
            serie_sasiu: "WBA7E4100JGV38613"
        },
        { 
            numar_inmatriculare: "B123ABC", 
            marca: "Volkswagen", 
            model: "Transporter", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2022,
            culoare: "Alb"
        }
    ];

    sampleCars.forEach(car => {
        db.run(
            'INSERT OR IGNORE INTO masini (numar_inmatriculare, marca, model, an_fabricatie, tip_combustibil, culoare, serie_sasiu) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [car.numar_inmatriculare, car.marca, car.model, car.an_fabricatie, car.tip_combustibil, car.culoare, car.serie_sasiu],
            function(err) {
                if (err) {
                    console.error('Eroare adăugare mașină exemplu:', err);
                } else {
                    console.log('✅ Mașină exemplu adăugată:', car.numar_inmatriculare);
                    
                    // Adaugă setări revizie pentru mașină
                    const masinaId = this.lastID;
                    db.run(
                        'INSERT OR IGNORE INTO setari_revizii (masina_id, interval_km) VALUES (?, ?)',
                        [masinaId, 10000]
                    );

                    // Adaugă documente exemplu pentru prima mașină (GJ07ZR)
                    if (car.numar_inmatriculare === "GJ07ZR") {
                        const today = new Date();
                        const nextYear = new Date(today);
                        nextYear.setFullYear(today.getFullYear() + 1);
                        
                        const documenteExemplu = [
                            {
                                tip_document: 'RCA',
                                numar_document: 'RCA123456',
                                data_emitere: today.toISOString().split('T')[0],
                                data_expirare: nextYear.toISOString().split('T')[0],
                                cost: 850.50,
                                furnizor: 'Euroins'
                            },
                            {
                                tip_document: 'ITP',
                                numar_document: 'ITP789012',
                                data_emitere: today.toISOString().split('T')[0],
                                data_expirare: nextYear.toISOString().split('T')[0],
                                cost: 120.00,
                                furnizor: 'Service Auto'
                            }
                        ];

                        documenteExemplu.forEach(doc => {
                            db.run(
                                'INSERT INTO documente (masina_id, tip_document, numar_document, data_emitere, data_expirare, cost, furnizor) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                [masinaId, doc.tip_document, doc.numar_document, doc.data_emitere, doc.data_expirare, doc.cost, doc.furnizor]
                            );
                        });
                        console.log('✅ Documente exemplu adăugate pentru mașina GJ07ZR');
                    }
                }
            }
        );
    });
}

// ==================== MIDDLEWARE AUTENTIFICARE ====================
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// ==================== FUNCȚII AJUTĂTOARE ====================
function calculeazaConsumSiKm(masinaId, kmCurent, cantitateLitri, callback) {
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
                if (kmParcursi > 0 && cantitateLitri > 0) {
                    consumMediu = (cantitateLitri / kmParcursi) * 100;
                }
            }
            
            callback(kmParcursi, parseFloat(consumMediu.toFixed(2)));
        }
    );
}

// ==================== RUTE PAGINI ====================

// Pagina de login
app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Login - Management Flotă</title>
        <style>
            body { font-family: Arial; background: #f0f0f0; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; height: 100vh; }
            .login-box { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); width: 300px; }
            input, button { width: 100%; padding: 10px; margin: 5px 0; box-sizing: border-box; }
            button { background: #007bff; color: white; border: none; cursor: pointer; }
            .error { color: red; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="login-box">
            <h2>Login</h2>
            <div class="error" id="errorMessage"></div>
            <form id="loginForm">
                <input type="text" id="username" placeholder="Username" value="Tzindex" required>
                <input type="password" id="password" placeholder="Password" value="Ro27821091" required>
                <button type="submit">Login</button>
            </form>
        </div>
        <script>
            document.getElementById('loginForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                
                try {
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();
                    
                    if (data.success) {
                        window.location.href = '/';
                    } else {
                        document.getElementById('errorMessage').textContent = data.error || 'Eroare';
                    }
                } catch (error) {
                    document.getElementById('errorMessage').textContent = 'Eroare de conexiune';
                }
            });
            
            // Auto-login imediat
            setTimeout(() => {
                document.getElementById('loginForm').dispatchEvent(new Event('submit'));
            }, 100);
        </script>
    </body>
    </html>
    `);
});

// Pagina principală - INTERFAȚĂ COMPLETĂ
app.get('/', requireAuth, (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Management Flotă Auto</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
            body { background: #f5f5f5; padding: 20px; }
            .header { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .card { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .btn { background: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; margin: 5px; }
            .btn:hover { background: #0056b3; }
            .btn-success { background: #28a745; }
            .btn-danger { background: #dc3545; }
            .btn-warning { background: #ffc107; color: black; }
            .masina-item { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007bff; }
            .form-group { margin-bottom: 15px; }
            .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
            .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
            .tabs { display: flex; margin-bottom: 20px; }
            .tab { padding: 10px 20px; cursor: pointer; border: 1px solid #ddd; background: #f8f9fa; }
            .tab.active { background: #007bff; color: white; }
            .tab-content { display: none; }
            .tab-content.active { display: block; }
            .table { width: 100%; border-collapse: collapse; }
            .table th, .table td { padding: 10px; border: 1px solid #ddd; text-align: left; }
            .table th { background: #f8f9fa; }
            .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; }
            .modal-content { background: white; margin: 5% auto; padding: 20px; border-radius: 10px; width: 90%; max-width: 600px; }
            .document-expirat { background: #ffcccc !important; }
            .document-expira-curand { background: #fff3cd !important; }
            .document-ok { background: #d4edda !important; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚗 Management Flotă Auto - SISTEM COMPLET</h1>
            <p>Bun venit, ${req.session.user.nume}!</p>
            <button class="btn btn-danger" onclick="logout()">🚪 Delogare</button>
        </div>

        <div class="tabs">
            <div class="tab active" onclick="showTab('masini')">🚗 Mașini</div>
            <div class="tab" onclick="showTab('alimentari')">⛽ Alimentări</div>
            <div class="tab" onclick="showTab('revizii')">🔧 Revizii</div>
            <div class="tab" onclick="showTab('documente')">📄 Documente</div>
            <div class="tab" onclick="showTab('rapoarte')">📊 Rapoarte</div>
        </div>

        <!-- Tab Mașini -->
        <div id="masini" class="tab-content active">
            <div class="card">
                <h2>Lista Mașinilor</h2>
                <button class="btn" onclick="loadMasini()">🔄 Reîncarcă</button>
                <button class="btn btn-success" onclick="addSampleCars()">🚙 Adaugă Exemplu</button>
                <div id="lista-masini" style="margin-top: 15px;"></div>
            </div>

            <div class="card">
                <h2>Adaugă Mașină Nouă</h2>
                <form id="form-masina">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label>Număr Înmatriculare *</label>
                            <input type="text" id="numar_inmatriculare" required>
                        </div>
                        <div class="form-group">
                            <label>Marcă *</label>
                            <input type="text" id="marca" required>
                        </div>
                        <div class="form-group">
                            <label>Model *</label>
                            <input type="text" id="model" required>
                        </div>
                        <div class="form-group">
                            <label>An Fabricație</label>
                            <input type="number" id="an_fabricatie">
                        </div>
                        <div class="form-group">
                            <label>Tip Combustibil</label>
                            <select id="tip_combustibil">
                                <option value="diesel">Diesel</option>
                                <option value="benzina">Benzină</option>
                                <option value="electric">Electric</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Culoare</label>
                            <input type="text" id="culoare">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Serie Șasiu</label>
                        <input type="text" id="serie_sasiu">
                    </div>
                    <button type="submit" class="btn btn-success">✅ Adaugă Mașina</button>
                </form>
            </div>
        </div>

        <!-- Tab Alimentări -->
        <div id="alimentari" class="tab-content">
            <div class="card">
                <h2>Gestiune Alimentări</h2>
                <div class="form-group">
                    <label>Selectează Mașina</label>
                    <select id="select-masina-alimentare" onchange="loadAlimentariMasina()">
                        <option value="">-- Alege mașina --</option>
                    </select>
                </div>
                <button class="btn btn-success" onclick="openModalAlimentare()">➕ Adaugă Alimentare</button>
                <div id="alimentari-content" style="margin-top: 15px;"></div>
            </div>
        </div>

        <!-- Tab Revizii -->
        <div id="revizii" class="tab-content">
            <div class="card">
                <h2>Gestiune Revizii</h2>
                <div class="form-group">
                    <label>Selectează Mașina</label>
                    <select id="select-masina-revizii" onchange="loadReviziiMasina()">
                        <option value="">-- Alege mașina --</option>
                    </select>
                </div>
                <button class="btn btn-success" onclick="openModalRevizie()">🔧 Adaugă Revizie</button>
                <div id="revizii-content" style="margin-top: 15px;"></div>
            </div>
        </div>

        <!-- Tab Documente -->
        <div id="documente" class="tab-content">
            <div class="card">
                <h2>Gestiune Documente</h2>
                <div class="form-group">
                    <label>Selectează Mașina</label>
                    <select id="select-masina-documente" onchange="loadDocumenteMasina()">
                        <option value="">-- Alege mașina --</option>
                    </select>
                </div>
                <button class="btn btn-success" onclick="openModalDocument()">📄 Adaugă Document</button>
                <div id="documente-content" style="margin-top: 15px;"></div>
            </div>
        </div>

        <!-- Tab Rapoarte -->
        <div id="rapoarte" class="tab-content">
            <div class="card">
                <h2>Rapoarte și Statistici</h2>
                <button class="btn" onclick="loadRaportConsum()">📈 Raport Consum</button>
                <button class="btn" onclick="loadAlerte()">⚠️ Alertă Expirări</button>
                <div id="rapoarte-content" style="margin-top: 15px;"></div>
            </div>
        </div>

        <!-- Modal Alimentare -->
        <div id="modalAlimentare" class="modal">
            <div class="modal-content">
                <h2>⛽ Adaugă Alimentare</h2>
                <form id="form-alimentare">
                    <input type="hidden" id="alimentare-masina-id">
                    <div class="form-group">
                        <label>Data și Ora</label>
                        <input type="datetime-local" id="alimentare-data" required>
                    </div>
                    <div class="form-group">
                        <label>Cantitate (litri) *</label>
                        <input type="number" step="0.01" id="alimentare-cantitate" required>
                    </div>
                    <div class="form-group">
                        <label>Cost Total (RON) *</label>
                        <input type="number" step="0.01" id="alimentare-cost" required>
                    </div>
                    <div class="form-group">
                        <label>Kilometraj Curent *</label>
                        <input type="number" id="alimentare-km" required>
                    </div>
                    <div class="form-group">
                        <label>Preț pe Litru (RON)</label>
                        <input type="number" step="0.01" id="alimentare-pret">
                    </div>
                    <div class="form-group">
                        <label>Locație</label>
                        <input type="text" id="alimentare-locatie">
                    </div>
                    <button type="submit" class="btn btn-success">✅ Salvează</button>
                    <button type="button" class="btn btn-danger" onclick="closeModal('modalAlimentare')">❌ Anulează</button>
                </form>
            </div>
        </div>

        <!-- Modal Revizie -->
        <div id="modalRevizie" class="modal">
            <div class="modal-content">
                <h2>🔧 Adaugă Revizie</h2>
                <form id="form-revizie">
                    <input type="hidden" id="revizie-masina-id">
                    <div class="form-group">
                        <label>Tip Revizie *</label>
                        <input type="text" id="revizie-tip" required>
                    </div>
                    <div class="form-group">
                        <label>Data Revizie *</label>
                        <input type="date" id="revizie-data" required>
                    </div>
                    <div class="form-group">
                        <label>Kilometraj Curent *</label>
                        <input type="number" id="revizie-km" required>
                    </div>
                    <div class="form-group">
                        <label>Cost (RON)</label>
                        <input type="number" step="0.01" id="revizie-cost">
                    </div>
                    <div class="form-group">
                        <label>Service</label>
                        <input type="text" id="revizie-service">
                    </div>
                    <div class="form-group">
                        <label>Observații</label>
                        <textarea id="revizie-observatii" rows="3"></textarea>
                    </div>
                    <button type="submit" class="btn btn-success">✅ Salvează</button>
                    <button type="button" class="btn btn-danger" onclick="closeModal('modalRevizie')">❌ Anulează</button>
                </form>
            </div>
        </div>

        <!-- Modal Document ÎMBUNĂTĂȚIT -->
        <div id="modalDocument" class="modal">
            <div class="modal-content">
                <h2>📄 Adaugă Document</h2>
                <form id="form-document">
                    <input type="hidden" id="document-masina-id">
                    
                    <div class="form-group">
                        <label>Tip Document *</label>
                        <select id="document-tip" required>
                            <option value="">-- Alege tipul --</option>
                            <option value="ITP">ITP</option>
                            <option value="RCA">Asigurare RCA</option>
                            <option value="CASCO">Asigurare CASCO</option>
                            <option value="Vigneta">Vignetă</option>
                            <option value="Rovinieta">Rovinietă</option>
                            <option value="Carte Auto">Carte Auto</option>
                            <option value="Talon">Talon</option>
                            <option value="Permis">Permis de Conducere</option>
                            <option value="Altele">Altele</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Număr Document</label>
                        <input type="text" id="document-numar" placeholder="Ex: X123456">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label>Data Emitere</label>
                            <input type="date" id="document-emitere">
                        </div>
                        
                        <div class="form-group">
                            <label>Data Expirare *</label>
                            <input type="date" id="document-expirare" required>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div class="form-group">
                            <label>Cost (RON)</label>
                            <input type="number" step="0.01" id="document-cost" placeholder="0.00">
                        </div>
                        
                        <div class="form-group">
                            <label>Furnizor</label>
                            <input type="text" id="document-furnizor" placeholder="Nume furnizor">
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; display: flex; gap: 10px;">
                        <button type="submit" class="btn btn-success">✅ Salvează Document</button>
                        <button type="button" class="btn btn-danger" onclick="closeModal('modalDocument')">❌ Anulează</button>
                    </div>
                </form>
            </div>
        </div>

        <script>
            let masini = [];
            
            // Funcții tab
            function showTab(tabName) {
                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
                document.getElementById(tabName).classList.add('active');
                event.target.classList.add('active');
                
                if (tabName === 'alimentari' || tabName === 'revizii' || tabName === 'documente') {
                    loadMasiniForSelect();
                }
            }
            
            // Funcții mașini
            function loadMasini() {
                fetch('/api/masini')
                .then(r => r.json())
                .then(data => {
                    masini = data.masini || [];
                    const container = document.getElementById('lista-masini');
                    
                    if (masini.length === 0) {
                        container.innerHTML = '<p>Nu există mașini în baza de date.</p>';
                        return;
                    }
                    
                    container.innerHTML = masini.map(masina => \`
                        <div class="masina-item">
                            <strong>\${masina.numar_inmatriculare}</strong> - \${masina.marca} \${masina.model}
                            <br><small>\${masina.tip_combustibil} • \${masina.an_fabricatie || 'N/A'} • \${masina.culoare || 'N/A'}</small>
                            <button class="btn btn-danger" onclick="deleteMasina(\${masina.id})" style="float: right;">🗑️ Șterge</button>
                        </div>
                    \`).join('');
                });
            }
            
            function loadMasiniForSelect() {
                const selects = ['select-masina-alimentare', 'select-masina-revizii', 'select-masina-documente'];
                selects.forEach(selectId => {
                    const select = document.getElementById(selectId);
                    select.innerHTML = '<option value="">-- Alege mașina --</option>' +
                        masini.map(m => \`<option value="\${m.id}">\${m.numar_inmatriculare} - \${m.marca} \${m.model}</option>\`).join('');
                });
            }
            
            function addSampleCars() {
                const sampleCars = [
                    { numar_inmatriculare: "GJ07ZR", marca: "BMW", model: "740XD", tip_combustibil: "diesel", an_fabricatie: 2018, culoare: "Negru", serie_sasiu: "WBA7E4100JGV38613" },
                    { numar_inmatriculare: "B123ABC", marca: "Volkswagen", model: "Transporter", tip_combustibil: "diesel", an_fabricatie: 2022, culoare: "Alb" }
                ];
                
                sampleCars.forEach(car => {
                    fetch('/api/masini', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(car)
                    });
                });
                
                setTimeout(() => {
                    loadMasini();
                    alert('Mașini exemplu adăugate!');
                }, 1000);
            }
            
            function deleteMasina(id) {
                if (confirm('Sigur vrei să ștergi această mașină?')) {
                    fetch('/api/masini/' + id, { method: 'DELETE' })
                    .then(r => r.json())
                    .then(data => {
                        if (data.success) {
                            loadMasini();
                            alert('Mașină ștearsă!');
                        }
                    });
                }
            }
            
            // Funcții alimentări
            function loadAlimentariMasina() {
                const masinaId = document.getElementById('select-masina-alimentare').value;
                if (!masinaId) return;
                
                document.getElementById('alimentare-masina-id').value = masinaId;
                
                fetch(\`/api/masini/\${masinaId}/alimentari\`)
                .then(r => r.json())
                .then(data => {
                    const container = document.getElementById('alimentari-content');
                    const alimentari = data.alimentari || [];
                    
                    if (alimentari.length === 0) {
                        container.innerHTML = '<p>Nu există alimentări pentru această mașină.</p>';
                        return;
                    }
                    
                    let html = '<table class="table"><tr><th>Data</th><th>Cantitate</th><th>Cost</th><th>KM</th><th>Consum</th></tr>';
                    alimentari.forEach(a => {
                        html += \`<tr>
                            <td>\${new Date(a.data_alimentare).toLocaleDateString()}</td>
                            <td>\${a.cantitate_litri}L</td>
                            <td>\${a.cost_total}RON</td>
                            <td>\${a.km_curent}</td>
                            <td>\${a.consum_mediu || '-'}L/100km</td>
                        </tr>\`;
                    });
                    html += '</table>';
                    container.innerHTML = html;
                });
            }
            
            function openModalAlimentare() {
                const masinaId = document.getElementById('select-masina-alimentare').value;
                if (!masinaId) {
                    alert('Selectează mai întâi o mașină!');
                    return;
                }
                document.getElementById('modalAlimentare').style.display = 'block';
                document.getElementById('alimentare-data').value = new Date().toISOString().slice(0, 16);
            }
            
            // Funcții revizii
            function loadReviziiMasina() {
                const masinaId = document.getElementById('select-masina-revizii').value;
                if (!masinaId) return;
                
                document.getElementById('revizie-masina-id').value = masinaId;
                
                fetch(\`/api/masini/\${masinaId}/revizii\`)
                .then(r => r.json())
                .then(data => {
                    const container = document.getElementById('revizii-content');
                    const revizii = data.revizii || [];
                    
                    if (revizii.length === 0) {
                        container.innerHTML = '<p>Nu există revizii pentru această mașină.</p>';
                        return;
                    }
                    
                    let html = '<table class="table"><tr><th>Tip</th><th>Data</th><th>KM</th><th>Cost</th><th>Service</th></tr>';
                    revizii.forEach(r => {
                        html += \`<tr>
                            <td>\${r.tip_revizie}</td>
                            <td>\${new Date(r.data_revizie).toLocaleDateString()}</td>
                            <td>\${r.km_curent}</td>
                            <td>\${r.cost || '-'}RON</td>
                            <td>\${r.service || '-'}</td>
                        </tr>\`;
                    });
                    html += '</table>';
                    container.innerHTML = html;
                });
            }
            
            function openModalRevizie() {
                const masinaId = document.getElementById('select-masina-revizii').value;
                if (!masinaId) {
                    alert('Selectează mai întâi o mașină!');
                    return;
                }
                document.getElementById('modalRevizie').style.display = 'block';
                document.getElementById('revizie-data').valueAsDate = new Date();
            }
            
            // ==================== FUNCȚII DOCUMENTE - VERZIUNE ÎMBUNĂTĂȚITĂ ====================
            function loadDocumenteMasina() {
                const masinaId = document.getElementById('select-masina-documente').value;
                if (!masinaId) return;
                
                document.getElementById('document-masina-id').value = masinaId;
                
                fetch(\`/api/masini/\${masinaId}/documente\`)
                .then(r => {
                    if (!r.ok) throw new Error('Eroare la încărcarea documentelor');
                    return r.json();
                })
                .then(data => {
                    const container = document.getElementById('documente-content');
                    const documente = data.documente || [];
                    
                    if (documente.length === 0) {
                        container.innerHTML = '<p>Nu există documente pentru această mașină.</p>';
                        return;
                    }
                    
                    let html = \`
                    <table class="table">
                        <tr>
                            <th>Tip</th>
                            <th>Număr</th>
                            <th>Emitere</th>
                            <th>Expiră</th>
                            <th>Zile rămase</th>
                            <th>Cost</th>
                            <th>Furnizor</th>
                            <th>Acțiuni</th>
                        </tr>
                    \`;
                    
                    documente.forEach(d => {
                        const expirare = new Date(d.data_expirare);
                        const today = new Date();
                        const diffTime = expirare - today;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        let clasaCss = 'document-ok';
                        let statusText = '';
                        if (diffDays < 0) {
                            clasaCss = 'document-expirat';
                            statusText = \`<span style="color: red; font-weight: bold;">EXPIRAT (\${Math.abs(diffDays)} zile)</span>\`;
                        } else if (diffDays < 30) {
                            clasaCss = 'document-expira-curand';
                            statusText = \`<span style="color: orange; font-weight: bold;">\${diffDays} zile</span>\`;
                        } else {
                            statusText = \`<span style="color: green;">\${diffDays} zile</span>\`;
                        }
                        
                        html += \`
                        <tr class="\${clasaCss}">
                            <td><strong>\${d.tip_document}</strong></td>
                            <td>\${d.numar_document || '-'}</td>
                            <td>\${d.data_emitere ? new Date(d.data_emitere).toLocaleDateString() : '-'}</td>
                            <td>\${expirare.toLocaleDateString()}</td>
                            <td>\${statusText}</td>
                            <td>\${d.cost ? d.cost + ' RON' : '-'}</td>
                            <td>\${d.furnizor || '-'}</td>
                            <td>
                                <button class="btn btn-danger" onclick="deleteDocument(\${d.id})" title="Șterge document">
                                    🗑️
                                </button>
                            </td>
                        </tr>\`;
                    });
                    html += '</table>';
                    container.innerHTML = html;
                })
                .catch(error => {
                    console.error('Eroare:', error);
                    document.getElementById('documente-content').innerHTML = '<p style="color: red;">Eroare la încărcarea documentelor: ' + error.message + '</p>';
                });
            }
            
            function openModalDocument() {
                const masinaId = document.getElementById('select-masina-documente').value;
                if (!masinaId) {
                    alert('Selectează mai întâi o mașină!');
                    return;
                }
                
                // Resetează formularul
                document.getElementById('form-document').reset();
                
                // Setează data expirării implicită (peste 1 an)
                const nextYear = new Date();
                nextYear.setFullYear(nextYear.getFullYear() + 1);
                document.getElementById('document-expirare').valueAsDate = nextYear;
                
                // Setează data emiterii implicită (azi)
                document.getElementById('document-emitere').valueAsDate = new Date();
                
                document.getElementById('modalDocument').style.display = 'block';
            }
            
            function deleteDocument(documentId) {
                if (!confirm('Sigur vrei să ștergi acest document? Această acțiune este ireversibilă.')) {
                    return;
                }
                
                fetch('/api/documente/' + documentId, { 
                    method: 'DELETE' 
                })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        loadDocumenteMasina();
                        alert('Document șters cu succes!');
                    } else {
                        alert('Eroare la ștergere: ' + data.error);
                    }
                })
                .catch(error => {
                    alert('Eroare la ștergere: ' + error.message);
                });
            }
            
            // Funcții rapoarte
            function loadRaportConsum() {
                fetch('/api/rapoarte/consum')
                .then(r => r.json())
                .then(data => {
                    const container = document.getElementById('rapoarte-content');
                    const raport = data.raport || [];
                    
                    if (raport.length === 0) {
                        container.innerHTML = '<p>Nu există date pentru raport.</p>';
                        return;
                    }
                    
                    let html = '<table class="table"><tr><th>Mașină</th><th>Consum Mediu</th><th>Total Litri</th><th>Cost Total</th></tr>';
                    raport.forEach(r => {
                        html += \`<tr>
                            <td>\${r.numar_inmatriculare}</td>
                            <td>\${r.consum_mediu ? r.consum_mediu.toFixed(2) + 'L/100km' : 'N/A'}</td>
                            <td>\${r.total_litri ? r.total_litri.toFixed(2) + 'L' : '0L'}</td>
                            <td>\${r.cost_total ? r.cost_total.toFixed(2) + 'RON' : '0RON'}</td>
                        </tr>\`;
                    });
                    html += '</table>';
                    container.innerHTML = html;
                });
            }
            
            function loadAlerte() {
                fetch('/api/alerte-expirare')
                .then(r => r.json())
                .then(data => {
                    const container = document.getElementById('rapoarte-content');
                    const alerte = data.alerte || [];
                    
                    if (alerte.length === 0) {
                        container.innerHTML = '<p>✅ Nu există documente expirate sau care expiră în curând.</p>';
                        return;
                    }
                    
                    let html = '<h3>⚠️ Alertă Documente Expirate</h3>';
                    alerte.forEach(a => {
                        html += \`<div class="masina-item" style="border-left-color: \${a.status_alert === 'expirat' ? '#dc3545' : '#ffc107'};">
                            <strong>\${a.numar_inmatriculare}</strong> - \${a.tip_document}<br>
                            Expiră: \${new Date(a.data_expirare).toLocaleDateString()}<br>
                            Status: \${a.status_alert === 'expirat' ? '❌ EXPIRAT' : '⚠️ EXPIRĂ CURÂND'}
                        </div>\`;
                    });
                    container.innerHTML = html;
                });
            }
            
            // Funcții utilitare
            function closeModal(modalId) {
                document.getElementById(modalId).style.display = 'none';
            }
            
            function logout() {
                fetch('/api/logout', { method: 'POST' })
                .then(() => window.location.href = '/login');
            }
            
            // Event listeners
            document.addEventListener('DOMContentLoaded', function() {
                loadMasini();
                
                // Form mașină
                document.getElementById('form-masina').addEventListener('submit', function(e) {
                    e.preventDefault();
                    const masina = {
                        numar_inmatriculare: document.getElementById('numar_inmatriculare').value,
                        marca: document.getElementById('marca').value,
                        model: document.getElementById('model').value,
                        an_fabricatie: document.getElementById('an_fabricatie').value,
                        tip_combustibil: document.getElementById('tip_combustibil').value,
                        culoare: document.getElementById('culoare').value,
                        serie_sasiu: document.getElementById('serie_sasiu').value
                    };
                    
                    fetch('/api/masini', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(masina)
                    })
                    .then(r => r.json())
                    .then(data => {
                        if (data.success) {
                            document.getElementById('form-masina').reset();
                            loadMasini();
                            alert('Mașină adăugată cu succes!');
                        } else {
                            alert('Eroare: ' + data.error);
                        }
                    });
                });
                
                // Form alimentare
                document.getElementById('form-alimentare').addEventListener('submit', function(e) {
                    e.preventDefault();
                    const alimentare = {
                        data_alimentare: document.getElementById('alimentare-data').value,
                        cantitate_litri: parseFloat(document.getElementById('alimentare-cantitate').value),
                        cost_total: parseFloat(document.getElementById('alimentare-cost').value),
                        km_curent: parseInt(document.getElementById('alimentare-km').value),
                        pret_per_litru: document.getElementById('alimentare-pret').value ? parseFloat(document.getElementById('alimentare-pret').value) : null,
                        locatie: document.getElementById('alimentare-locatie').value
                    };
                    
                    const masinaId = document.getElementById('alimentare-masina-id').value;
                    
                    fetch(\`/api/masini/\${masinaId}/alimentari\`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(alimentare)
                    })
                    .then(r => r.json())
                    .then(data => {
                        if (data.success) {
                            closeModal('modalAlimentare');
                            loadAlimentariMasina();
                            alert('Alimentare adăugată! Consum: ' + data.consum_mediu + 'L/100km');
                        } else {
                            alert('Eroare: ' + data.error);
                        }
                    });
                });
                
                // Form revizie
                document.getElementById('form-revizie').addEventListener('submit', function(e) {
                    e.preventDefault();
                    const revizie = {
                        tip_revizie: document.getElementById('revizie-tip').value,
                        data_revizie: document.getElementById('revizie-data').value,
                        km_curent: parseInt(document.getElementById('revizie-km').value),
                        cost: document.getElementById('revizie-cost').value ? parseFloat(document.getElementById('revizie-cost').value) : null,
                        service: document.getElementById('revizie-service').value,
                        observatii: document.getElementById('revizie-observatii').value
                    };
                    
                    const masinaId = document.getElementById('revizie-masina-id').value;
                    
                    fetch(\`/api/masini/\${masinaId}/revizii\`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(revizie)
                    })
                    .then(r => r.json())
                    .then(data => {
                        if (data.success) {
                            closeModal('modalRevizie');
                            loadReviziiMasina();
                            alert('Revizie adăugată!');
                        } else {
                            alert('Eroare: ' + data.error);
                        }
                    });
                });
                
                // ==================== FORMULAR DOCUMENTE - VERZIUNE CORECTATĂ ====================
                document.getElementById('form-document').addEventListener('submit', function(e) {
                    e.preventDefault();
                    
                    const masinaId = document.getElementById('document-masina-id').value;
                    const tipDocument = document.getElementById('document-tip').value;
                    const numarDocument = document.getElementById('document-numar').value;
                    const dataEmitere = document.getElementById('document-emitere').value;
                    const dataExpirare = document.getElementById('document-expirare').value;
                    const cost = document.getElementById('document-cost').value;
                    const furnizor = document.getElementById('document-furnizor').value;
                    
                    // Validare frontend
                    if (!tipDocument) {
                        alert('Tipul documentului este obligatoriu!');
                        return;
                    }
                    if (!dataExpirare) {
                        alert('Data expirării este obligatorie!');
                        return;
                    }
                    
                    const documentData = {
                        tip_document: tipDocument,
                        numar_document: numarDocument || null,
                        data_emitere: dataEmitere || null,
                        data_expirare: dataExpirare,
                        cost: cost ? parseFloat(cost) : null,
                        furnizor: furnizor || null
                    };
                    
                    console.log('Trimit document:', documentData);
                    
                    fetch(\`/api/masini/\${masinaId}/documente\`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(documentData)
                    })
                    .then(response => {
                        if (!response.ok) {
                            return response.json().then(err => { throw new Error(err.error || 'Eroare server'); });
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.success) {
                            closeModal('modalDocument');
                            loadDocumenteMasina();
                            alert('✓ Document adăugat cu succes!');
                        } else {
                            throw new Error(data.error || 'Eroare necunoscută');
                        }
                    })
                    .catch(error => {
                        console.error('Eroare completă:', error);
                        alert('❌ Eroare la adăugarea documentului: ' + error.message);
                    });
                });
            });
            
            // Închide modalurile la click în afara
            window.onclick = function(event) {
                const modals = document.getElementsByClassName('modal');
                for (let modal of modals) {
                    if (event.target === modal) {
                        modal.style.display = 'none';
                    }
                }
            }
        </script>
    </body>
    </html>
    `);
});

// ==================== RUTE API ====================

// Autentificare
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username și parolă sunt obligatorii' });
    }
    
    // Verificare simplificată pentru online
    if (username === 'Tzindex' && password === 'Ro27821091') {
        req.session.user = {
            id: 1,
            username: 'Tzindex',
            nume: 'Alexandru Tirca',
            is_admin: 1
        };
        res.json({ 
            success: true, 
            message: 'Autentificare reușită!',
            user: req.session.user
        });
    } else {
        res.status(401).json({ error: 'Utilizator sau parolă incorectă' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Eroare la logout' });
        res.json({ success: true, message: 'Delogare reușită' });
    });
});

// Rute mașini
app.get('/api/masini', requireAuth, (req, res) => {
    db.all('SELECT * FROM masini ORDER BY numar_inmatriculare', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ masini: rows });
    });
});

app.post('/api/masini', requireAuth, (req, res) => {
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
            
            // Creează setări default pentru revizie
            db.run(
                `INSERT INTO setari_revizii (masina_id, interval_km) VALUES (?, ?)`,
                [this.lastID, 10000]
            );
            
            res.json({ 
                success: true,
                message: 'Mașină adăugată cu succes!',
                id: this.lastID 
            });
        }
    );
});

app.delete('/api/masini/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    
    db.run('DELETE FROM masini WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ 
            success: true,
            message: 'Mașină ștearsă cu succes!'
        });
    });
});

// Rute alimentări
app.get('/api/masini/:id/alimentari', requireAuth, (req, res) => {
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

app.post('/api/masini/:id/alimentari', requireAuth, (req, res) => {
    const masinaId = req.params.id;
    const { data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, locatie } = req.body;
    
    if (!cantitate_litri || !cost_total || !km_curent) {
        return res.status(400).json({ error: 'Cantitate, cost și kilometraj sunt obligatorii' });
    }
    
    calculeazaConsumSiKm(masinaId, km_curent, cantitateLitri, (kmParcursi, consumMediu) => {
        
        db.run(
            `INSERT INTO alimentari (masina_id, data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, km_parcursi, consum_mediu, locatie) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [masinaId, data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, kmParcursi, consumMediu, locatie],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                res.json({ 
                    success: true,
                    message: 'Alimentare înregistrată cu succes!',
                    consum_mediu: consumMediu,
                    km_parcursi: kmParcursi,
                    id: this.lastID 
                });
            }
        );
    });
});

// Rute revizii
app.get('/api/masini/:id/revizii', requireAuth, (req, res) => {
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

app.post('/api/masini/:id/revizii', requireAuth, (req, res) => {
    const masinaId = req.params.id;
    const { tip_revizie, data_revizie, km_curent, cost, service, observatii } = req.body;
    
    if (!tip_revizie || !data_revizie || !km_curent) {
        return res.status(400).json({ error: 'Tip revizie, data și kilometraj sunt obligatorii' });
    }
    
    db.run(
        `INSERT INTO revizii (masina_id, tip_revizie, data_revizie, km_curent, cost, service, observatii) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [masinaId, tip_revizie, data_revizie, km_curent, cost, service, observatii],
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

// ==================== RUTE DOCUMENTE - VERZIUNE CORECTATĂ ====================
app.get('/api/masini/:id/documente', requireAuth, (req, res) => {
    const masinaId = req.params.id;
    
    db.all(
        `SELECT * FROM documente WHERE masina_id = ? ORDER BY data_expirare ASC`,
        [masinaId],
        (err, rows) => {
            if (err) {
                console.error('Eroare la obținerea documentelor:', err);
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ documente: rows });
        }
    );
});

app.post('/api/masini/:id/documente', requireAuth, (req, res) => {
    const masinaId = req.params.id;
    const { tip_document, numar_document, data_emitere, data_expirare, cost, furnizor, observatii } = req.body;
    
    console.log('Date primite pentru document:', req.body);
    
    // Validare extinsă
    if (!tip_document) {
        return res.status(400).json({ error: 'Tipul documentului este obligatoriu' });
    }
    if (!data_expirare) {
        return res.status(400).json({ error: 'Data expirării este obligatorie' });
    }
    if (!masinaId) {
        return res.status(400).json({ error: 'ID-ul mașinii este obligatoriu' });
    }
    
    // Verifică dacă mașina există
    db.get('SELECT id FROM masini WHERE id = ?', [masinaId], (err, masina) => {
        if (err) {
            console.error('Eroare la verificarea mașinii:', err);
            return res.status(500).json({ error: 'Eroare internă la verificarea mașinii' });
        }
        if (!masina) {
            return res.status(404).json({ error: 'Mașina nu a fost găsită' });
        }
        
        // Inserează documentul
        db.run(
            `INSERT INTO documente (masina_id, tip_document, numar_document, data_emitere, data_expirare, cost, furnizor, observatii) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [masinaId, tip_document, numar_document || null, data_emitere || null, data_expirare, cost || null, furnizor || null, observatii || null],
            function(err) {
                if (err) {
                    console.error('Eroare la inserarea documentului:', err);
                    res.status(500).json({ error: 'Eroare la salvarea documentului: ' + err.message });
                    return;
                }
                
                console.log('Document salvat cu succes, ID:', this.lastID);
                res.json({ 
                    success: true,
                    message: 'Document înregistrat cu succes!',
                    id: this.lastID 
                });
            }
        );
    });
});

// Ștergere document
app.delete('/api/documente/:id', requireAuth, (req, res) => {
    const documentId = req.params.id;
    
    db.run('DELETE FROM documente WHERE id = ?', [documentId], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ 
            success: true,
            message: 'Document șters cu succes!'
        });
    });
});

// Rute rapoarte
app.get('/api/rapoarte/consum', requireAuth, (req, res) => {
    db.all(`
        SELECT m.numar_inmatriculare, m.marca, m.model, 
               AVG(a.consum_mediu) as consum_mediu,
               SUM(a.cost_total) as cost_total,
               SUM(a.cantitate_litri) as total_litri,
               COUNT(*) as numar_alimentari
        FROM alimentari a
        JOIN masini m ON a.masina_id = m.id
        WHERE a.consum_mediu IS NOT NULL
        GROUP BY m.id
        ORDER BY consum_mediu DESC
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ raport: rows });
    });
});

// Rute alerte
app.get('/api/alerte-expirare', requireAuth, (req, res) => {
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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Serverul funcționează perfect!',
        timestamp: new Date().toISOString()
    });
});

// Pornire server
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 ========================================');
    console.log('✅ SERVERUL ONLINE A PORNIT CU SUCCES!');
    console.log(`📍 Port: ${PORT}`);
    console.log('🔐 User: Tzindex');
    console.log('🔑 Parola: Ro27821091');
    console.log('💾 Baza de date: :memory: (online)');
    console.log('🚀 ========================================');
});