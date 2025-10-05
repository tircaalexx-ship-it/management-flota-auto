const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();

// Configurare pentru mediu de producție
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Configurare
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware pentru producție
app.use(session({
    secret: process.env.SESSION_SECRET || 'flota-auto-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// Configurare baza de date pentru producție
const dbPath = process.env.DATABASE_URL || 
               (isProduction ? '/tmp/data/flota.db' : './data/flota.db');

// Asigură-te că directorul există
if (isProduction) {
    const tempDir = '/tmp/data';
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
} else {
    if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
}

// ==================== MIDDLEWARE AUTENTIFICARE ====================
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.is_admin === 1) {
        next();
    } else {
        res.status(403).json({ error: 'Acces restricționat. Doar administratorul poate accesa această resursă.' });
    }
}

// ==================== BAZĂ DE DATE COMPLETĂ ====================
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Eroare baza de date:', err.message);
    } else {
        console.log('✅ Conectat la baza de date:', dbPath);
        initDatabase();
    }
});

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

    // Tabel REVIZII cu management KM
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

    // Tabel DOCUMENTE
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

    // Tabel ALIMENTĂRI cu calcul consum
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

    // Tabel SETĂRI REVIZII pentru management KM
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
}

// Crează utilizatorul principal
function createDefaultUser() {
    const passwordHash = bcrypt.hashSync('Ro27821091', 10);
    
    db.run(
        `INSERT OR IGNORE INTO users (username, password_hash, nume, email, is_admin) VALUES (?, ?, ?, ?, ?)`,
        ['Tzrkalex', passwordHash, 'Alexandru Tirca', 'tzrkalex@example.com', 1],
        function(err) {
            if (err) {
                console.error('Eroare creare utilizator principal:', err);
            } else {
                console.log('✅ Utilizator principal creat: Tzrkalex');
            }
        }
    );
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

function verificaNecesitateRevizie(masinaId, kmCurent) {
    db.get(
        `SELECT sr.ultima_revizie_km, sr.urmatoarea_revizie_km, m.numar_inmatriculare, m.marca, m.model
         FROM setari_revizii sr 
         JOIN masini m ON sr.masina_id = m.id 
         WHERE sr.masina_id = ?`,
        [masinaId],
        (err, row) => {
            if (err || !row || !row.urmatoarea_revizie_km) return;
            
            const kmRamas = row.urmatoarea_revizie_km - kmCurent;
            
            if (kmRamas <= 500 && kmRamas > 0) {
                console.log(`⚠️ ALERTĂ REVIZIE: ${row.numar_inmatriculare} - Mai sunt ${kmRamas} km până la revizie`);
            }
            
            if (kmCurent >= row.urmatoarea_revizie_km) {
                console.log(`🚨 REVIZIE URGENTĂ: ${row.numar_inmatriculare} - Depășit cu ${kmCurent - row.urmatoarea_revizie_km} km`);
            }
        }
    );
}

// ==================== RUTE PAGINI HTML ====================

// Pagina de login
const loginHTML = `
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Autentificare - Management Flotă</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .login-container { background: white; border-radius: 15px; padding: 40px; box-shadow: 0 15px 35px rgba(0,0,0,0.1); max-width: 500px; width: 100%; }
        .logo { text-align: center; margin-bottom: 30px; }
        .logo h1 { color: #4361ee; font-size: 2em; margin-bottom: 10px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; }
        .form-group input { width: 100%; padding: 12px 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 1em; transition: border-color 0.3s; }
        .form-group input:focus { border-color: #4361ee; outline: none; }
        .btn { width: 100%; background: #4361ee; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 1.1em; font-weight: 600; transition: background 0.3s; }
        .btn:hover { background: #3a0ca3; }
        .error-message { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; margin-bottom: 15px; text-align: center; display: none; }
        .user-info { background: #e7f3ff; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: center; }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>🚗</h1>
            <h2>Management Flotă Auto</h2>
            <p style="color: #666; margin-top: 10px;">Sistem complet de gestiune auto</p>
        </div>
        
        <div class="error-message" id="loginError"></div>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required placeholder="Tzrkalex">
            </div>
            <div class="form-group">
                <label for="password">Parolă:</label>
                <input type="password" id="password" name="password" required placeholder="••••••••">
            </div>
            <button type="submit" class="btn">🔐 Autentificare</button>
        </form>
        
        <div class="user-info">
            <strong>Cont administrator:</strong><br>
            <strong>Username:</strong> Tzrkalex<br>
            <strong>Parolă:</strong> Ro27821091
        </div>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('loginError');
            
            fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/';
                } else {
                    errorDiv.textContent = data.error;
                    errorDiv.style.display = 'block';
                }
            })
            .catch(error => {
                errorDiv.textContent = 'Eroare de conexiune';
                errorDiv.style.display = 'block';
            });
        });
    </script>
</body>
</html>
`;

// Pagina principală
const mainHTML = `
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Management Flotă Auto - Sistem Complet</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { background: white; border-radius: 15px; padding: 30px; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .title { color: #4361ee; font-size: 2.5em; margin-bottom: 10px; }
        .subtitle { color: #666; font-size: 1.2em; }
        .user-info { text-align: right; float: right; }
        .user-welcome { font-weight: 600; color: #333; }
        .admin-badge { background: #e74c3c; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8em; margin-left: 10px; }
        .btn { background: #4361ee; color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-size: 1em; font-weight: 600; margin: 5px; transition: background 0.3s ease; }
        .btn:hover { background: #3a0ca3; }
        .btn-success { background: #27ae60; }
        .btn-success:hover { background: #219653; }
        .btn-warning { background: #f39c12; }
        .btn-warning:hover { background: #e67e22; }
        .btn-danger { background: #e74c3c; }
        .btn-danger:hover { background: #c0392b; }
        .logout-btn { background: #95a5a6; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; margin-top: 5px; }
        .logout-btn:hover { background: #7f8c8d; }
        .card { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .masina-item { padding: 15px; border: 1px solid #eee; border-radius: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; transition: transform 0.2s; cursor: pointer; }
        .masina-item:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .masina-info { flex: 1; }
        .masina-numar { font-weight: bold; font-size: 1.1em; color: #333; }
        .masina-detalii { color: #666; margin-top: 5px; }
        .masina-actions { display: flex; gap: 10px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 600; color: #333; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-size: 1em; }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #4361ee; outline: none; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .card-header { display: flex; align-items: center; margin-bottom: 20px; }
        .card-icon { width: 50px; height: 50px; background: #4361ee; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-right: 15px; color: white; font-size: 1.5em; }
        .card-title { font-size: 1.3em; color: #333; font-weight: 600; }
        .actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .alert-badge { background: #2ecc71; color: white; padding: 5px 10px; border-radius: 20px; font-size: 0.8em; margin-left: 10px; }
        .alert-expired { background: #e74c3c; }
        .alert-warning { background: #f39c12; }
        .delete-btn { background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 0.8em; }
        .delete-btn:hover { background: #c0392b; }
        .alert-item { padding: 15px; border-left: 5px solid #e74c3c; background: #f8d7da; margin-bottom: 10px; border-radius: 5px; }
        .alert-warning-item { border-left-color: #f39c12; background: #fff3cd; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 3px 10px rgba(0,0,0,0.1); }
        .stat-number { font-size: 2em; font-weight: bold; color: #4361ee; }
        .stat-label { color: #666; margin-top: 5px; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; }
        .modal-content { background: white; margin: 5% auto; padding: 20px; border-radius: 10px; width: 90%; max-width: 500px; }
        @media (max-width: 768px) {
            .grid { grid-template-columns: 1fr; }
            .header { text-align: center; }
            .user-info { float: none; text-align: center; margin-top: 15px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1 class="title">🚗 Management Flotă Auto <span class="alert-badge">SISTEM COMPLET</span></h1>
                    <p class="subtitle">Gestiune revizii, documente, asigurări și mentenanță</p>
                </div>
                <div class="user-info">
                    <div class="user-welcome">Bun venit, <span id="userName">...</span>! <span id="adminBadge" style="display: none;" class="admin-badge">ADMIN</span></div>
                    <button class="logout-btn" onclick="logout()">🚪 Delogare</button>
                </div>
            </div>
        </header>

        <!-- Panou statistici și alerte -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number" id="totalMasini">0</div>
                <div class="stat-label">Mașini în flotă</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="alerteExpirate">0</div>
                <div class="stat-label">Documente expirate</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="alerteCurand">0</div>
                <div class="stat-label">Expiră în 30 zile</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="reviziiViitoare">0</div>
                <div class="stat-label">Revizii necesare</div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <div class="card-icon">⚠️</div>
                <h2 class="card-title">Alerte și Notificări</h2>
            </div>
            <div id="alerte-container">
                <p>Se încarcă alertele...</p>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-header">
                    <div class="card-icon">📋</div>
                    <h2 class="card-title">Lista Mașinilor</h2>
                </div>
                <div class="actions">
                    <button class="btn" onclick="loadMasini()">🔄 Reîncarcă</button>
                    <button class="btn btn-success" onclick="addSampleCars()">🚙 Adaugă Exemplu</button>
                    <button class="btn btn-warning" onclick="openSincronizarePompa()">⛽ Sincronizare Pompa</button>
                    <button class="btn" onclick="window.location.href='/rapoarte'">📊 Rapoarte</button>
                </div>
                <div id="lista-masini">Se încarcă mașinile...</div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <div class="card-icon">➕</div>
                    <h2 class="card-title">Adaugă Mașină Nouă</h2>
                </div>
                <form id="form-adaugare-masina">
                    <div class="form-group">
                        <label for="numar_inmatriculare">Număr Înmatriculare *</label>
                        <input type="text" id="numar_inmatriculare" required placeholder="GJ07ZR">
                    </div>
                    <div class="form-group">
                        <label for="marca">Marcă *</label>
                        <input type="text" id="marca" required placeholder="BMW">
                    </div>
                    <div class="form-group">
                        <label for="model">Model *</label>
                        <input type="text" id="model" required placeholder="740XD">
                    </div>
                    <div class="form-group">
                        <label for="an_fabricatie">An Fabricație</label>
                        <input type="number" id="an_fabricatie" placeholder="2018">
                    </div>
                    <div class="form-group">
                        <label for="tip_combustibil">Tip Combustibil</label>
                        <select id="tip_combustibil">
                            <option value="diesel">Diesel</option>
                            <option value="benzina">Benzină</option>
                            <option value="electric">Electric</option>
                            <option value="hibrid">Hibrid</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="culoare">Culoare</label>
                        <input type="text" id="culoare" placeholder="Negru">
                    </div>
                    <div class="form-group">
                        <label for="serie_sasiu">Serie Șasiu</label>
                        <input type="text" id="serie_sasiu" placeholder="WBA1234567890">
                    </div>
                    <button type="submit" class="btn btn-success">✅ Adaugă Mașina</button>
                </form>
            </div>
        </div>
    </div>

    <!-- Modal Sincronizare Pompa -->
    <div id="modalSincronizare" class="modal">
        <div class="modal-content">
            <h2>⛽ Sincronizare cu Pompa de Combustibil</h2>
            <form id="formSincronizarePompa">
                <div class="form-group">
                    <label for="pompa_numar_inmatriculare">Număr Înmatriculare *</label>
                    <input type="text" id="pompa_numar_inmatriculare" required placeholder="GJ07ZR">
                </div>
                <div class="form-group">
                    <label for="pompa_data_alimentare">Data și Ora Alimentare</label>
                    <input type="datetime-local" id="pompa_data_alimentare">
                </div>
                <div class="form-group">
                    <label for="pompa_cantitate_litri">Cantitate (litri) *</label>
                    <input type="number" step="0.01" id="pompa_cantitate_litri" required placeholder="55.5">
                </div>
                <div class="form-group">
                    <label for="pompa_cost_total">Cost Total (RON) *</label>
                    <input type="number" step="0.01" id="pompa_cost_total" required placeholder="350.75">
                </div>
                <div class="form-group">
                    <label for="pompa_km_curent">Kilometraj Curent *</label>
                    <input type="number" id="pompa_km_curent" required placeholder="152500">
                </div>
                <div class="form-group">
                    <label for="pompa_pret_per_litru">Preț pe Litru (RON)</label>
                    <input type="number" step="0.01" id="pompa_pret_per_litru" placeholder="6.32">
                </div>
                <div class="form-group">
                    <label for="pompa_locatie">Locație</label>
                    <input type="text" id="pompa_locatie" placeholder="OMV Bucuresti">
                </div>
                <div class="form-group">
                    <label for="pompa_tip_combustibil">Tip Combustibil</label>
                    <select id="pompa_tip_combustibil">
                        <option value="diesel">Diesel</option>
                        <option value="benzina">Benzină</option>
                        <option value="electric">Electric</option>
                        <option value="hibrid">Hibrid</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-success">✅ Sincronizează Alimentarea</button>
                <button type="button" class="btn btn-danger" onclick="closeSincronizarePompa()">❌ Anulează</button>
            </form>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            checkAuth();
        });

        function checkAuth() {
            fetch('/api/check-auth')
                .then(response => response.json())
                .then(data => {
                    if (data.authenticated) {
                        document.getElementById('userName').textContent = data.user.nume;
                        if (data.user.is_admin) {
                            document.getElementById('adminBadge').style.display = 'inline';
                        }
                        loadMasini();
                        loadAlerte();
                        setupEventListeners();
                    } else {
                        window.location.href = '/login';
                    }
                })
                .catch(error => {
                    console.error('Eroare verificare auth:', error);
                    window.location.href = '/login';
                });
        }

        function setupEventListeners() {
            document.getElementById('form-adaugare-masina').addEventListener('submit', function(e) {
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
                
                adaugaMasina(masina);
            });

            document.getElementById('formSincronizarePompa').addEventListener('submit', function(e) {
                e.preventDefault();
                
                const data = {
                    numar_inmatriculare: document.getElementById('pompa_numar_inmatriculare').value,
                    data_alimentare: document.getElementById('pompa_data_alimentare').value,
                    cantitate_litri: parseFloat(document.getElementById('pompa_cantitate_litri').value),
                    cost_total: parseFloat(document.getElementById('pompa_cost_total').value),
                    km_curent: parseInt(document.getElementById('pompa_km_curent').value),
                    pret_per_litru: document.getElementById('pompa_pret_per_litru').value ? parseFloat(document.getElementById('pompa_pret_per_litru').value) : null,
                    locatie: document.getElementById('pompa_locatie').value,
                    tip_combustibil: document.getElementById('pompa_tip_combustibil').value
                };
                
                fetch('/api/sincronizare-pompa', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('✅ Alimentare sincronizată cu succes!\\nConsum mediu: ' + data.consum_mediu + ' L/100km\\nKM parcurși: ' + data.km_parcursi);
                        closeSincronizarePompa();
                        document.getElementById('formSincronizarePompa').reset();
                        loadAlerte();
                    } else {
                        alert('❌ Eroare: ' + data.error);
                    }
                })
                .catch(error => {
                    alert('❌ Eroare: ' + error.message);
                });
            });
        }

        function loadMasini() {
            fetch('/api/masini')
                .then(response => {
                    if (response.status === 401) {
                        window.location.href = '/login';
                        return;
                    }
                    return response.json();
                })
                .then(data => {
                    if (!data) return;
                    
                    const container = document.getElementById('lista-masini');
                    document.getElementById('totalMasini').textContent = data.masini ? data.masini.length : 0;
                    
                    if (!data.masini || data.masini.length === 0) {
                        container.innerHTML = '<p>Nu există mașini în baza de date. Adaugă prima mașină!</p>';
                        return;
                    }
                    
                    container.innerHTML = data.masini.map(masina => \`
                        <div class="masina-item" onclick="viewMasina(\${masina.id})">
                            <div class="masina-info">
                                <div class="masina-numar">\${masina.numar_inmatriculare}</div>
                                <div class="masina-detalii">
                                    \${masina.marca} \${masina.model} • \${masina.tip_combustibil}
                                    \${masina.an_fabricatie ? '• An: ' + masina.an_fabricatie : ''}
                                    \${masina.culoare ? '• ' + masina.culoare : ''}
                                </div>
                            </div>
                            <div class="masina-actions">
                                <span style="color: #27ae60; font-weight: bold;">✅ Activă</span>
                                <button class="delete-btn" onclick="deleteMasina(event, \${masina.id})">🗑️</button>
                            </div>
                        </div>
                    \`).join('');
                })
                .catch(error => {
                    console.error('Eroare:', error);
                    document.getElementById('lista-masini').innerHTML = '<p style="color: red;">Eroare la încărcarea datelor</p>';
                });
        }

        function loadAlerte() {
            // Încarcă alertele documente
            fetch('/api/alerte-expirare')
                .then(response => response.json())
                .then(data => {
                    if (!data.alerte || data.alerte.length === 0) {
                        document.getElementById('alerte-container').innerHTML = '<p>✅ Nu există alerte active. Toate documentele sunt valide.</p>';
                        document.getElementById('alerteExpirate').textContent = '0';
                        document.getElementById('alerteCurand').textContent = '0';
                        return;
                    }
                    
                    const alerteExpirate = data.alerte.filter(a => a.status_alert === 'expirat').length;
                    const alerteCurand = data.alerte.filter(a => a.status_alert === 'expira_curand').length;
                    
                    document.getElementById('alerteExpirate').textContent = alerteExpirate;
                    document.getElementById('alerteCurand').textContent = alerteCurand;
                    
                    const alerteHTML = data.alerte.map(alert => \`
                        <div class="\${alert.status_alert === 'expirat' ? 'alert-item' : 'alert-warning-item'}">
                            <strong>\${alert.numar_inmatriculare} - \${alert.marca} \${alert.model}</strong><br>
                            \${alert.tip_document} expiră: \${new Date(alert.data_expirare).toLocaleDateString('ro-RO')}
                            <span style="float: right; font-weight: bold;">
                                \${alert.status_alert === 'expirat' ? '❌ EXPIRAT' : '⚠️ EXPIRĂ CURÂND'}
                            </span>
                        </div>
                    \`).join('');
                    
                    document.getElementById('alerte-container').innerHTML = alerteHTML;
                })
                .catch(error => {
                    console.error('Eroare încărcare alerte:', error);
                });

            // Încarcă alertele revizii
            fetch('/api/alerte-revizii')
                .then(response => response.json())
                .then(data => {
                    if (data.alerte_revizii && data.alerte_revizii.length > 0) {
                        document.getElementById('reviziiViitoare').textContent = data.alerte_revizii.length;
                        
                        const alerteReviziiHTML = data.alerte_revizii.map(alert => \`
                            <div class="alert-warning-item">
                                <strong>\${alert.numar_inmatriculare} - \${alert.marca} \${alert.model}</strong><br>
                                Mai sunt \${alert.km_ramasi} km până la revizie
                                <span style="float: right; font-weight: bold;">🔧 REVIZIE</span>
                            </div>
                        \`).join('');
                        
                        document.getElementById('alerte-container').innerHTML += alerteReviziiHTML;
                    } else {
                        document.getElementById('reviziiViitoare').textContent = '0';
                    }
                })
                .catch(error => {
                    console.error('Eroare încărcare alerte revizii:', error);
                });
        }

        function viewMasina(masinaId) {
            window.location.href = \`/masina/\${masinaId}\`;
        }

        function deleteMasina(event, masinaId) {
            event.stopPropagation();
            if (confirm('Sigur doriți să ștergeți această mașină? Toate datele asociate vor fi pierdute.')) {
                fetch(\`/api/masini/\${masinaId}\`, {
                    method: 'DELETE',
                    headers: {'Content-Type': 'application/json'}
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('✅ Mașină ștearsă cu succes!');
                        loadMasini();
                        loadAlerte();
                    } else {
                        alert('❌ Eroare: ' + data.error);
                    }
                })
                .catch(error => {
                    alert('❌ Eroare la ștergere: ' + error.message);
                });
            }
        }

        function adaugaMasina(masina) {
            fetch('/api/masini', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(masina)
            })
            .then(response => {
                if (response.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                return response.json();
            })
            .then(data => {
                if (data && data.success) {
                    alert('✅ Mașină adăugată cu succes!');
                    document.getElementById('form-adaugare-masina').reset();
                    loadMasini();
                } else if (data && data.error) {
                    alert('❌ Eroare: ' + data.error);
                }
            })
            .catch(error => {
                alert('❌ Eroare la adăugarea mașinii: ' + error.message);
            });
        }

        function addSampleCars() {
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
                },
                { 
                    numar_inmatriculare: "B450XYZ", 
                    marca: "Ford", 
                    model: "Transit", 
                    tip_combustibil: "diesel", 
                    an_fabricatie: 2023,
                    culoare: "Albastru"
                }
            ];

            sampleCars.forEach(car => {
                fetch('/api/masini', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(car)
                })
                .then(response => response.json())
                .then(data => {
                    if (data && data.success) {
                        console.log('✅ Mașina exemplu adăugată:', car.numar_inmatriculare);
                    }
                })
                .catch(error => {
                    console.error('Eroare la adăugarea mașinii exemplu:', error);
                });
            });

            setTimeout(() => {
                alert('✅ Mașinile exemplu au fost adăugate!');
                loadMasini();
            }, 1000);
        }

        function openSincronizarePompa() {
            document.getElementById('modalSincronizare').style.display = 'block';
            // Setează data și ora curentă ca valoare implicită
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('pompa_data_alimentare').value = now.toISOString().slice(0, 16);
        }

        function closeSincronizarePompa() {
            document.getElementById('modalSincronizare').style.display = 'none';
        }

        function logout() {
            fetch('/api/logout', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/login';
                }
            })
            .catch(error => {
                console.error('Eroare logout:', error);
                window.location.href = '/login';
            });
        }

        // Închide modalul când se face click în afara lui
        window.onclick = function(event) {
            const modal = document.getElementById('modalSincronizare');
            if (event.target === modal) {
                closeSincronizarePompa();
            }
        }
    </script>
</body>
</html>
`;

// Pagina pentru mașină individuală
const masinaHTML = `
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Detalii Mașină - Management Flotă</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; border-radius: 15px; padding: 20px; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
        .title { color: #4361ee; font-size: 2em; }
        .btn { background: #4361ee; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: background 0.3s; margin: 5px; }
        .btn:hover { background: #3a0ca3; }
        .btn-success { background: #27ae60; }
        .btn-success:hover { background: #219653; }
        .btn-warning { background: #f39c12; }
        .btn-warning:hover { background: #e67e22; }
        .btn-danger { background: #e74c3c; }
        .btn-danger:hover { background: #c0392b; }
        .card { background: white; border-radius: 15px; padding: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 600; color: #333; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-size: 1em; }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #4361ee; outline: none; }
        .tab { overflow: hidden; border: 1px solid #ccc; background-color: #f1f1f1; border-radius: 8px 8px 0 0; }
        .tab button { background-color: inherit; float: left; border: none; outline: none; cursor: pointer; padding: 14px 16px; transition: 0.3s; font-size: 1em; }
        .tab button:hover { background-color: #ddd; }
        .tab button.active { background-color: #4361ee; color: white; }
        .tabcontent { display: none; padding: 20px; border: 1px solid #ccc; border-top: none; border-radius: 0 0 8px 8px; background: white; }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background-color: #4361ee; color: white; }
        .table tr:hover { background-color: #f5f5f5; }
        .logout-btn { background: #95a5a6; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; }
        .logout-btn:hover { background: #7f8c8d; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 3px 10px rgba(0,0,0,0.1); }
        .stat-number { font-size: 2em; font-weight: bold; color: #4361ee; }
        .stat-label { color: #666; margin-top: 5px; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; }
        .modal-content { background: white; margin: 5% auto; padding: 20px; border-radius: 10px; width: 90%; max-width: 500px; }
        @media (max-width: 768px) {
            .grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1 class="title" id="masinaTitle">🚗 Detalii Mașină</h1>
            <div>
                <button class="btn" onclick="goBack()">⬅️ Înapoi</button>
                <button class="logout-btn" onclick="logout()">🚪 Delogare</button>
            </div>
        </header>

        <div class="card">
            <div class="tab">
                <button class="tablinks active" onclick="openTab(event, 'Dashboard')">Dashboard</button>
                <button class="tablinks" onclick="openTab(event, 'Alimentari')">Alimentări</button>
                <button class="tablinks" onclick="openTab(event, 'Revizii')">Revizii</button>
                <button class="tablinks" onclick="openTab(event, 'Documente')">Documente</button>
                <button class="tablinks" onclick="openTab(event, 'Setari')">Setări</button>
            </div>

            <div id="Dashboard" class="tabcontent" style="display: block;">
                <h2>Dashboard Mașină</h2>
                <div id="dashboardContent">Se încarcă...</div>
            </div>

            <div id="Alimentari" class="tabcontent">
                <h2>Alimentări</h2>
                <button class="btn btn-success" onclick="openModalAlimentare()">➕ Adaugă Alimentare</button>
                <div id="listaAlimentari">Se încarcă...</div>
            </div>

            <div id="Revizii" class="tabcontent">
                <h2>Revizii</h2>
                <button class="btn btn-success" onclick="openModalRevizie()">🔧 Adaugă Revizie</button>
                <div id="listaRevizii">Se încarcă...</div>
            </div>

            <div id="Documente" class="tabcontent">
                <h2>Documente</h2>
                <button class="btn btn-success" onclick="openModalDocument()">📄 Adaugă Document</button>
                <div id="listaDocumente">Se încarcă...</div>
            </div>

            <div id="Setari" class="tabcontent">
                <h2>Setări Revizie</h2>
                <form id="formSetariRevizie">
                    <div class="form-group">
                        <label for="setari_ultima_revizie_km">Ultima revizie la KM</label>
                        <input type="number" id="setari_ultima_revizie_km">
                    </div>
                    <div class="form-group">
                        <label for="setari_ultima_revizie_data">Data ultimei revizii</label>
                        <input type="date" id="setari_ultima_revizie_data">
                    </div>
                    <div class="form-group">
                        <label for="setari_interval_km">Interval revizie (KM)</label>
                        <input type="number" id="setari_interval_km" value="10000">
                    </div>
                    <button type="submit" class="btn btn-success">💾 Salvează Setări</button>
                </form>
            </div>
        </div>
    </div>

    <!-- Modal pentru adăugare alimentare -->
    <div id="modalAlimentare" class="modal">
        <div class="modal-content">
            <h2>⛽ Adaugă Alimentare</h2>
            <form id="formAlimentare">
                <div class="form-group">
                    <label for="alimentare_data">Data și Ora</label>
                    <input type="datetime-local" id="alimentare_data" required>
                </div>
                <div class="form-group">
                    <label for="alimentare_cantitate">Cantitate (litri) *</label>
                    <input type="number" step="0.01" id="alimentare_cantitate" required>
                </div>
                <div class="form-group">
                    <label for="alimentare_cost">Cost Total (RON) *</label>
                    <input type="number" step="0.01" id="alimentare_cost" required>
                </div>
                <div class="form-group">
                    <label for="alimentare_km">Kilometraj Curent *</label>
                    <input type="number" id="alimentare_km" required>
                </div>
                <div class="form-group">
                    <label for="alimentare_pret">Preț pe Litru (RON)</label>
                    <input type="number" step="0.01" id="alimentare_pret">
                </div>
                <div class="form-group">
                    <label for="alimentare_locatie">Locație</label>
                    <input type="text" id="alimentare_locatie">
                </div>
                <div class="form-group">
                    <label for="alimentare_tip_combustibil">Tip Combustibil</label>
                    <select id="alimentare_tip_combustibil">
                        <option value="diesel">Diesel</option>
                        <option value="benzina">Benzină</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-success">✅ Salvează Alimentarea</button>
                <button type="button" class="btn btn-danger" onclick="closeModalAlimentare()">❌ Anulează</button>
            </form>
        </div>
    </div>

    <!-- Modal pentru adăugare revizie -->
    <div id="modalRevizie" class="modal">
        <div class="modal-content">
            <h2>🔧 Adaugă Revizie</h2>
            <form id="formRevizie">
                <div class="form-group">
                    <label for="revizie_tip">Tip Revizie *</label>
                    <input type="text" id="revizie_tip" required placeholder="Revizie generală, Schimb ulei, etc.">
                </div>
                <div class="form-group">
                    <label for="revizie_data">Data Revizie *</label>
                    <input type="date" id="revizie_data" required>
                </div>
                <div class="form-group">
                    <label for="revizie_km">Kilometraj Curent *</label>
                    <input type="number" id="revizie_km" required>
                </div>
                <div class="form-group">
                    <label for="revizie_urmatoarea_km">Următoarea Revizie la KM</label>
                    <input type="number" id="revizie_urmatoarea_km">
                </div>
                <div class="form-group">
                    <label for="revizie_urmatoarea_data">Următoarea Revizie la Data</label>
                    <input type="date" id="revizie_urmatoarea_data">
                </div>
                <div class="form-group">
                    <label for="revizie_cost">Cost (RON)</label>
                    <input type="number" step="0.01" id="revizie_cost">
                </div>
                <div class="form-group">
                    <label for="revizie_service">Service</label>
                    <input type="text" id="revizie_service">
                </div>
                <div class="form-group">
                    <label for="revizie_observatii">Observații</label>
                    <textarea id="revizie_observatii" rows="3"></textarea>
                </div>
                <button type="submit" class="btn btn-success">✅ Salvează Revizia</button>
                <button type="button" class="btn btn-danger" onclick="closeModalRevizie()">❌ Anulează</button>
            </form>
        </div>
    </div>

    <!-- Modal pentru adăugare document -->
    <div id="modalDocument" class="modal">
        <div class="modal-content">
            <h2>📄 Adaugă Document</h2>
            <form id="formDocument">
                <div class="form-group">
                    <label for="document_tip">Tip Document *</label>
                    <select id="document_tip" required>
                        <option value="">Alege tipul</option>
                        <option value="ITP">ITP</option>
                        <option value="Asigurare RCA">Asigurare RCA</option>
                        <option value="Asigurare CASCO">Asigurare CASCO</option>
                        <option value="Vigneta">Vignetă</option>
                        <option value="Rovinieta">Rovinietă</option>
                        <option value="Carte Auto">Carte Auto</option>
                        <option value="Talon">Talon</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="document_numar">Număr Document</label>
                    <input type="text" id="document_numar">
                </div>
                <div class="form-group">
                    <label for="document_emitere">Data Emitere</label>
                    <input type="date" id="document_emitere">
                </div>
                <div class="form-group">
                    <label for="document_expirare">Data Expirare *</label>
                    <input type="date" id="document_expirare" required>
                </div>
                <div class="form-group">
                    <label for="document_cost">Cost (RON)</label>
                    <input type="number" step="0.01" id="document_cost">
                </div>
                <div class="form-group">
                    <label for="document_furnizor">Furnizor</label>
                    <input type="text" id="document_furnizor">
                </div>
                <div class="form-group">
                    <label for="document_observatii">Observații</label>
                    <textarea id="document_observatii" rows="3"></textarea>
                </div>
                <button type="submit" class="btn btn-success">✅ Salvează Document</button>
                <button type="button" class="btn btn-danger" onclick="closeModalDocument()">❌ Anulează</button>
            </form>
        </div>
    </div>

    <script>
        const masinaId = window.location.pathname.split('/').pop();

        document.addEventListener('DOMContentLoaded', function() {
            checkAuth();
        });

        function checkAuth() {
            fetch('/api/check-auth')
                .then(response => response.json())
                .then(data => {
                    if (data.authenticated) {
                        loadMasina();
                        loadDashboard();
                    } else {
                        window.location.href = '/login';
                    }
                })
                .catch(error => {
                    console.error('Eroare verificare auth:', error);
                    window.location.href = '/login';
                });
        }

        function loadMasina() {
            fetch(\`/api/masini/\${masinaId}\`)
                .then(response => response.json())
                .then(data => {
                    if (data.masina) {
                        document.getElementById('masinaTitle').textContent = \`🚗 \${data.masina.numar_inmatriculare} - \${data.masina.marca} \${data.masina.model}\`;
                    }
                })
                .catch(error => {
                    console.error('Eroare încărcare mașină:', error);
                });
        }

        function loadDashboard() {
            fetch(\`/api/masini/\${masinaId}/dashboard\`)
                .then(response => response.json())
                .then(data => {
                    let html = \`
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-number">\${data.consum_mediu_general || '0'} L/100km</div>
                                <div class="stat-label">Consum Mediu</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-number">\${data.cost_luna || '0'} RON</div>
                                <div class="stat-label">Cost Lună Curentă</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-number">\${data.km_pana_la_revizie || '0'} km</div>
                                <div class="stat-label">KM până la Revizie</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-number">\${data.procent_revizie ? data.procent_revizie.toFixed(0) + '%' : '0%'}</div>
                                <div class="stat-label">Procent Revizie</div>
                            </div>
                        </div>
                    \`;

                    if (data.ultima_alimentare) {
                        html += \`
                            <h3>Ultima Alimentare</h3>
                            <p>Data: \${new Date(data.ultima_alimentare.data_alimentare).toLocaleDateString('ro-RO')}</p>
                            <p>KM: \${data.ultima_alimentare.km_curent}</p>
                            <p>Consum: \${data.ultima_alimentare.consum_mediu} L/100km</p>
                        \`;
                    }

                    if (data.revizie) {
                        html += \`
                            <h3>Informații Revizie</h3>
                            <p>Ultima revizie: \${data.revizie.ultima_revizie_km} km</p>
                            <p>Următoarea revizie: \${data.revizie.urmatoarea_revizie_km} km</p>
                            <p>Interval: \${data.revizie.interval_km} km</p>
                        \`;
                    }

                    document.getElementById('dashboardContent').innerHTML = html;
                })
                .catch(error => {
                    console.error('Eroare încărcare dashboard:', error);
                    document.getElementById('dashboardContent').innerHTML = '<p>Eroare la încărcarea datelor</p>';
                });
        }

        function openTab(evt, tabName) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tabcontent");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].style.display = "none";
            }
            tablinks = document.getElementsByClassName("tablinks");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].className = tablinks[i].className.replace(" active", "");
            }
            document.getElementById(tabName).style.display = "block";
            evt.currentTarget.className += " active";

            // Încarcă conținutul specific tab-ului
            if (tabName === 'Alimentari') {
                loadAlimentari();
            } else if (tabName === 'Revizii') {
                loadRevizii();
            } else if (tabName === 'Documente') {
                loadDocumente();
            } else if (tabName === 'Setari') {
                loadSetari();
            }
        }

        function loadAlimentari() {
            fetch(\`/api/masini/\${masinaId}/alimentari\`)
                .then(response => response.json())
                .then(data => {
                    if (!data.alimentari || data.alimentari.length === 0) {
                        document.getElementById('listaAlimentari').innerHTML = '<p>Nu există alimentări înregistrate.</p>';
                        return;
                    }

                    let html = '<table class="table"><thead><tr><th>Data</th><th>Cantitate (L)</th><th>Cost (RON)</th><th>KM</th><th>Consum (L/100km)</th></tr></thead><tbody>';
                    data.alimentari.forEach(alimentare => {
                        html += \`
                            <tr>
                                <td>\${new Date(alimentare.data_alimentare).toLocaleDateString('ro-RO')}</td>
                                <td>\${alimentare.cantitate_litri}</td>
                                <td>\${alimentare.cost_total}</td>
                                <td>\${alimentare.km_curent}</td>
                                <td>\${alimentare.consum_mediu || '-'}</td>
                            </tr>
                        \`;
                    });
                    html += '</tbody></table>';
                    document.getElementById('listaAlimentari').innerHTML = html;
                })
                .catch(error => {
                    console.error('Eroare încărcare alimentări:', error);
                    document.getElementById('listaAlimentari').innerHTML = '<p>Eroare la încărcarea alimentărilor</p>';
                });
        }

        function loadRevizii() {
            fetch(\`/api/masini/\${masinaId}/revizii\`)
                .then(response => response.json())
                .then(data => {
                    if (!data.revizii || data.revizii.length === 0) {
                        document.getElementById('listaRevizii').innerHTML = '<p>Nu există revizii înregistrate.</p>';
                        return;
                    }

                    let html = '<table class="table"><thead><tr><th>Tip</th><th>Data</th><th>KM</th><th>Cost</th><th>Service</th></tr></thead><tbody>';
                    data.revizii.forEach(revizie => {
                        html += \`
                            <tr>
                                <td>\${revizie.tip_revizie}</td>
                                <td>\${new Date(revizie.data_revizie).toLocaleDateString('ro-RO')}</td>
                                <td>\${revizie.km_curent}</td>
                                <td>\${revizie.cost || '-'}</td>
                                <td>\${revizie.service || '-'}</td>
                            </tr>
                        \`;
                    });
                    html += '</tbody></table>';
                    document.getElementById('listaRevizii').innerHTML = html;
                })
                .catch(error => {
                    console.error('Eroare încărcare revizii:', error);
                    document.getElementById('listaRevizii').innerHTML = '<p>Eroare la încărcarea reviziilor</p>';
                });
        }

        function loadDocumente() {
            fetch(\`/api/masini/\${masinaId}/documente\`)
                .then(response => response.json())
                .then(data => {
                    if (!data.documente || data.documente.length === 0) {
                        document.getElementById('listaDocumente').innerHTML = '<p>Nu există documente înregistrate.</p>';
                        return;
                    }

                    let html = '<table class="table"><thead><tr><th>Tip</th><th>Număr</th><th>Emitere</th><th>Expiră</th><th>Cost</th></tr></thead><tbody>';
                    data.documente.forEach(document => {
                        const expirare = new Date(document.data_expirare);
                        const today = new Date();
                        const diffTime = expirare - today;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        let style = '';
                        if (diffDays < 0) {
                            style = 'style="color: red; font-weight: bold;"';
                        } else if (diffDays < 30) {
                            style = 'style="color: orange; font-weight: bold;"';
                        }
                        html += \`
                            <tr>
                                <td>\${document.tip_document}</td>
                                <td>\${document.numar_document || '-'}</td>
                                <td>\${document.data_emitere ? new Date(document.data_emitere).toLocaleDateString('ro-RO') : '-'}</td>
                                <td \${style}>\${new Date(document.data_expirare).toLocaleDateString('ro-RO')}</td>
                                <td>\${document.cost || '-'}</td>
                            </tr>
                        \`;
                    });
                    html += '</tbody></table>';
                    document.getElementById('listaDocumente').innerHTML = html;
                })
                .catch(error => {
                    console.error('Eroare încărcare documente:', error);
                    document.getElementById('listaDocumente').innerHTML = '<p>Eroare la încărcarea documentelor</p>';
                });
        }

        function loadSetari() {
            fetch(\`/api/masini/\${masinaId}/dashboard\`)
                .then(response => response.json())
                .then(data => {
                    if (data.revizie) {
                        document.getElementById('setari_ultima_revizie_km').value = data.revizie.ultima_revizie_km || '';
                        document.getElementById('setari_ultima_revizie_data').value = data.revizie.ultima_revizie_data || '';
                        document.getElementById('setari_interval_km').value = data.revizie.interval_km || 10000;
                    }
                })
                .catch(error => {
                    console.error('Eroare încărcare setări:', error);
                });
        }

        function openModalAlimentare() {
            document.getElementById('modalAlimentare').style.display = 'block';
            // Setează data și ora curentă ca valoare implicită
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('alimentare_data').value = now.toISOString().slice(0, 16);
        }

        function closeModalAlimentare() {
            document.getElementById('modalAlimentare').style.display = 'none';
        }

        function openModalRevizie() {
            document.getElementById('modalRevizie').style.display = 'block';
            document.getElementById('revizie_data').valueAsDate = new Date();
        }

        function closeModalRevizie() {
            document.getElementById('modalRevizie').style.display = 'none';
        }

        function openModalDocument() {
            document.getElementById('modalDocument').style.display = 'block';
            // Setează data expirării la o lună de acum
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            document.getElementById('document_expirare').valueAsDate = nextMonth;
        }

        function closeModalDocument() {
            document.getElementById('modalDocument').style.display = 'none';
        }

        // Setare event listeners pentru formulare
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('formAlimentare').addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = {
                    data_alimentare: document.getElementById('alimentare_data').value,
                    cantitate_litri: parseFloat(document.getElementById('alimentare_cantitate').value),
                    cost_total: parseFloat(document.getElementById('alimentare_cost').value),
                    km_curent: parseInt(document.getElementById('alimentare_km').value),
                    pret_per_litru: document.getElementById('alimentare_pret').value ? parseFloat(document.getElementById('alimentare_pret').value) : null,
                    locatie: document.getElementById('alimentare_locatie').value,
                    tip_combustibil: document.getElementById('alimentare_tip_combustibil').value
                };

                fetch(\`/api/masini/\${masinaId}/alimentari\`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(formData)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Alimentare adăugată cu succes!');
                        closeModalAlimentare();
                        loadAlimentari();
                        loadDashboard();
                    } else {
                        alert('Eroare: ' + data.error);
                    }
                })
                .catch(error => {
                    alert('Eroare: ' + error.message);
                });
            });

            document.getElementById('formRevizie').addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = {
                    tip_revizie: document.getElementById('revizie_tip').value,
                    data_revizie: document.getElementById('revizie_data').value,
                    km_curent: parseInt(document.getElementById('revizie_km').value),
                    urmatoarea_revizie_km: document.getElementById('revizie_urmatoarea_km').value ? parseInt(document.getElementById('revizie_urmatoarea_km').value) : null,
                    urmatoarea_revizie_data: document.getElementById('revizie_urmatoarea_data').value,
                    cost: document.getElementById('revizie_cost').value ? parseFloat(document.getElementById('revizie_cost').value) : null,
                    service: document.getElementById('revizie_service').value,
                    observatii: document.getElementById('revizie_observatii').value
                };

                fetch(\`/api/masini/\${masinaId}/revizii\`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(formData)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Revizie adăugată cu succes!');
                        closeModalRevizie();
                        loadRevizii();
                        loadDashboard();
                    } else {
                        alert('Eroare: ' + data.error);
                    }
                })
                .catch(error => {
                    alert('Eroare: ' + error.message);
                });
            });

            document.getElementById('formDocument').addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = {
                    tip_document: document.getElementById('document_tip').value,
                    numar_document: document.getElementById('document_numar').value,
                    data_emitere: document.getElementById('document_emitere').value,
                    data_expirare: document.getElementById('document_expirare').value,
                    cost: document.getElementById('document_cost').value ? parseFloat(document.getElementById('document_cost').value) : null,
                    furnizor: document.getElementById('document_furnizor').value,
                    observatii: document.getElementById('document_observatii').value
                };

                fetch(\`/api/masini/\${masinaId}/documente\`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(formData)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Document adăugat cu succes!');
                        closeModalDocument();
                        loadDocumente();
                    } else {
                        alert('Eroare: ' + data.error);
                    }
                })
                .catch(error => {
                    alert('Eroare: ' + error.message);
                });
            });

            document.getElementById('formSetariRevizie').addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = {
                    ultima_revizie_km: document.getElementById('setari_ultima_revizie_km').value,
                    ultima_revizie_data: document.getElementById('setari_ultima_revizie_data').value,
                    interval_km: document.getElementById('setari_interval_km').value
                };

                fetch(\`/api/masini/\${masinaId}/setare-revizie\`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(formData)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Setări salvate cu succes!');
                        loadDashboard();
                    } else {
                        alert('Eroare: ' + data.error);
                    }
                })
                .catch(error => {
                    alert('Eroare: ' + error.message);
                });
            });
        });

        function goBack() {
            window.location.href = '/';
        }

        function logout() {
            fetch('/api/logout', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/login';
                }
            })
            .catch(error => {
                console.error('Eroare logout:', error);
                window.location.href = '/login';
            });
        }

        // Închide modalurile când se face click în afara lor
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
`;

// Pagina pentru rapoarte
const rapoarteHTML = `
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapoarte - Management Flotă</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; border-radius: 15px; padding: 20px; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
        .title { color: #4361ee; font-size: 2em; }
        .btn { background: #4361ee; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: background 0.3s; margin: 5px; }
        .btn:hover { background: #3a0ca3; }
        .card { background: white; border-radius: 15px; padding: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 600; color: #333; }
        .form-group input, .form-group select { width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-size: 1em; }
        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .table th, .table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
        .table th { background-color: #4361ee; color: white; }
        .table tr:hover { background-color: #f5f5f5; }
        .logout-btn { background: #95a5a6; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; }
        .logout-btn:hover { background: #7f8c8d; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 3px 10px rgba(0,0,0,0.1); }
        .stat-number { font-size: 2em; font-weight: bold; color: #4361ee; }
        .stat-label { color: #666; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1 class="title">📊 Rapoarte și Statistici</h1>
            <div>
                <button class="btn" onclick="goBack()">⬅️ Înapoi</button>
                <button class="logout-btn" onclick="logout()">🚪 Delogare</button>
            </div>
        </header>

        <div class="card">
            <h2>Filtre Rapoarte</h2>
            <form id="formFiltreRapoarte">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label for="filtru_masina">Mașină</label>
                        <select id="filtru_masina">
                            <option value="">Toate mașinile</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="filtru_luna">Lună</label>
                        <select id="filtru_luna">
                            <option value="">Toate lunile</option>
                            <option value="01">Ianuarie</option>
                            <option value="02">Februarie</option>
                            <option value="03">Martie</option>
                            <option value="04">Aprilie</option>
                            <option value="05">Mai</option>
                            <option value="06">Iunie</option>
                            <option value="07">Iulie</option>
                            <option value="08">August</option>
                            <option value="09">Septembrie</option>
                            <option value="10">Octombrie</option>
                            <option value="11">Noiembrie</option>
                            <option value="12">Decembrie</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="filtru_an">An</label>
                        <select id="filtru_an">
                            <option value="">Toți anii</option>
                            <option value="2023">2023</option>
                            <option value="2024">2024</option>
                            <option value="2025">2025</option>
                        </select>
                    </div>
                </div>
                <button type="submit" class="btn btn-success">🔍 Generează Raport</button>
            </form>
        </div>

        <div class="card">
            <h2>Raport Consum Combustibil</h2>
            <div id="raportConsum">
                <p>Selectează filtrele și generează raportul</p>
            </div>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            checkAuth();
        });

        function checkAuth() {
            fetch('/api/check-auth')
                .then(response => response.json())
                .then(data => {
                    if (data.authenticated) {
                        loadMasini();
                        setupEventListeners();
                    } else {
                        window.location.href = '/login';
                    }
                })
                .catch(error => {
                    console.error('Eroare verificare auth:', error);
                    window.location.href = '/login';
                });
        }

        function loadMasini() {
            fetch('/api/masini')
                .then(response => response.json())
                .then(data => {
                    if (data.masini) {
                        const select = document.getElementById('filtru_masina');
                        data.masini.forEach(masina => {
                            const option = document.createElement('option');
                            option.value = masina.id;
                            option.textContent = \`\${masina.numar_inmatriculare} - \${masina.marca} \${masina.model}\`;
                            select.appendChild(option);
                        });
                    }
                })
                .catch(error => {
                    console.error('Eroare încărcare mașini:', error);
                });
        }

        function setupEventListeners() {
            document.getElementById('formFiltreRapoarte').addEventListener('submit', function(e) {
                e.preventDefault();
                genereazaRaport();
            });
        }

        function genereazaRaport() {
            const masinaId = document.getElementById('filtru_masina').value;
            const luna = document.getElementById('filtru_luna').value;
            const an = document.getElementById('filtru_an').value;

            let url = '/api/rapoarte/consum?';
            if (masinaId) url += \`masina_id=\${masinaId}&\`;
            if (luna && an) url += \`luna=\${luna}&an=\${an}\`;

            fetch(url)
                .then(response => response.json())
                .then(data => {
                    if (!data.raport || data.raport.length === 0) {
                        document.getElementById('raportConsum').innerHTML = '<p>Nu există date pentru filtrele selectate.</p>';
                        return;
                    }

                    let html = '<table class="table"><thead><tr><th>Mașină</th><th>Consum Mediu (L/100km)</th><th>Total Litri</th><th>Cost Total (RON)</th><th>Număr Alimentări</th></tr></thead><tbody>';
                    
                    data.raport.forEach(raport => {
                        html += \`
                            <tr>
                                <td>\${raport.numar_inmatriculare} - \${raport.marca} \${raport.model}</td>
                                <td>\${raport.consum_mediu ? raport.consum_mediu.toFixed(2) : 'N/A'}</td>
                                <td>\${raport.total_litri ? raport.total_litri.toFixed(2) : '0'}</td>
                                <td>\${raport.cost_total ? raport.cost_total.toFixed(2) : '0'}</td>
                                <td>\${raport.numar_alimentari}</td>
                            </tr>
                        \`;
                    });
                    
                    html += '</tbody></table>';
                    document.getElementById('raportConsum').innerHTML = html;
                })
                .catch(error => {
                    console.error('Eroare generare raport:', error);
                    document.getElementById('raportConsum').innerHTML = '<p>Eroare la generarea raportului</p>';
                });
        }

        function goBack() {
            window.location.href = '/';
        }

        function logout() {
            fetch('/api/logout', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = '/login';
                }
            })
            .catch(error => {
                console.error('Eroare logout:', error);
                window.location.href = '/login';
            });
        }
    </script>
</body>
</html>
`;

// ==================== RUTE PAGINI HTML ====================
app.get('/', requireAuth, (req, res) => {
    res.send(mainHTML);
});

app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.send(loginHTML);
});

