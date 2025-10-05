// server.js - OPTIMIZAT PENTRU RENDER.COM
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();

// PORT pentru Render - folosește variabila de mediu sau 3000 pentru local
const PORT = process.env.PORT || 3000;

// Configurare middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'flota-auto-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// Configurare baza de date pentru Render
const dbPath = process.env.DATABASE_URL || './data/flota.db';

// Asigură-te că directorul există
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// Conectare baza de date
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Eroare baza de date:', err.message);
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

    console.log('✅ Toate tabelele au fost create');
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
                console.log('✅ Utilizator principal creat: Tzrkalex / Ro27821091');
            }
        }
    );
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
        <meta charset="UTF-8">
        <title>Login - Management Flotă</title>
        <style>
            body { font-family: Arial; background: #667eea; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .login-box { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); width: 300px; }
            h2 { text-align: center; color: #333; }
            input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
            button { width: 100%; padding: 10px; background: #4361ee; color: white; border: none; border-radius: 5px; cursor: pointer; }
            .error { color: red; text-align: center; margin: 10px 0; }
            .info { background: #e7f3ff; padding: 10px; border-radius: 5px; margin-top: 15px; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="login-box">
            <h2>🚗 Management Flotă</h2>
            <div class="error" id="error"></div>
            <form id="loginForm">
                <input type="text" id="username" placeholder="Username" value="Tzrkalex" required>
                <input type="password" id="password" placeholder="Password" value="Ro27821091" required>
                <button type="submit">Login</button>
            </form>
            <div class="info">
                <strong>Cont demo:</strong><br>
                User: Tzrkalex<br>
                Parola: Ro27821091
            </div>
        </div>

        <script>
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
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
                        document.getElementById('error').textContent = data.error;
                    }
                } catch (error) {
                    document.getElementById('error').textContent = 'Eroare de conexiune';
                }
            });
        </script>
    </body>
    </html>
    `);
});

// Pagina principală
app.get('/', requireAuth, (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Management Flotă Auto</title>
        <style>
            body { font-family: Arial; margin: 0; padding: 20px; background: #f5f5f5; }
            .header { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .card { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            button { background: #4361ee; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; margin: 5px; }
            .masina-item { padding: 15px; border: 1px solid #eee; border-radius: 5px; margin-bottom: 10px; display: flex; justify-content: space-between; }
            input { padding: 8px; margin: 5px; border: 1px solid #ddd; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚗 Management Flotă Auto</h1>
            <p>Bun venit, ${req.session.user.nume}!</p>
            <button onclick="logout()">🚪 Delogare</button>
        </div>

        <div class="card">
            <h2>➕ Adaugă Mașină Nouă</h2>
            <form id="form-masina">
                <input type="text" id="numar" placeholder="Număr Înmatriculare" required>
                <input type="text" id="marca" placeholder="Marcă" required>
                <input type="text" id="model" placeholder="Model" required>
                <button type="submit">✅ Adaugă Mașina</button>
            </form>
        </div>

        <div class="card">
            <h2>📋 Lista Mașinilor</h2>
            <button onclick="loadMasini()">🔄 Reîncarcă</button>
            <button onclick="addSampleCars()">🚙 Adaugă Exemplu</button>
            <div id="lista-masini">Se încarcă...</div>
        </div>

        <script>
            loadMasini();

            function loadMasini() {
                fetch('/api/masini')
                    .then(r => r.json())
                    .then(data => {
                        const container = document.getElementById('lista-masini');
                        if (!data.masini || data.masini.length === 0) {
                            container.innerHTML = '<p>Nu există mașini în baza de date.</p>';
                            return;
                        }
                        
                        container.innerHTML = data.masini.map(masina => \`
                            <div class="masina-item">
                                <div>
                                    <strong>\${masina.numar_inmatriculare}</strong> - \${masina.marca} \${masina.model}
                                </div>
                                <button onclick="deleteMasina(\${masina.id})">🗑️ Șterge</button>
                            </div>
                        \`).join('');
                    })
                    .catch(error => {
                        document.getElementById('lista-masini').innerHTML = '<p style="color: red;">Eroare la încărcare</p>';
                    });
            }

            function addSampleCars() {
                const sampleCars = [
                    { numar_inmatriculare: "GJ07ZR", marca: "BMW", model: "740XD" },
                    { numar_inmatriculare: "B123ABC", marca: "Volkswagen", model: "Golf" }
                ];

                sampleCars.forEach(car => {
                    fetch('/api/masini', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(car)
                    })
                    .then(r => r.json())
                    .then(data => {
                        if (data.success) {
                            loadMasini();
                        }
                    });
                });

                setTimeout(() => {
                    alert('Mașinile exemplu au fost adăugate!');
                }, 1000);
            }

            function deleteMasina(id) {
                if (confirm('Sigur vrei să ștergi această mașină?')) {
                    fetch('/api/masini/' + id, { method: 'DELETE' })
                        .then(r => r.json())
                        .then(data => {
                            if (data.success) {
                                loadMasini();
                            }
                        });
                }
            }

            function logout() {
                fetch('/api/logout', { method: 'POST' })
                    .then(() => window.location.href = '/login');
            }

            document.getElementById('form-masina').addEventListener('submit', function(e) {
                e.preventDefault();
                
                const masina = {
                    numar_inmatriculare: document.getElementById('numar').value,
                    marca: document.getElementById('marca').value,
                    model: document.getElementById('model').value
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
                        alert('✅ Mașină adăugată cu succes!');
                    } else {
                        alert('❌ Eroare: ' + data.error);
                    }
                });
            });
        </script>
    </body>
    </html>
    `);
});

// ==================== RUTE API ====================

// Login API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Eroare login:', err);
            return res.status(500).json({ error: 'Eroare server' });
        }
        
        if (!user) {
            return res.status(401).json({ error: 'Utilizator negăsit' });
        }
        
        if (bcrypt.compareSync(password, user.password_hash)) {
            req.session.user = {
                id: user.id,
                username: user.username,
                nume: user.nume,
                is_admin: user.is_admin
            };
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'Parolă incorectă' });
        }
    });
});

// Logout API
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Eroare logout' });
        }
        res.json({ success: true });
    });
});

// Rute mașini API
app.get('/api/masini', requireAuth, (req, res) => {
    db.all('SELECT * FROM masini ORDER BY numar_inmatriculare', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ masini: rows });
    });
});

app.post('/api/masini', requireAuth, (req, res) => {
    const { numar_inmatriculare, marca, model } = req.body;
    
    db.run(
        'INSERT INTO masini (numar_inmatriculare, marca, model) VALUES (?, ?, ?)',
        [numar_inmatriculare, marca, model],
        function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(400).json({ error: 'Număr înmatriculare existent' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.delete('/api/masini/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    
    db.run('DELETE FROM masini WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Serverul funcționează perfect!',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Ruta de bază pentru test
app.get('/api', (req, res) => {
    res.json({ 
        message: 'API Management Flotă Auto',
        version: '1.0.0'
    });
});

// Pornire server - IMPORTANT pentru Render
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 ========================================');
    console.log('✅ SERVERUL A PORNIT CU SUCCES PE RENDER!');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('🔐 User: Tzrkalex');
    console.log('🔑 Parola: Ro27821091');
    console.log('🚀 ========================================');
});