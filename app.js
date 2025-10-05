// server.js - COD COMPLET CORECTAT PENTRU AUTENTIFICARE
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware IMPORTANT pentru sesiuni
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware - CORECTAT
app.use(session({
    secret: 'flota-auto-secret-key-2024-super-secure',
    resave: true,  // Schimbat în true
    saveUninitialized: true,  // Schimbat în true
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true
    }
}));

// Configurare baza de date
const dbPath = './data/flota.db';
if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data', { recursive: true });
}

// Conectare baza de date
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Eroare baza de date:', err.message);
    } else {
        console.log('✅ Conectat la baza de date');
        initDatabase();
    }
});

// Inițializare baza de date
function initDatabase() {
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
            }
        }
    );
}

// Middleware autentificare ÎMBUNĂTĂȚIT
function requireAuth(req, res, next) {
    console.log('🔐 Verificare auth - Sesiune:', req.session.user);
    
    if (req.session && req.session.user) {
        console.log('✅ Utilizator autentificat:', req.session.user.username);
        next();
    } else {
        console.log('❌ Utilizator neautentificat - redirect login');
        res.redirect('/login');
    }
}

// ==================== RUTE PAGINI ====================

// Pagina de login - SIMPLIFICATĂ
app.get('/login', (req, res) => {
    // Dacă e deja logat, du-te direct la principală
    if (req.session.user) {
        return res.redirect('/');
    }
    
    const loginHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Login - Management Flotă</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
            }
            .login-box {
                background: white;
                padding: 40px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                width: 350px;
                text-align: center;
            }
            h2 {
                color: #333;
                margin-bottom: 30px;
            }
            input {
                width: 100%;
                padding: 12px;
                margin: 10px 0;
                border: 2px solid #ddd;
                border-radius: 8px;
                box-sizing: border-box;
                font-size: 1em;
            }
            button {
                width: 100%;
                background: #4361ee;
                color: white;
                border: none;
                padding: 12px;
                border-radius: 8px;
                font-size: 1.1em;
                cursor: pointer;
                margin-top: 10px;
            }
            button:hover {
                background: #3a0ca3;
            }
            .error {
                color: #e74c3c;
                background: #f8d7da;
                padding: 10px;
                border-radius: 5px;
                margin: 10px 0;
                display: none;
            }
            .info {
                background: #e7f3ff;
                padding: 15px;
                border-radius: 8px;
                margin-top: 20px;
                font-size: 14px;
                color: #333;
            }
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
                <strong>Cont demo pre-configurat:</strong><br>
                👤 <strong>User:</strong> Tzrkalex<br>
                🔑 <strong>Parola:</strong> Ro27821091
            </div>
        </div>

        <script>
            document.getElementById('loginForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                const errorDiv = document.getElementById('errorMessage');
                
                // Ascunde eroarea anterioară
                errorDiv.style.display = 'none';
                
                try {
                    console.log('📤 Trimitere cerere login...');
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ username, password })
                    });
                    
                    const data = await response.json();
                    console.log('📥 Răspuns login:', data);
                    
                    if (data.success) {
                        console.log('✅ Login succes - redirect către principală');
                        window.location.href = '/';
                    } else {
                        errorDiv.textContent = data.error || 'Eroare la autentificare';
                        errorDiv.style.display = 'block';
                    }
                } catch (error) {
                    console.error('❌ Eroare login:', error);
                    errorDiv.textContent = 'Eroare de conexiune cu serverul';
                    errorDiv.style.display = 'block';
                }
            });

            // Auto-login după 500ms
            setTimeout(() => {
                console.log('🔄 Auto-login...');
                document.getElementById('loginForm').dispatchEvent(new Event('submit'));
            }, 500);
        </script>
    </body>
    </html>
    `;
    
    res.send(loginHTML);
});

// Pagina principală - ÎMBUNĂTĂȚITĂ
app.get('/', requireAuth, (req, res) => {
    console.log('🏠 Accesare pagină principală - User:', req.session.user.username);
    
    const mainHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Management Flotă Auto</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                background: #f5f5f5;
                margin: 0;
                padding: 20px;
            }
            .header {
                background: white;
                padding: 25px;
                border-radius: 12px;
                margin-bottom: 25px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                border-left: 5px solid #4361ee;
            }
            .card {
                background: white;
                padding: 25px;
                border-radius: 12px;
                margin-bottom: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            button {
                background: #4361ee;
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                cursor: pointer;
                margin: 8px;
                font-size: 14px;
                font-weight: 600;
                transition: background 0.3s;
            }
            button:hover {
                background: #3a0ca3;
                transform: translateY(-2px);
            }
            .masina-item {
                padding: 18px;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                margin-bottom: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #fafafa;
                transition: transform 0.2s;
            }
            .masina-item:hover {
                transform: translateX(5px);
                border-color: #4361ee;
            }
            input {
                padding: 10px;
                margin: 8px;
                border: 2px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
                width: 200px;
            }
            input:focus {
                border-color: #4361ee;
                outline: none;
            }
            .success {
                color: #27ae60;
                font-weight: bold;
            }
            .user-info {
                float: right;
                background: #4361ee;
                color: white;
                padding: 8px 15px;
                border-radius: 20px;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚗 Management Flotă Auto</h1>
            <div class="user-info">
                👤 ${req.session.user.nume} 
                <button onclick="logout()" style="background: #e74c3c; margin-left: 10px; padding: 5px 10px; font-size: 12px;">🚪 Delogare</button>
            </div>
            <p class="success">✅ Autentificat cu succes ca <strong>${req.session.user.username}</strong></p>
        </div>

        <div class="card">
            <h2>📋 Lista Mașinilor</h2>
            <button onclick="loadMasini()">🔄 Reîncarcă Lista</button>
            <button onclick="addSampleCars()" style="background: #27ae60;">🚙 Adaugă Mașini Exemplu</button>
            <button onclick="testAPI()" style="background: #f39c12;">🧪 Testează API</button>
            <div id="lista-masini" style="margin-top: 20px;">
                <p>⏳ Se încarcă mașinile...</p>
            </div>
        </div>

        <div class="card">
            <h2>➕ Adaugă Mașină Nouă</h2>
            <form id="form-masina">
                <input type="text" id="numar" placeholder="Număr Înmatriculare" required>
                <input type="text" id="marca" placeholder="Marcă (ex: BMW)" required>
                <input type="text" id="model" placeholder="Model (ex: 740XD)" required>
                <button type="submit" style="background: #27ae60;">✅ Adaugă Mașina</button>
            </form>
        </div>

        <script>
            console.log('🔧 Inițializare pagină principală...');

            // Încarcă mașinile imediat
            loadMasini();

            function loadMasini() {
                console.log('📥 Încărcare mașini...');
                fetch('/api/masini')
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Eroare HTTP: ' + response.status);
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log('✅ Date mașini primite:', data);
                        const container = document.getElementById('lista-masini');
                        
                        if (!data.masini || data.masini.length === 0) {
                            container.innerHTML = '<p>🚗 Nu există mașini în baza de date. Adaugă prima mașină!</p>';
                            return;
                        }
                        
                        container.innerHTML = data.masini.map(masina => \`
                            <div class="masina-item">
                                <div>
                                    <strong style="font-size: 16px;">\${masina.numar_inmatriculare}</strong> 
                                    - \${masina.marca} \${masina.model}
                                    \${masina.culoare ? '<span style="color: #666;">• ' + masina.culoare + '</span>' : ''}
                                </div>
                                <button onclick="deleteMasina(\${masina.id})" style="background: #e74c3c;">🗑️ Șterge</button>
                            </div>
                        \`).join('');
                    })
                    .catch(error => {
                        console.error('❌ Eroare la încărcare mașini:', error);
                        document.getElementById('lista-masini').innerHTML = 
                            '<p style="color: #e74c3c;">❌ Eroare la încărcarea mașinilor: ' + error.message + '</p>';
                    });
            }

            function addSampleCars() {
                console.log('🚗 Adăugare mașini exemplu...');
                const sampleCars = [
                    { numar_inmatriculare: "GJ07ZR", marca: "BMW", model: "740XD", culoare: "Negru" },
                    { numar_inmatriculare: "B123ABC", marca: "Volkswagen", model: "Golf", culoare: "Alb" },
                    { numar_inmatriculare: "IS99TST", marca: "Audi", model: "A6", culoare: "Gri" }
                ];

                let promises = sampleCars.map(car => {
                    return fetch('/api/masini', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(car)
                    }).then(r => r.json());
                });

                Promise.all(promises).then(results => {
                    console.log('✅ Rezultate adăugare:', results);
                    loadMasini();
                    alert('✅ ' + results.filter(r => r.success).length + ' mașini exemplu adăugate cu succes!');
                });
            }

            function deleteMasina(id) {
                if (confirm('Sigur dorești să ștergi această mașină?')) {
                    fetch('/api/masini/' + id, { method: 'DELETE' })
                        .then(r => r.json())
                        .then(data => {
                            if (data.success) {
                                loadMasini();
                                alert('✅ Mașină ștearsă cu succes!');
                            } else {
                                alert('❌ Eroare la ștergere: ' + data.error);
                            }
                        })
                        .catch(error => {
                            alert('❌ Eroare: ' + error.message);
                        });
                }
            }

            function testAPI() {
                console.log('🧪 Testare API...');
                fetch('/api/health')
                    .then(r => r.json())
                    .then(data => {
                        alert('✅ API funcționează: ' + data.message);
                    })
                    .catch(error => {
                        alert('❌ Eroare API: ' + error.message);
                    });
            }

            function logout() {
                console.log('🚪 Delogare...');
                fetch('/api/logout', { method: 'POST' })
                    .then(() => {
                        window.location.href = '/login';
                    })
                    .catch(error => {
                        console.error('Eroare logout:', error);
                        window.location.href = '/login';
                    });
            }

            // Formular adăugare mașină
            document.getElementById('form-masina').addEventListener('submit', function(e) {
                e.preventDefault();
                
                const masina = {
                    numar_inmatriculare: document.getElementById('numar').value.toUpperCase(),
                    marca: document.getElementById('marca').value,
                    model: document.getElementById('model').value
                };
                
                console.log('📤 Adăugare mașină:', masina);
                
                fetch('/api/masini', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(masina)
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Eroare HTTP: ' + response.status);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('✅ Răspuns adăugare mașină:', data);
                    if (data.success) {
                        document.getElementById('form-masina').reset();
                        loadMasini();
                        alert('✅ Mașină adăugată cu succes! ID: ' + data.id);
                    } else {
                        alert('❌ Eroare: ' + data.error);
                    }
                })
                .catch(error => {
                    console.error('❌ Eroare adăugare mașină:', error);
                    alert('❌ Eroare: ' + error.message);
                });
            });

            console.log('🔧 Pagina principală încărcată complet');
        </script>
    </body>
    </html>
    `;
    
    res.send(mainHTML);
});

