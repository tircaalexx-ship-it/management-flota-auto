const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de bază
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configurare session pentru production
app.use(session({
    secret: process.env.SESSION_SECRET || 'flota-auto-secret-2024-online',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// Configurare baza de date pentru production
const dbPath = process.env.NODE_ENV === 'production' ? ':memory:' : './data/flota.db';

// Conectare la baza de date
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Eroare baza de date:', err.message);
    } else {
        console.log('✅ Conectat la baza de date:', dbPath);
        initDatabase();
    }
});

// Inițializare baza de date
function initDatabase() {
    // Tabel utilizatori
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            nume TEXT NOT NULL,
            email TEXT,
            is_admin INTEGER DEFAULT 0,
            status TEXT DEFAULT 'activ',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel users:', err);
        else createDefaultUser();
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
            status TEXT DEFAULT 'activ',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel masini:', err);
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
            km_curent INTEGER,
            km_parcursi REAL,
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (masina_id) REFERENCES masini (id)
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel documente:', err);
    });

    // Tabel setări revizii
    db.run(`
        CREATE TABLE IF NOT EXISTS setari_revizii (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            masina_id INTEGER UNIQUE NOT NULL,
            ultima_revizie_km INTEGER,
            ultima_revizie_data DATE,
            urmatoarea_revizie_km INTEGER,
            interval_km INTEGER DEFAULT 10000,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (masina_id) REFERENCES masini (id)
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel setari_revizii:', err);
    });

    console.log('✅ Baza de date inițializată');
}

// Crează utilizatorul principal
function createDefaultUser() {
    const passwordHash = bcrypt.hashSync('Ro27821091', 10);
    
    db.run(
        `INSERT OR IGNORE INTO users (username, password_hash, nume, email, is_admin) VALUES (?, ?, ?, ?, ?)`,
        ['Tzrkalex', passwordHash, 'Alexandru Tirca', 'tzrkalex@example.com', 1],
        function(err) {
            if (err) {
                console.error('Eroare creare utilizator:', err);
            } else {
                console.log('✅ Utilizator creat: Tzrkalex / Ro27821091');
                // Adaugă mașini exemplu la pornire
                addSampleCars();
            }
        }
    );
}

// Adaugă mașini exemplu
function addSampleCars() {
    const sampleCars = [
        { numar_inmatriculare: "GJ07ZR", marca: "BMW", model: "740XD", culoare: "Negru" },
        { numar_inmatriculare: "B123ABC", marca: "Volkswagen", model: "Golf", culoare: "Alb" },
        { numar_inmatriculare: "IS99TST", marca: "Audi", model: "A6", culoare: "Gri" }
    ];

    sampleCars.forEach(car => {
        db.run(
            'INSERT OR IGNORE INTO masini (numar_inmatriculare, marca, model, culoare) VALUES (?, ?, ?, ?)',
            [car.numar_inmatriculare, car.marca, car.model, car.culoare],
            function(err) {
                if (err) {
                    console.error('Eroare adăugare mașină exemplu:', err);
                } else {
                    console.log('✅ Mașină exemplu adăugată:', car.numar_inmatriculare);
                }
            }
        );
    });
}

// Middleware autentificare
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            .login-box { background: white; padding: 2.5rem; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); width: 100%; max-width: 400px; text-align: center; margin: 1rem; }
            h2 { color: #333; margin-bottom: 1.5rem; font-size: 1.5rem; }
            input { width: 100%; padding: 12px; margin: 8px 0; border: 2px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 1em; }
            button { width: 100%; background: #4361ee; color: white; border: none; padding: 12px; border-radius: 8px; font-size: 1.1em; cursor: pointer; margin-top: 10px; transition: background 0.3s; }
            button:hover { background: #3a0ca3; }
            .error { color: #e74c3c; background: #f8d7da; padding: 10px; border-radius: 5px; margin: 10px 0; display: none; }
            .info { background: #e7f3ff; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 14px; color: #333; text-align: left; }
            .success { color: #27ae60; font-weight: bold; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="login-box">
            <h2>🔐 Autentificare</h2>
            <div class="error" id="errorMessage"></div>
            
            <form id="loginForm">
                <input type="text" id="username" placeholder="Username" value="Tzrkalex" required>
                <input type="password" id="password" placeholder="Password" value="Ro27821091" required>
                <button type="submit">ACCESEAZĂ SISTEMUL</button>
            </form>
            
            <div class="info">
                <strong>Cont demo:</strong><br>
                👤 <strong>User:</strong> Tzrkalex<br>
                🔑 <strong>Parola:</strong> Ro27821091
            </div>
            
            <div class="success" id="successMessage" style="display: none;">
                ✅ Autentificare reușită! Redirecționare...
            </div>
        </div>

        <script>
            document.getElementById('loginForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                const errorDiv = document.getElementById('errorMessage');
                const successDiv = document.getElementById('successMessage');
                
                errorDiv.style.display = 'none';
                successDiv.style.display = 'none';
                
                try {
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        successDiv.style.display = 'block';
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 1000);
                    } else {
                        errorDiv.textContent = data.error || 'Eroare la autentificare';
                        errorDiv.style.display = 'block';
                    }
                } catch (error) {
                    errorDiv.textContent = 'Eroare de conexiune cu serverul';
                    errorDiv.style.display = 'block';
                }
            });
        </script>
    </body>
    </html>
    `);
});