app.get('/masina/:id', requireAuth, (req, res) => {
    res.send(masinaHTML);
});

app.get('/rapoarte', requireAuth, (req, res) => {
    res.send(rapoarteHTML);
});

// ==================== RUTE AUTENTIFICARE ====================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username și parolă sunt obligatorii' });
    }
    
    db.get(
        'SELECT * FROM users WHERE username = ? AND status = "activ"',
        [username],
        (err, user) => {
            if (err) {
                console.error('Eroare login:', err);
                return res.status(500).json({ error: 'Eroare server' });
            }
            
            if (!user) {
                return res.status(401).json({ error: 'Username sau parolă incorectă' });
            }
            
            if (bcrypt.compareSync(password, user.password_hash)) {
                req.session.user = {
                    id: user.id,
                    username: user.username,
                    nume: user.nume,
                    is_admin: user.is_admin
                };
                res.json({ 
                    success: true, 
                    message: 'Autentificare reușită!',
                    user: req.session.user
                });
            } else {
                res.status(401).json({ error: 'Username sau parolă incorectă' });
            }
        }
    );
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Eroare la logout' });
        res.json({ success: true, message: 'Delogare reușită' });
    });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

// ==================== RUTE MAȘINI ====================
app.get('/api/masini', requireAuth, (req, res) => {
    db.all('SELECT * FROM masini ORDER BY numar_inmatriculare', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ masini: rows });
    });
});

