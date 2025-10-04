const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();

// Configurare pentru Render
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

console.log('🚀 Starting Management Flota Auto...');
console.log('📍 Port:', PORT);
console.log('🌐 Environment:', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');

// Configurare
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servește fișiere statice
app.use(express.static('public'));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'flota-auto-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// Configurare baza de date
let dbPath;
if (isProduction) {
    const tempDir = '/tmp/data';
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    dbPath = '/tmp/data/flota.db';
} else {
    if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data', { recursive: true });
    }
    dbPath = './data/flota.db';
}

console.log('📁 Database path:', dbPath);

// ==================== BAZĂ DE DATE ====================
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Eroare baza de date:', err.message);
    } else {
        console.log('✅ Conectat la baza de date');
        initDatabase();
    }
});

function initDatabase() {
    // Tabel utilizatori
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        nume TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        status TEXT DEFAULT 'activ'
    )`, (err) => {
        if (err) console.error('Eroare tabel users:', err);
        else createDefaultUser();
    });

    // Tabel mașini
    db.run(`CREATE TABLE IF NOT EXISTS masini (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numar_inmatriculare TEXT UNIQUE NOT NULL,
        marca TEXT NOT NULL,
        model TEXT NOT NULL,
        an_fabricatie INTEGER,
        tip_combustibil TEXT,
        culoare TEXT,
        serie_sasiu TEXT,
        status TEXT DEFAULT 'activ'
    )`, (err) => {
        if (err) console.error('Eroare tabel masini:', err);
    });

    // Tabel setări revizii
    db.run(`CREATE TABLE IF NOT EXISTS setari_revizii (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        masina_id INTEGER UNIQUE NOT NULL,
        ultima_revizie_km INTEGER,
        ultima_revizie_data TEXT,
        urmatoarea_revizie_km INTEGER,
        interval_km INTEGER DEFAULT 10000,
        FOREIGN KEY (masina_id) REFERENCES masini (id)
    )`, (err) => {
        if (err) console.error('Eroare tabel setari_revizii:', err);
    });

    // Tabel alimentări
    db.run(`CREATE TABLE IF NOT EXISTS alimentari (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        masina_id INTEGER NOT NULL,
        data_alimentare TEXT NOT NULL,
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
        FOREIGN KEY (masina_id) REFERENCES masini (id)
    )`, (err) => {
        if (err) console.error('Eroare tabel alimentari:', err);
    });

    // Tabel documente
    db.run(`CREATE TABLE IF NOT EXISTS documente (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        masina_id INTEGER NOT NULL,
        tip_document TEXT NOT NULL,
        numar_document TEXT,
        data_emitere TEXT,
        data_expirare TEXT NOT NULL,
        cost REAL,
        furnizor TEXT,
        observatii TEXT,
        FOREIGN KEY (masina_id) REFERENCES masini (id)
    )`, (err) => {
        if (err) console.error('Eroare tabel documente:', err);
    });

    // Tabel echipamente
    db.run(`CREATE TABLE IF NOT EXISTS echipamente (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        masina_id INTEGER NOT NULL,
        tip_echipament TEXT NOT NULL,
        data_expirare TEXT,
        observatii TEXT,
        FOREIGN KEY (masina_id) REFERENCES masini (id)
    )`, (err) => {
        if (err) console.error('Eroare tabel echipamente:', err);
    });

    // Tabel revizii
    db.run(`CREATE TABLE IF NOT EXISTS revizii (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        masina_id INTEGER NOT NULL,
        tip_revizie TEXT NOT NULL,
        data_revizie TEXT NOT NULL,
        km_curent INTEGER NOT NULL,
        urmatoarea_revizie_km INTEGER,
        urmatoarea_revizie_data TEXT,
        cost REAL,
        service TEXT,
        observatii TEXT,
        FOREIGN KEY (masina_id) REFERENCES masini (id)
    )`, (err) => {
        if (err) console.error('Eroare tabel revizii:', err);
    });
}

function createDefaultUser() {
    const passwordHash = bcrypt.hashSync('Ro27821091', 10);
    db.run(
        `INSERT OR IGNORE INTO users (username, password_hash, nume, is_admin) VALUES (?, ?, ?, ?)`,
        ['Tzrkalex', passwordHash, 'Alexandru Tirca', 1],
        function(err) {
            if (err) console.error('Eroare utilizator:', err);
            else console.log('✅ Utilizator principal creat: Tzrkalex');
        }
    );
}

// ==================== MIDDLEWARE AUTH ====================
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Necesită autentificare' });
    }
}

// ==================== RUTE DE BAZĂ ====================

// Ruta principală - servește frontend-ul
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

// ==================== RUTE AUTH ====================
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

// ==================== RUTE MASINI ====================
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
    db.get('SELECT * FROM masini WHERE id = ?', [masinaId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            return res.status(404).json({ error: 'Mașina nu a fost găsită' });
        }
        res.json({ masina: row });
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

// ==================== RUTE DASHBOARD ====================
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
                        const consumMediu = alimentari.reduce((acc, curr) => acc + curr.consum_mediu, 0) / alimentari.length;
                        dashboardData.consum_mediu_general = consumMediu;
                        
                        res.json(dashboardData);
                    }
                );
            }
        );
    });
});

// Ruta pentru test notificare
app.post('/api/test-notificare', requireAuth, (req, res) => {
    // Această funcție ar putea fi extinsă pentru a integra cu Telegram
    res.json({ 
        success: true, 
        message: 'Funcționalitatea notificărilor va fi implementată în curând' 
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 ========================================');
    console.log('✅ SERVER STARTED SUCCESSFULLY!');
    console.log(`📍 Accesează: http://localhost:${PORT}`);
    console.log('🔐 User: Tzrkalex | Parola: Ro27821091');
    console.log('🚀 ========================================');
});