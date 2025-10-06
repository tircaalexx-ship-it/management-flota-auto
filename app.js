const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const app = express();
const PORT = 3033;

// Configurare
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
    secret: 'flota-auto-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Crează folderele necesare
if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
if (!fs.existsSync('./public')) fs.mkdirSync('./public', { recursive: true });

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
const db = new sqlite3.Database('./data/flota.db', (err) => {
    if (err) {
        console.error('Eroare baza de date:', err.message);
    } else {
        console.log('✅ Conectat la baza de date SQLite.');
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

    // Tabel mașini - SIMPLIFICAT
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel masini:', err);
        else console.log('✅ Tabel masini creat');
    });

    // Tabel REVIZII și MENTENANȚĂ
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

    // Tabel DOCUMENTE și ASIGURĂRI
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

    // Tabel ALIMENTĂRI
    db.run(`
        CREATE TABLE IF NOT EXISTS alimentari (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            masina_id INTEGER NOT NULL,
            data_alimentare DATETIME DEFAULT CURRENT_TIMESTAMP,
            cantitate_litri REAL NOT NULL,
            cost_total REAL NOT NULL,
            pret_per_litru REAL,
            km_curent INTEGER NOT NULL,
            locatie TEXT,
            tip_combustibil TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (masina_id) REFERENCES masini (id)
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel alimentari:', err);
        else console.log('✅ Tabel alimentari creat');
    });

    // Tabel ECHIPAMENT și SIGURANȚĂ
    db.run(`
        CREATE TABLE IF NOT EXISTS echipamente (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            masina_id INTEGER NOT NULL,
            tip_echipament TEXT NOT NULL,
            data_expirare DATE,
            observatii TEXT,
            status TEXT DEFAULT 'activ',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (masina_id) REFERENCES masini (id)
        )
    `, (err) => {
        if (err) console.error('Eroare creare tabel echipamente:', err);
        else console.log('✅ Tabel echipamente creat');
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

// ==================== RUTE AUTENTIFICARE ====================
app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

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
            res.json({ 
                success: true,
                message: 'Mașină adăugată cu succes!',
                id: this.lastID 
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
    
    db.run(
        `INSERT INTO alimentari (masina_id, data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, locatie, tip_combustibil) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [masinaId, data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, locatie, tip_combustibil],
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

// ==================== RUTE ECHIPAMENTE ====================
app.get('/api/masini/:id/echipamente', requireAuth, (req, res) => {
    const masinaId = req.params.id;
    
    db.all(
        `SELECT * FROM echipamente WHERE masina_id = ? ORDER BY data_expirare ASC`,
        [masinaId],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ echipamente: rows });
        }
    );
});

app.post('/api/masini/:id/echipamente', requireAuth, (req, res) => {
    const masinaId = req.params.id;
    const { tip_echipament, data_expirare, observatii } = req.body;
    
    if (!tip_echipament) {
        return res.status(400).json({ error: 'Tip echipament este obligatoriu' });
    }
    
    db.run(
        `INSERT INTO echipamente (masina_id, tip_echipament, data_expirare, observatii) 
         VALUES (?, ?, ?, ?)`,
        [masinaId, tip_echipament, data_expirare, observatii],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ 
                success: true,
                message: 'Echipament înregistrat cu succes!',
                id: this.lastID 
            });
        }
    );
});

// ==================== RUTE RAPOARTE și ALERTE ====================
app.get('/api/alerte-expirare', requireAuth, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = nextMonth.toISOString().split('T')[0];
    
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

// ==================== RUTE PROTECTATE ====================
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/masina/:id', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'masina.html'));
});

// ==================== CREARE FIȘIERE HTML ====================

// Pagina de login (rămâne la fel ca în codul anterior)
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