app.get('/api/masini/:id', requireAuth, (req, res) => {
    const masinaId = req.params.id;
    
    db.get('SELECT * FROM masini WHERE id = ?', [masinaId], (err, masina) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!masina) {
            return res.status(404).json({ error: 'Mașina nu a fost găsită' });
        }
        res.json({ masina });
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
                [this.lastID, 10000],
                (err) => {
                    if (err) console.error('Eroare creare setări revizie:', err);
                }
            );
            
            res.json({ 
                success: true,
                message: 'Mașină adăugată cu succes!',
                id: this.lastID 
            });
        }
    );
});

app.put('/api/masini/:id', requireAuth, (req, res) => {
    const masinaId = req.params.id;
    const { numar_inmatriculare, marca, model, an_fabricatie, tip_combustibil, culoare, serie_sasiu } = req.body;
    
    db.run(
        `UPDATE masini SET 
            numar_inmatriculare = ?, marca = ?, model = ?, an_fabricatie = ?, 
            tip_combustibil = ?, culoare = ?, serie_sasiu = ?
         WHERE id = ?`,
        [numar_inmatriculare, marca, model, an_fabricatie, tip_combustibil, culoare, serie_sasiu, masinaId],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Mașina nu a fost găsită' });
            }
            res.json({ 
                success: true,
                message: 'Mașină actualizată cu succes!'
            });
        }
    );
});