// ==================== RUTE API ÎMBUNĂTĂȚITE ====================

// Login API - CORECTAT
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('🔐 Încercare login pentru:', username);
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username și parolă sunt obligatorii' });
    }
    
    db.get('SELECT * FROM users WHERE username = ? AND status = "activ"', [username], (err, user) => {
        if (err) {
            console.error('❌ Eroare baza de date login:', err);
            return res.status(500).json({ error: 'Eroare server' });
        }
        
        if (!user) {
            console.log('❌ Utilizator negăsit:', username);
            return res.status(401).json({ error: 'Utilizator sau parolă incorectă' });
        }
        
        if (bcrypt.compareSync(password, user.password_hash)) {
            // Setează sesiunea
            req.session.user = {
                id: user.id,
                username: user.username,
                nume: user.nume,
                is_admin: user.is_admin
            };
            
            console.log('✅ Login succes pentru:', username, 'Sesiune:', req.session.user);
            
            // Salvează sesiunea
            req.session.save((err) => {
                if (err) {
                    console.error('❌ Eroare salvare sesiune:', err);
                    return res.status(500).json({ error: 'Eroare sesiune' });
                }
                console.log('✅ Sesiune salvată pentru:', username);
                res.json({ success: true, message: 'Autentificare reușită!' });
            });
        } else {
            console.log('❌ Parolă incorectă pentru:', username);
            res.status(401).json({ error: 'Utilizator sau parolă incorectă' });
        }
    });
});

