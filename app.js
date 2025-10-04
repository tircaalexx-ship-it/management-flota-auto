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
let dbPath;
if (isProduction) {
    // Pe Render, folosește /tmp
    const tempDir = '/tmp/data';
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    dbPath = '/tmp/data/flota.db';
} else {
    // Development
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

// ==================== IMPORT RUTE ====================
const authRoutes = require('./auth')(db);
const masiniRoutes = require('./masini')(db, requireAuth);
const alimentariRoutes = require('./alimentari')(db, requireAuth);
const documenteRoutes = require('./documente')(db, requireAuth);
const echipamenteRoutes = require('./echipamente')(db, requireAuth);
const reviziiRoutes = require('./revizii')(db, requireAuth);
const alerteRoutes = require('./alerte')(db, requireAuth);
const dashboardRoutes = require('./dashboard')(db, requireAuth);

// ==================== RUTE ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

// Ruta principală
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head><title>Management Flotă</title></head>
        <body style="font-family: Arial; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 40px; border-radius: 15px; text-align: center; box-shadow: 0 15px 35px rgba(0,0,0,0.1);">
                <h1 style="color: #4361ee;">✅ APLICAȚIA FUNCȚIONEAZĂ!</h1>
                <p><strong>Serverul rulează pe portul ${PORT}</strong></p>
                <p>Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}</p>
                <a href="/login" style="display: inline-block; background: #4361ee; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin-top: 15px;">👉 Mergi la Login</a>
            </div>
        </body>
        </html>
    `);
});

// Pagina de login
app.get('/login', (req, res) => {
    res.send(`
        <html>
        <head><title>Login</title></head>
        <body style="font-family: Arial; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 40px; border-radius: 15px; box-shadow: 0 15px 35px rgba(0,0,0,0.1); max-width: 400px; width: 100%;">
                <h1 style="color: #4361ee; text-align: center;">🔐 Autentificare</h1>
                <form action="/api/login" method="POST">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Username:</label>
                        <input type="text" name="username" required placeholder="Tzrkalex" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px;">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Parolă:</label>
                        <input type="password" name="password" required placeholder="••••••••" style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px;">
                    </div>
                    <button type="submit" style="width: 100%; background: #4361ee; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold;">Autentificare</button>
                </form>
                <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: center;">
                    <strong>Cont test:</strong><br>
                    <strong>User:</strong> Tzrkalex<br>
                    <strong>Parolă:</strong> Ro27821091
                </div>
            </div>
        </body>
        </html>
    `);
});

// Înregistrare rute API
app.use('/api', authRoutes);
app.use('/api', masiniRoutes);
app.use('/api', alimentariRoutes);
app.use('/api', documenteRoutes);
app.use('/api', echipamenteRoutes);
app.use('/api', reviziiRoutes);
app.use('/api', alerteRoutes);
app.use('/api', dashboardRoutes);

// Ruta pentru a verifica sesiunea (pentru frontend)
app.get('/api/check-session', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 ========================================');
    console.log('✅ SERVER STARTED SUCCESSFULLY!');
    console.log(`📍 Accesează: http://localhost:${PORT}`);
    console.log('🔐 User: Tzrkalex | Parola: Ro27821091');
    console.log('🚀 ========================================');
});