app.delete('/api/masini/:id', requireAuth, (req, res) => {
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

// ==================== RUTE INTEGRARE POMPĂ ====================
app.post('/api/sincronizare-pompa', requireAuth, (req, res) => {
    const { numar_inmatriculare, data_alimentare, cantitate_litri, cost_total, km_curent, pret_per_litru, locatie, tip_combustibil } = req.body;
    
    if (!numar_inmatriculare || !cantitate_litri || !cost_total || !km_curent) {
        return res.status(400).json({ error: 'Date incomplete de la pompa' });
    }
    
    db.get('SELECT id FROM masini WHERE numar_inmatriculare = ?', [numar_inmatriculare], (err, masina) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!masina) {
            return res.status(404).json({ error: 'Mașina nu a fost găsită în sistem' });
        }
        
        const masinaId = masina.id;
        
        calculeazaConsumSiKm(masinaId, km_curent, cantitate_litri, (kmParcursi, consumMediu) => {
            
            db.run(
                `INSERT INTO alimentari (masina_id, data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, km_parcursi, consum_mediu, locatie, tip_combustibil, numar_inmatriculare_pompa, sincronizat_cu_pompa) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [masinaId, data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, kmParcursi, consumMediu, locatie, tip_combustibil, numar_inmatriculare, 1],
                function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    
                    verificaNecesitateRevizie(masinaId, km_curent);
                    
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

// ==================== RUTE DASHBOARD ȘI STATISTICI ====================
app.get('/api/masini/:id/dashboard', requireAuth, (req, res) => {
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
                        let consumMediu = 0;
                        if (alimentari && alimentari.length > 0) {
                            consumMediu = alimentari.reduce((acc, curr) => acc + curr.consum_mediu, 0) / alimentari.length;
                        }
                        dashboardData.consum_mediu_general = parseFloat(consumMediu.toFixed(2));
                        
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
                                        dashboardData.cost_luna = cost ? parseFloat(cost.cost_luna.toFixed(2)) : 0;
                                        
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
app.post('/api/masini/:id/setare-revizie', requireAuth, (req, res) => {
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

// ==================== RUTE REVIZII ====================
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

// ==================== RUTE DOCUMENTE ====================
app.get('/api/masini/:id/documente', requireAuth, (req, res) => {
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

app.post('/api/masini/:id/documente', requireAuth, (req, res) => {
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

// ==================== RUTE ALIMENTĂRI ====================
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
    const { data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, locatie, tip_combustibil } = req.body;
    
    if (!cantitate_litri || !cost_total || !km_curent) {
        return res.status(400).json({ error: 'Cantitate, cost și kilometraj sunt obligatorii' });
    }
    
    calculeazaConsumSiKm(masinaId, km_curent, cantitate_litri, (kmParcursi, consumMediu) => {
        
        db.run(
            `INSERT INTO alimentari (masina_id, data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, km_parcursi, consum_mediu, locatie, tip_combustibil) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [masinaId, data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, kmParcursi, consumMediu, locatie, tip_combustibil],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                verificaNecesitateRevizie(masinaId, km_curent);
                
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

// ==================== RUTE ALERTE ====================
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

app.get('/api/alerte-revizii', requireAuth, (req, res) => {
    db.all(
        `SELECT m.numar_inmatriculare, m.marca, m.model, sr.urmatoarea_revizie_km,
                MAX(a.km_curent) as km_curent,
                (sr.urmatoarea_revizie_km - MAX(a.km_curent)) as km_ramasi
         FROM masini m
         JOIN setari_revizii sr ON m.id = sr.masina_id
         LEFT JOIN alimentari a ON m.id = a.masina_id
         GROUP BY m.id
         HAVING km_ramasi <= 1000 AND km_ramasi > 0`,
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ alerte_revizii: rows });
        }
    );
});

// ==================== RAPOARTE ȘI STATISTICI ====================
app.get('/api/rapoarte/consum', requireAuth, (req, res) => {
    const { masina_id, luna, an } = req.query;
    
    let query = `
        SELECT m.numar_inmatriculare, m.marca, m.model, 
               AVG(a.consum_mediu) as consum_mediu,
               SUM(a.cost_total) as cost_total,
               SUM(a.cantitate_litri) as total_litri,
               COUNT(*) as numar_alimentari
        FROM alimentari a
        JOIN masini m ON a.masina_id = m.id
        WHERE 1=1
    `;
    
    const params = [];
    
    if (masina_id) {
        query += ' AND m.id = ?';
        params.push(masina_id);
    }
    
    if (luna && an) {
        query += ' AND strftime("%Y-%m", a.data_alimentare) = ?';
        params.push(`${an}-${luna.padStart(2, '0')}`);
    }
    
    query += ' GROUP BY m.id ORDER BY consum_mediu DESC';
    
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ raport: rows });
    });
});

// ==================== RUTĂ HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        port: process.env.PORT,
        database: dbPath
    });
});

// Middleware securitate pentru producție
app.use((req, res, next) => {
    // Protecție împotriva XSS
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Pornire server
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 ========================================');
    console.log('✅ SISTEMUL RULEAZĂ ÎN MOD PRODUCȚIE!');
    console.log(`📍 Server running on port: ${PORT}`);
    console.log(`🌐 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`💾 Database path: ${dbPath}`);
    
    if (isProduction) {
        console.log('🌍 Aplicația este accesibilă public!');
    } else {
        console.log(`📱 Accesează aplicația la: http://localhost:${PORT}`);
    }
    
    console.log('🔐 User: Tzrkalex | Parola: Ro27821091');
    console.log('🚗 ========================================');
});