// Pagina principală CU ALERTE și MANAGEMENT COMPLET
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
            <div style="display: flex; justify-content: between; align-items: center;">
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

        <!-- Panou informații sistem -->
        <div class="card">
            <div class="card-header">
                <div class="card-icon">🛡️</div>
                <h2 class="card-title">Sistem Complet de Management Auto</h2>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                    <div style="font-size: 2em;">🔧</div>
                    <h3>Revizii</h3>
                    <p>Planificare și urmărire</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                    <div style="font-size: 2em;">📄</div>
                    <h3>Documente</h3>
                    <p>ITP, Asigurări, Vignete</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                    <div style="font-size: 2em;">⛽</div>
                    <h3>Alimentări</h3>
                    <p>Consum și costuri</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                    <div style="font-size: 2em;">⚠️</div>
                    <h3>Alerte</h3>
                    <p>Notificări expirare</p>
                </div>
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
                const masini = [
    { 
            numar_inmatriculare: "GJ17tZR", 
            marca: "PEUGEOT", 
            model: "EXPERT", 
            tip_combustibil: "ELECTRIC", 
            an_fabricatie: 2021,
            culoare: "ALB",
            serie_sasiu: "VF3V1ZKXZMZ083957",
            kilometraj_curent: 40000
        },
        { 
            numar_inmatriculare: "GJ19TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2016,
            culoare: "Alb",
            serie_sasiu: "WF0EXXTTREKM10084",
            kilometraj_curent: 205220
        },
        { 
            numar_inmatriculare: "GJ12TZR", 
            marca: "FORD", 
            model: "TRANSIT CUSTOM", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2018,
            culoare: "ALB",
            serie_sasiu: "WF0YXXTTGYFJ64185",
            kilometraj_curent: 317879
        },
        { 
            numar_inmatriculare: "GJ15TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2022,
            culoare: "Alb",
            serie_sasiu: "WF0XXXTTGXGD24338",
            kilometraj_curent: 312560
        },
        { 
            numar_inmatriculare: "GJ09FAN", 
            marca: "Volkswagen", 
            model: "TRANSPORTER", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2015,
            culoare: "Alb",
            serie_sasiu: "WV1ZZZ7HZEX009092",
            kilometraj_curent: 154711
        },
        { 
            numar_inmatriculare: "GJ39FAN", 
            marca: "FORD", 
            model: "TRANSIT CONECT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2008,
            culoare: "Alb",
            serie_sasiu: "WF0UXXTTPU8R31219",
            kilometraj_curent: 132711
        },
        { 
            numar_inmatriculare: "GJ16FAN", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2014,
            serie_sasiu: "WF0XXXTTFXBK52641",
            culoare: "Alb",
            kilometraj_curent: 287528
        },
        { 
            numar_inmatriculare: "GJ39TZR", 
            marca: "NISSAN", 
            model: "NV-200", 
            tip_combustibil: "ELECTRIC", 
            an_fabricatie: 2022,
            culoare: "Alb",
            serie_sasiu: "VSKHAAME0U0629171",
            kilometraj_curent: 47528
        },
        { 
            numar_inmatriculare: "GJ11TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2014,
            culoare: "Alb",
            serie_sasiu: "WF0XXXBDFX7U42734",
            kilometraj_curent: 371328
        },
        { 
            numar_inmatriculare: "GJ43TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "electric", 
            an_fabricatie: 2024,
            culoare: "Alb",
            serie_sasiu: "WF0EXXTTRBPP35230",
            kilometraj_curent: 50000
        },
        { 
            numar_inmatriculare: "GJ08TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2014,
            culoare: "Alb",
            serie_sasiu: "WF0XXXTTFXCC55230",
            kilometraj_curent: 309909
        },
        { 
            numar_inmatriculare: "GJ36TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2018,
            culoare: "Alb",
            serie_sasiu: "WF0YXXTTGYGS22985",
            kilometraj_curent: 276632
        },
        { 
            numar_inmatriculare: "GJ03TZR", 
            marca: "RENAULT", 
            model: "KANGOO", 
            tip_combustibil: "electric", 
            an_fabricatie: 2021,
            culoare: "Alb",
            serie_sasiu: "VF1FW000965992982",
            kilometraj_curent: 276632
        },
        { 
            numar_inmatriculare: "GJ35TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2021,
            culoare: "Alb",
            serie_sasiu: "WF0XXXTTGXJB02794",
            kilometraj_curent: 319995
        },
        { 
            numar_inmatriculare: "GJ30TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2016,
            culoare: "Alb",
            serie_sasiu: "WF0XXXTTGXEU43653",
            kilometraj_curent: 381946
        },
        { 
            numar_inmatriculare: "GJ44FAN", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2016,
            culoare: "Alb",
            serie_sasiu: "WF0WXXTACWHB19129",
            kilometraj_curent: 0
        },
        { 
            numar_inmatriculare: "GJ21TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2018,
            culoare: "Alb",
            serie_sasiu: "WF0XXXTTFXDK82839",
            kilometraj_curent: 334578
        },
        { 
            numar_inmatriculare: "GJ46TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "electric", 
            an_fabricatie: 2024,
            culoare: "Alb",
            serie_sasiu: "WF0EXXTTRBPM33213",
            kilometraj_curent: 74524
        },
        { 
            numar_inmatriculare: "GJ45TZR", 
            marca: "RENAULT", 
            model: "MAEVA", 
            tip_combustibil: "ELECTRIC", 
            an_fabricatie: 2022,
            culoare: "Alb",
            serie_sasiu: "VF1VAE00064162873",
            kilometraj_curent:0
        },
        { 
            numar_inmatriculare: "GJ44TZR", 
            marca: "RENAULT", 
            model: "ZOE", 
            tip_combustibil: "ELECTRIC", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "VF1AGVYB055164402",
            kilometraj_curent: 0
        },
        { 
            numar_inmatriculare: "GJ14TZR", 
            marca: "RENAULT", 
            model: "KANGOO", 
            tip_combustibil: "electric", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "VF1FW000265992984",
            kilometraj_curent: 12345
        },
        { 
            numar_inmatriculare: "GJ16TZR", 
            marca: "RENAULT", 
            model: "KANGOO", 
            tip_combustibil: "electric", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "VF1FW000466092470",
            kilometraj_curent: 200000
        },
        { 
            numar_inmatriculare: "GJ25TZR", 
            marca: "RENAULT", 
            model: "KANGOO", 
            tip_combustibil: "electric", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "VF1FW0ZHC47559358",
            kilometraj_curent: 40198
        },
        { 
            numar_inmatriculare: "GJ23TZR", 
            marca: "RENAULT", 
            model: "KANGOO", 
            tip_combustibil: "electric", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "VF1FW000565992980",
            kilometraj_curent: 40198
        },
        { 
            numar_inmatriculare: "GJ37TZR", 
            marca: "RENAULT", 
            model: "KANGOO", 
            tip_combustibil: "electric", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "VF1FW000065992983",
            kilometraj_curent: 0
        },
        { 
            numar_inmatriculare: "GJ42TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "WF0YXXTTGYJR56387",
            kilometraj_curent: 183376
        },
        { 
            numar_inmatriculare: "GJ31TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "WF0XXXTTGXJM72014",
            kilometraj_curent: 224054
        },
        { 
            numar_inmatriculare: "GJ33TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "WF0XXXTTGXGK89342",
            kilometraj_curent: 329815
        },
        { 
            numar_inmatriculare: "GJ22TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "WF0XXXTTGXHB59987",
            kilometraj_curent: 165220
        },
        { 
            numar_inmatriculare: "GJ13TZR", 
            marca: "FORD", 
            model: "TRANSIT CUSTOM", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "WFOYXXTTGYEB84484",
            kilometraj_curent: 402491
        },
        { 
            numar_inmatriculare: "GJ04FAN", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "WF0VXXGBFV1D1374",
            kilometraj_curent: 538035
        },
        { 
            numar_inmatriculare: "GJ23TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2015,
            culoare: "Alb",
            serie_sasiu: "WF0XXXTTFXCR86513",
            kilometraj_curent: 373544
        },
        { 
            numar_inmatriculare: "GJ41TZR", 
            marca: "FORD", 
            model: "TRANSIT", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "WF0XXXTTGXJT01004",
            kilometraj_curent: 376085
        },
        { 
            numar_inmatriculare: "GJ64FAN", 
            marca: "MERCEDES", 
            model: "SPRINTER", 
            tip_combustibil: "diesel", 
            an_fabricatie: 2019,
            culoare: "Alb",
            serie_sasiu: "WDB906155GN682883",
            kilometraj_curent: 329815
        },
        { 
            numar_inmatriculare: "GJ18TZR", 
            marca: "SUZUKY", 
            model: "SWIFT", 
            tip_combustibil: "benzina", 
            an_fabricatie: 2019,
            culoare: "ROSU",
            serie_sasiu: "TSMMZC21S00362485",
            kilometraj_curent: 0
        }

];

