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

// Configurare session
app.use(session({
    secret: 'flota-auto-secret-2024-sigur',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// Configurare baza de date în memorie
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('❌ Eroare baza de date:', err.message);
    } else {
        console.log('✅ Conectat la baza de date în memorie');
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
        if (err) {
            console.error('Eroare creare tabel users:', err);
        } else {
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
            status TEXT DEFAULT 'activ',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel masini:', err);
        else console.log('✅ Tabel masini creat');
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel documente:', err);
        else console.log('✅ Tabel documente creat');
    });

    console.log('✅ Toate tabelele au fost create');
}

// Crează utilizatorul principal
function createDefaultUser() {
    const passwordHash = bcrypt.hashSync('Ro27821091', 10);
    
    db.run(
        `INSERT OR REPLACE INTO users (username, password_hash, nume, email, is_admin) VALUES (?, ?, ?, ?, ?)`,
        ['Tzindex', passwordHash, 'Alexandru Tirca', 'tzindex@example.com', 1],
        function(err) {
            if (err) {
                console.error('❌ Eroare creare utilizator:', err);
            } else {
                console.log('✅ Utilizator creat: Tzindex / Ro27821091');
                // Adaugă mașini exemplu
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

// Pagina de login - SIMPLIFICATĂ 100%
app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Login</title>
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

// Pagina principală - SIMPLIFICATĂ
app.get('/', requireAuth, (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Management Flotă</title>
        <style>
            body { font-family: Arial; margin: 20px; }
            .header { background: #007bff; color: white; padding: 20px; border-radius: 5px; }
            button { background: #007bff; color: white; border: none; padding: 10px; margin: 5px; cursor: pointer; }
            .masina-item { background: #f9f9f9; padding: 10px; margin: 5px 0; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚗 Management Flotă Auto</h1>
            <p>Bun venit, ${req.session.user.nume}!</p>
            <button onclick="logout()">Logout</button>
        </div>
        
        <div>
            <h2>Mașinile tale:</h2>
            <button onclick="loadMasini()">Încarcă mașini</button>
            <div id="masiniList"></div>
        </div>
        
        <div>
            <h2>Adaugă mașină nouă:</h2>
            <form id="addCarForm">
                <input type="text" id="numar" placeholder="Număr" required>
                <input type="text" id="marca" placeholder="Marcă" required>
                <input type="text" id="model" placeholder="Model" required>
                <button type="submit">Adaugă</button>
            </form>
        </div>

        <script>
            function loadMasini() {
                fetch('/api/masini')
                    .then(r => r.json())
                    .then(data => {
                        const container = document.getElementById('masiniList');
                        if (data.masini && data.masini.length > 0) {
                            container.innerHTML = data.masini.map(m => 
                                '<div class="masina-item">' + m.numar_inmatriculare + ' - ' + m.marca + ' ' + m.model + '</div>'
                            ).join('');
                        } else {
                            container.innerHTML = '<p>Nu există mașini</p>';
                        }
                    });
            }
            
            function logout() {
                fetch('/api/logout', { method: 'POST' }).then(() => window.location.href = '/login');
            }
            
            document.getElementById('addCarForm').addEventListener('submit', function(e) {
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
                        document.getElementById('addCarForm').reset();
                        loadMasini();
                        alert('Mașină adăugată!');
                    }
                });
            });
            
            // Încarcă mașinile la pornire
            loadMasini();
        </script>
    </body>
    </html>
    `);
});

// ==================== RUTE API ====================

// Login - VERIFICAT ȘI TESTAT
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('Încercare login cu:', { username, password: '***' });
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username și parolă sunt obligatorii' });
    }
    
    // Verifică dacă username-ul este corect
    if (username !== 'Tzindex') {
        console.log('Username incorect:', username);
        return res.status(401).json({ error: 'Utilizator sau parolă incorectă' });
    }
    
    // Verifică parola
    if (password !== 'Ro27821091') {
        console.log('Parola incorectă');
        return res.status(401).json({ error: 'Utilizator sau parolă incorectă' });
    }
    
    // Creează sesiunea
    req.session.user = {
        id: 1,
        username: 'Tzindex',
        nume: 'Alexandru Tirca',
        is_admin: 1
    };
    
    console.log('Login reușit pentru:', username);
    res.json({ 
        success: true, 
        message: 'Autentificare reușită!',
        user: req.session.user
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Eroare logout:', err);
            return res.status(500).json({ error: 'Eroare la logout' });
        }
        res.json({ success: true, message: 'Delogare reușită' });
    });
});

// Rute mașini
app.get('/api/masini', requireAuth, (req, res) => {
    db.all('SELECT * FROM masini ORDER BY numar_inmatriculare', (err, rows) => {
        if (err) {
            console.error('Eroare la încărcarea mașinilor:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ masini: rows || [] });
    });
});

app.post('/api/masini', requireAuth, (req, res) => {
    const { numar_inmatriculare, marca, model } = req.body;
    
    if (!numar_inmatriculare || !marca || !model) {
        return res.status(400).json({ error: 'Toate câmpurile sunt obligatorii' });
    }
    
    db.run(
        'INSERT INTO masini (numar_inmatriculare, marca, model) VALUES (?, ?, ?)',
        [numar_inmatriculare, marca, model],
        function(err) {
            if (err) {
                console.error('Eroare adăugare mașină:', err);
                return res.status(500).json({ error: err.message });
            }
            res.json({ 
                success: true, 
                id: this.lastID, 
                message: 'Mașină adăugată cu succes!' 
            });
        }
    );
});

// Rută pentru verificare status
app.get('/status', (req, res) => {
    res.json({ 
        status: 'online',
        message: 'Aplicația funcționează',
        timestamp: new Date().toISOString()
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Serverul funcționează perfect!',
        timestamp: new Date().toISOString()
    });
});

// Ruta de bază
app.get('/api', (req, res) => {
    res.json({ 
        message: 'Bun venit la API-ul Management Flotă Auto',
        version: '1.0'
    });
});

// Pornire server
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 ========================================');
    console.log('✅ SERVERUL A PORNIT CU SUCCES!');
    console.log(`📍 Accesează: http://localhost:${PORT}`);
    console.log('🔐 User: Tzindex');
    console.log('🔑 Parola: Ro27821091');
    console.log('🚀 ========================================');
});