// Pagina principală - scurtată pentru online
app.get('/', requireAuth, (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Management Flotă Auto</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; color: #333; line-height: 1.6; }
            
            .header { background: linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%); color: white; padding: 1.5rem; text-align: center; }
            .header h1 { margin-bottom: 0.5rem; font-size: 1.8rem; }
            .user-info { background: rgba(255,255,255,0.2); padding: 0.5rem 1rem; border-radius: 20px; display: inline-block; margin-top: 1rem; }
            
            .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
            .card { background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
            
            .btn { background: #4361ee; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; margin: 0.5rem; text-decoration: none; display: inline-block; }
            .btn:hover { background: #3a0ca3; }
            .btn-success { background: #2ecc71; }
            .btn-danger { background: #e74c3c; }
            
            .masina-item { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚗 Management Flotă Auto</h1>
            <p>Sistem online de gestionare a mașinilor și documentelor</p>
            <div class="user-info">
                👤 ${req.session.user.nume} 
                <button onclick="logout()" class="btn btn-danger" style="margin-left: 10px; padding: 0.25rem 0.75rem; font-size: 0.8rem;">🚪 Delogare</button>
            </div>
        </div>
        
        <div class="container">
            <div class="card">
                <h2>📋 Mașinile Tale</h2>
                <button class="btn" onclick="loadMasini()">🔄 Reîncarcă</button>
                <button class="btn btn-success" onclick="addSampleCars()">🚙 Adaugă Mașini Exemplu</button>
                <div id="lista-masini" style="margin-top: 1rem;">
                    <p>⏳ Se încarcă mașinile...</p>
                </div>
            </div>
            
            <div class="card">
                <h2>➕ Adaugă Mașină Nouă</h2>
                <form id="form-masina">
                    <input type="text" id="numar" placeholder="Număr Înmatriculare" required style="padding: 0.5rem; margin: 0.25rem; border: 1px solid #ddd; border-radius: 4px;">
                    <input type="text" id="marca" placeholder="Marcă" required style="padding: 0.5rem; margin: 0.25rem; border: 1px solid #ddd; border-radius: 4px;">
                    <input type="text" id="model" placeholder="Model" required style="padding: 0.5rem; margin: 0.25rem; border: 1px solid #ddd; border-radius: 4px;">
                    <button type="submit" class="btn btn-success">✅ Adaugă</button>
                </form>
            </div>
            
            <div class="card">
                <h2>🔔 Alertă Expirări Documente</h2>
                <button class="btn" onclick="loadAlerte()">🔄 Verifică</button>
                <div id="alerte-content" style="margin-top: 1rem;">
                    <p>Apasă butonul pentru a verifica documentele expirate.</p>
                </div>
            </div>
        </div>

        <script>
            function loadMasini() {
                fetch('/api/masini')
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('lista-masini');
                    const masini = data.masini || [];
                    
                    if (masini.length === 0) {
                        container.innerHTML = '<p>🚗 Nu există mașini. Adaugă prima mașină!</p>';
                        return;
                    }
                    
                    container.innerHTML = masini.map(masina => \`
                        <div class="masina-item">
                            <strong>\${masina.numar_inmatriculare}</strong> - \${masina.marca} \${masina.model}
                            <button onclick="deleteMasina(\${masina.id})" class="btn btn-danger" style="float: right; padding: 0.25rem 0.5rem;">🗑️</button>
                        </div>
                    \`).join('');
                })
                .catch(error => {
                    document.getElementById('lista-masini').innerHTML = '<p>Eroare la încărcare</p>';
                });
            }
            
            function addSampleCars() {
                fetch('/api/add-sample-cars', { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        loadMasini();
                        alert('✅ Mașini exemplu adăugate!');
                    }
                });
            }
            
            function deleteMasina(id) {
                if (confirm('Sigur vrei să ștergi?')) {
                    fetch('/api/masini/' + id, { method: 'DELETE' })
                    .then(r => r.json())
                    .then(data => {
                        if (data.success) {
                            loadMasini();
                            alert('✅ Mașină ștearsă!');
                        }
                    });
                }
            }
            
            function loadAlerte() {
                fetch('/api/alerte-expirare')
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('alerte-content');
                    const alerte = data.alerte || [];
                    
                    if (alerte.length === 0) {
                        container.innerHTML = '<p>✅ Toate documentele sunt valabile!</p>';
                        return;
                    }
                    
                    container.innerHTML = alerte.map(alert => \`
                        <div class="masina-item" style="border-left: 4px solid \${alert.status_alert === 'expirat' ? '#e74c3c' : '#f39c12'};">
                            <strong>\${alert.numar_inmatriculare}</strong> - \${alert.tip_document}<br>
                            Expiră: \${new Date(alert.data_expirare).toLocaleDateString()}<br>
                            Status: \${alert.status_alert === 'expirat' ? '🚨 EXPIRAT' : '⚠️ EXPIRĂ CURÂND'}
                        </div>
                    \`).join('');
                });
            }
            
            function logout() {
                fetch('/api/logout', { method: 'POST' })
                .then(() => window.location.href = '/login');
            }
            
            document.getElementById('form-masina').addEventListener('submit', function(e) {
                e.preventDefault();
                
                const masina = {
                    numar_inmatriculare: document.getElementById('numar').value.toUpperCase(),
                    marca: document.getElementById('marca').value,
                    model: document.getElementById('model').value
                };
                
                fetch('/api/masini', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(masina)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        document.getElementById('form-masina').reset();
                        loadMasini();
                        alert('✅ Mașină adăugată!');
                    } else {
                        alert('❌ Eroare: ' + data.error);
                    }
                });
            });
            
            // Inițializare
            loadMasini();
        </script>
    </body>
    </html>
    `);
});

// ==================== RUTE API ====================

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username și parolă sunt obligatorii' });
    }
    
    db.get('SELECT * FROM users WHERE username = ? AND status = "activ"', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Eroare server' });
        }
        
        if (!user) {
            return res.status(401).json({ error: 'Utilizator sau parolă incorectă' });
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
            res.status(401).json({ error: 'Utilizator sau parolă incorectă' });
        }
    });
});

// Logout
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
    const { numar_inmatriculare, marca, model, culoare } = req.body;
    
    if (!numar_inmatriculare || !marca || !model) {
        return res.status(400).json({ error: 'Număr înmatriculare, marcă și model sunt obligatorii' });
    }
    
    db.run(
        'INSERT INTO masini (numar_inmatriculare, marca, model, culoare) VALUES (?, ?, ?, ?)',
        [numar_inmatriculare, marca, model, culoare],
        function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(400).json({ error: 'Număr înmatriculare deja existent' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, id: this.lastID, message: 'Mașină adăugată cu succes!' });
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
        res.json({ success: true, message: 'Mașină ștearsă cu succes!' });
    });
});

// Adaugă mașini exemplu
app.post('/api/add-sample-cars', requireAuth, (req, res) => {
    addSampleCars();
    res.json({ success: true, message: 'Mașini exemplu adăugate!' });
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
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Ruta pentru verificare status
app.get('/status', (req, res) => {
    res.json({ 
        status: 'online',
        message: 'Aplicația de management flotă auto rulează',
        timestamp: new Date().toISOString(),
        version: '2.0-online'
    });
});

// Ruta de bază
app.get('/api', (req, res) => {
    res.json({ 
        message: 'Bun venit la API-ul Management Flotă Auto - ONLINE',
        version: '2.0',
        endpoints: [
            '/api/login',
            '/api/masini',
            '/api/alerte-expirare',
            '/api/health'
        ]
    });
});

// Pornire server
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 ========================================');
    console.log('✅ SERVERUL ONLINE A PORNIT CU SUCCES!');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('💾 Baza de date:', dbPath);
    console.log('🔐 User: Tzrkalex');
    console.log('🔑 Parola: Ro27821091');
    console.log('🚀 ========================================');
});