// Logout API
app.post('/api/logout', (req, res) => {
    console.log('🚪 Logout pentru:', req.session.user?.username);
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Eroare logout:', err);
            return res.status(500).json({ error: 'Eroare logout' });
        }
        console.log('✅ Logout succes');
        res.json({ success: true, message: 'Delogare reușită' });
    });
});

// Rute mașini API
app.get('/api/masini', requireAuth, (req, res) => {
    console.log('📥 Cerere mașini de la:', req.session.user.username);
    db.all('SELECT * FROM masini ORDER BY numar_inmatriculare', (err, rows) => {
        if (err) {
            console.error('❌ Eroare baza de date mașini:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log('✅ Returnat', rows.length, 'mașini');
        res.json({ masini: rows });
    });
});

app.post('/api/masini', requireAuth, (req, res) => {
    const { numar_inmatriculare, marca, model, culoare } = req.body;
    
    console.log('📤 Adăugare mașină:', { numar_inmatriculare, marca, model, user: req.session.user.username });
    
    if (!numar_inmatriculare || !marca || !model) {
        return res.status(400).json({ error: 'Număr înmatriculare, marcă și model sunt obligatorii' });
    }
    
    db.run(
        'INSERT INTO masini (numar_inmatriculare, marca, model, culoare) VALUES (?, ?, ?, ?)',
        [numar_inmatriculare, marca, model, culoare],
        function(err) {
            if (err) {
                console.error('❌ Eroare adăugare mașină:', err);
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(400).json({ error: 'Număr înmatriculare deja existent' });
                }
                return res.status(500).json({ error: err.message });
            }
            console.log('✅ Mașină adăugată cu ID:', this.lastID);
            res.json({ success: true, id: this.lastID, message: 'Mașină adăugată cu succes!' });
        }
    );
});

app.delete('/api/masini/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    console.log('🗑️ Ștergere mașină ID:', id, 'de către:', req.session.user.username);
    
    db.run('DELETE FROM masini WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('❌ Eroare ștergere mașină:', err);
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Mașina nu a fost găsită' });
        }
        console.log('✅ Mașină ștearsă, afectat rânduri:', this.changes);
        res.json({ success: true, message: 'Mașină ștearsă cu succes!' });
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true,
        status: 'OK', 
        message: 'Serverul funcționează perfect!',
        timestamp: new Date().toISOString(),
        port: PORT,
        user: req.session.user || 'neautentificat'
    });
});

// Verificare autentificare
app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ 
            authenticated: true, 
            user: req.session.user 
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Pornire server
app.listen(PORT, () => {
    console.log('🚀 ========================================');
    console.log('✅ SERVERUL A PORNIT CU SUCCES!');
    console.log(`📍 Accesează: http://localhost:${PORT}`);
    console.log('🔐 User: Tzrkalex');
    console.log('🔑 Parola: Ro27821091');
    console.log('💾 Baza de date:', dbPath);
    console.log('🚀 ========================================');
});