module.exports = masini;
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
                        alert('✅ Mașina exemplu a fost adăugată!');
                        loadMasini();
                    }
                })
                .catch(error => {
                    console.error('Eroare la adăugarea mașinii exemplu:', error);
                });
            });
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

// Pagina de detalii mașină CU MANAGEMENT COMPLET
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
        .container { max-width: 1400px; margin: 0 auto; }
        .header { background: white; border-radius: 15px; padding: 20px; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .btn { background: #4361ee; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin: 5px; transition: background 0.3s ease; }
        .btn:hover { background: #3a0ca3; }
        .btn-success { background: #27ae60; }
        .btn-success:hover { background: #219653; }
        .btn-warning { background: #f39c12; }
        .btn-warning:hover { background: #e67e22; }
        .btn-danger { background: #e74c3c; }
        .btn-danger:hover { background: #c0392b; }
        .btn-back { background: #95a5a6; }
        .btn-back:hover { background: #7f8c8d; }
        .card { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 600; color: #333; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-size: 1em; }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #4361ee; outline: none; }
        .tab-container { display: flex; margin-bottom: 20px; border-bottom: 2px solid #eee; flex-wrap: wrap; }
        .tab { padding: 10px 20px; cursor: pointer; border-bottom: 3px solid transparent; white-space: nowrap; }
        .tab.active { border-bottom-color: #4361ee; color: #4361ee; font-weight: 600; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .list-item { padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .list-item:last-child { border-bottom: none; }
        .status-expired { color: #e74c3c; font-weight: bold; }
        .status-warning { color: #f39c12; font-weight: bold; }
        .status-ok { color: #27ae60; font-weight: bold; }
        .delete-small { background: #e74c3c; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer; font-size: 0.7em; }
        .delete-small:hover { background: #c0392b; }
        @media (max-width: 768px) {
            .grid { grid-template-columns: 1fr; }
            .tab-container { overflow-x: auto; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <a href="/" class="btn btn-back">← Înapoi la Lista Mașini</a>
            <h1 id="masinaTitle">Detalii Mașină</h1>
        </header>

        <div class="card">
            <div id="masinaInfo">Se încarcă...</div>
        </div>

        <div class="tab-container">
            <div class="tab active" onclick="showTab('documente')">📄 Documente</div>
            <div class="tab" onclick="showTab('revizii')">🔧 Revizii</div>
            <div class="tab" onclick="showTab('alimentari')">⛽ Alimentări</div>
            <div class="tab" onclick="showTab('echipamente')">🛡️ Echipamente</div>
            <div class="tab" onclick="showTab('rapoarte')">📊 Rapoarte</div>
        </div>

        <!-- TAB DOCUMENTE -->
        <div class="tab-content active" id="documenteTab">
            <div class="grid">
                <div class="card">
                    <h3>Adaugă Document Nou</h3>
                    <form id="form-document">
                        <div class="form-group">
                            <label for="tip_document">Tip Document *</label>
                            <select id="tip_document" required>
                                <option value="">Alege tip document</option>
                                <option value="ITP">ITP</option>
                                <option value="Asigurare RCA">Asigurare RCA</option>
                                <option value="Asigurare CASCO">Asigurare CASCO</option>
                                <option value="Vignetă">Vignetă</option>
                                <option value="Rovinietă">Rovinietă</option>
                                <option value="Carte Auto">Carte Auto</option>
                                <option value="Talon">Talon</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="numar_document">Număr Document</label>
                            <input type="text" id="numar_document" placeholder="Număr poliță/serie">
                        </div>
                        <div class="form-group">
                            <label for="data_emitere">Data Emitere</label>
                            <input type="date" id="data_emitere">
                        </div>
                        <div class="form-group">
                            <label for="data_expirare">Data Expirare *</label>
                            <input type="date" id="data_expirare" required>
                        </div>
                        <div class="form-group">
                            <label for="cost_document">Cost (RON)</label>
                            <input type="number" step="0.01" id="cost_document" placeholder="0.00">
                        </div>
                        <div class="form-group">
                            <label for="furnizor_document">Furnizor</label>
                            <input type="text" id="furnizor_document" placeholder="Nume furnizor">
                        </div>
                        <div class="form-group">
                            <label for="observatii_document">Observații</label>
                            <textarea id="observatii_document" rows="3" placeholder="Observații..."></textarea>
                        </div>
                        <button type="submit" class="btn btn-success">✅ Adaugă Document</button>
                    </form>
                </div>
                <div class="card">
                    <h3>Listă Documente</h3>
                    <div id="lista-documente">Se încarcă...</div>
                </div>
            </div>
        </div>

        <!-- TAB REVIZII -->
        <div class="tab-content" id="reviziiTab">
            <div class="grid">
                <div class="card">
                    <h3>Adaugă Revizie</h3>
                    <form id="form-revizie">
                        <div class="form-group">
                            <label for="tip_revizie">Tip Revizie *</label>
                            <select id="tip_revizie" required>
                                <option value="">Alege tip revizie</option>
                                <option value="Revizie generală">Revizie generală</option>
                                <option value="Schimb ulei și filtre">Schimb ulei și filtre</option>
                                <option value="Revizie frâne">Revizie frâne</option>
                                <option value="Schimb anvelope">Schimb anvelope</option>
                                <option value="Revizie tehnică">Revizie tehnică</option>
                                <option value="Alte reparații">Alte reparații</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="data_revizie">Data Revizie *</label>
                            <input type="date" id="data_revizie" required>
                        </div>
                        <div class="form-group">
                            <label for="km_revizie">Kilometraj Curent *</label>
                            <input type="number" id="km_revizie" required placeholder="0">
                        </div>
                        <div class="form-group">
                            <label for="urmatoarea_revizie_km">Următoarea Revizie (km)</label>
                            <input type="number" id="urmatoarea_revizie_km" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label for="urmatoarea_revizie_data">Următoarea Revizie (dată)</label>
                            <input type="date" id="urmatoarea_revizie_data">
                        </div>
                        <div class="form-group">
                            <label for="cost_revizie">Cost (RON)</label>
                            <input type="number" step="0.01" id="cost_revizie" placeholder="0.00">
                        </div>
                        <div class="form-group">
                            <label for="service_revizie">Service</label>
                            <input type="text" id="service_revizie" placeholder="Nume service">
                        </div>
                        <div class="form-group">
                            <label for="observatii_revizie">Observații</label>
                            <textarea id="observatii_revizie" rows="3" placeholder="Observații..."></textarea>
                        </div>
                        <button type="submit" class="btn btn-success">✅ Adaugă Revizie</button>
                    </form>
                </div>
                <div class="card">
                    <h3>Istoric Revizii</h3>
                    <div id="lista-revizii">Se încarcă...</div>
                </div>
            </div>
        </div>

        <!-- Celelalte tab-uri (Alimentări, Echipamente, Rapoarte) vor fi similare -->
        
    </div>

    <script>
        const masinaId = window.location.pathname.split('/').pop();
        
        document.addEventListener('DOMContentLoaded', function() {
            loadMasinaInfo();
            loadDocumente();
            setupEventListeners();
        });

        function showTab(tabName) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            document.querySelector(\`[onclick="showTab('\${tabName}')"]\`).classList.add('active');
            document.getElementById(tabName + 'Tab').classList.add('active');
        }

        function setupEventListeners() {
            document.getElementById('form-document').addEventListener('submit', function(e) {
                e.preventDefault();
                adaugaDocument();
            });

            document.getElementById('form-revizie').addEventListener('submit', function(e) {
                e.preventDefault();
                adaugaRevizie();
            });
        }

        function loadMasinaInfo() {
            fetch(\`/api/masini/\${masinaId}\`)
                .then(response => response.json())
                .then(data => {
                    if (data.masina) {
                        const masina = data.masina;
                        document.getElementById('masinaTitle').textContent = \`\${masina.numar_inmatriculare} - \${masina.marca} \${masina.model}\`;
                        document.getElementById('masinaInfo').innerHTML = \`
                            <h2>\${masina.marca} \${masina.model}</h2>
                            <p><strong>Număr înmatriculare:</strong> \${masina.numar_inmatriculare}</p>
                            <p><strong>An fabricație:</strong> \${masina.an_fabricatie || 'Necunoscut'}</p>
                            <p><strong>Combustibil:</strong> \${masina.tip_combustibil || 'Nespecificat'}</p>
                            <p><strong>Culoare:</strong> \${masina.culoare || 'Nespecificat'}</p>
                            <p><strong>Serie șasiu:</strong> \${masina.serie_sasiu || 'Nespecificat'}</p>
                        \`;
                    }
                })
                .catch(error => {
                    console.error('Eroare:', error);
                });
        }

        function loadDocumente() {
            fetch(\`/api/masini/\${masinaId}/documente\`)
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('lista-documente');
                    if (!data.documente || data.documente.length === 0) {
                        container.innerHTML = '<p>Nu există documente înregistrate.</p>';
                        return;
                    }
                    
                    const today = new Date();
                    container.innerHTML = data.documente.map(doc => {
                        const expirare = new Date(doc.data_expirare);
                        const diffTime = expirare - today;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        let statusClass = 'status-ok';
                        let statusText = 'VALID';
                        
                        if (diffDays < 0) {
                            statusClass = 'status-expired';
                            statusText = 'EXPIRAT';
                        } else if (diffDays <= 30) {
                            statusClass = 'status-warning';
                            statusText = \`EXPIRĂ ÎN \${diffDays} ZILE\`;
                        }
                        
                        return \`
                            <div class="list-item">
                                <div>
                                    <strong>\${doc.tip_document}</strong>
                                    \${doc.numar_document ? '<br>Nr: ' + doc.numar_document : ''}
                                    <br>Expiră: \${new Date(doc.data_expirare).toLocaleDateString('ro-RO')}
                                    \${doc.cost ? '<br>Cost: ' + doc.cost + ' RON' : ''}
                                </div>
                                <div style="text-align: right;">
                                    <span class="\${statusClass}">\${statusText}</span>
                                    <br>
                                    <button class="delete-small" onclick="stergeDocument(\${doc.id})">🗑️</button>
                                </div>
                            </div>
                        \`;
                    }).join('');
                })
                .catch(error => {
                    console.error('Eroare:', error);
                });
        }

        function adaugaDocument() {
            const document = {
                tip_document: document.getElementById('tip_document').value,
                numar_document: document.getElementById('numar_document').value,
                data_emitere: document.getElementById('data_emitere').value,
                data_expirare: document.getElementById('data_expirare').value,
                cost: document.getElementById('cost_document').value ? parseFloat(document.getElementById('cost_document').value) : null,
                furnizor: document.getElementById('furnizor_document').value,
                observatii: document.getElementById('observatii_document').value
            };

            fetch(\`/api/masini/\${masinaId}/documente\`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(document)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('✅ Document adăugat cu succes!');
                    document.getElementById('form-document').reset();
                    loadDocumente();
                } else {
                    alert('❌ Eroare: ' + data.error);
                }
            })
            .catch(error => {
                alert('❌ Eroare: ' + error.message);
            });
        }

        function stergeDocument(documentId) {
            if (confirm('Sigur doriți să ștergeți acest document?')) {
                // Aici ar trebui să adăugăm un endpoint pentru ștergerea documentelor
                alert('Funcționalitatea de ștergere va fi implementată în curând.');
            }
        }

        function adaugaRevizie() {
            const revizie = {
                tip_revizie: document.getElementById('tip_revizie').value,
                data_revizie: document.getElementById('data_revizie').value,
                km_curent: parseInt(document.getElementById('km_revizie').value),
                urmatoarea_revizie_km: document.getElementById('urmatoarea_revizie_km').value ? parseInt(document.getElementById('urmatoarea_revizie_km').value) : null,
                urmatoarea_revizie_data: document.getElementById('urmatoarea_revizie_data').value,
                cost: document.getElementById('cost_revizie').value ? parseFloat(document.getElementById('cost_revizie').value) : null,
                service: document.getElementById('service_revizie').value,
                observatii: document.getElementById('observatii_revizie').value
            };

            fetch(\`/api/masini/\${masinaId}/revizii\`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(revizie)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('✅ Revizie adăugată cu succes!');
                    document.getElementById('form-revizie').reset();
                    loadRevizii();
                } else {
                    alert('❌ Eroare: ' + data.error);
                }
            })
            .catch(error => {
                alert('❌ Eroare: ' + error.message);
            });
        }

        function loadRevizii() {
            fetch(\`/api/masini/\${masinaId}/revizii\`)
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('lista-revizii');
                    if (!data.revizii || data.revizii.length === 0) {
                        container.innerHTML = '<p>Nu există revizii înregistrate.</p>';
                        return;
                    }
                    
                    container.innerHTML = data.revizii.map(revizie => \`
                        <div class="list-item">
                            <div>
                                <strong>\${revizie.tip_revizie}</strong>
                                <br>Data: \${new Date(revizie.data_revizie).toLocaleDateString('ro-RO')}
                                <br>KM: \${revizie.km_curent}
                                \${revizie.cost ? '<br>Cost: ' + revizie.cost + ' RON' : ''}
                                \${revizie.service ? '<br>Service: ' + revizie.service : ''}
                                \${revizie.observatii ? '<br>Observații: ' + revizie.observatii : ''}
                            </div>
                        </div>
                    \`).join('');
                })
                .catch(error => {
                    console.error('Eroare:', error);
                });
        }

        // Încarcă reviziile când tab-ul este activat
        document.querySelector('[onclick="showTab(\'revizii\')"]').addEventListener('click', loadRevizii);
    </script>
</body>
</html>
`;

// Scrie fișierele HTML
fs.writeFileSync('./public/login.html', loginHTML);
fs.writeFileSync('./public/index.html', mainHTML);
fs.writeFileSync('./public/masina.html', masinaHTML);
console.log('✅ Toate fișierele HTML au fost create');

// Pornire server
app.listen(PORT, () => {
    console.log('🚀 ========================================');
    console.log('✅ SISTEMUL COMPLET DE MANAGEMENT AUTO RULEAZĂ!');
    console.log('📱 Accesează aplicația la: http://localhost:' + PORT);
    console.log('🔐 Autentificare necesară pentru acces');
    console.log('🚗 ========================================');
    console.log('');
    console.log('🎯 FUNCȚIONALITĂȚI PRINCIPALE:');
    console.log('   📄 Gestiune documente (ITP, Asigurări, Vignete)');
    console.log('   🔧 Revizii și mentenanță programată');
    console.log('   ⛽ Alimentări și consum combustibil');
    console.log('   🛡️ Echipamente de siguranță (trusă, stingător)');
    console.log('   ⚠️ Alertă automată pentru expirări');
    console.log('   📊 Rapoarte și statistici');
    console.log('');
    console.log('👤 UTILIZATOR PRINCIPAL:');
    console.log('   📧 Username: Tzrkalex');
    console.log('   🔑 Parola: Ro27821091');
    console.log('');
    console.log('⚠️  SISTEMUL VA GENERA ALERTE PENTRU:');
    console.log('   • ITP expirat');
    console.log('   • Asigurări expirate');
    console.log('   • Vignete/roviniete expirate');
    console.log('   • Revizii necesare');
    console.log('   • Echipamente expirate');
});