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

// Configurare session
app.use(session({
    secret: process.env.SESSION_SECRET || 'flota-auto-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// Configurare baza de date
const dbPath = process.env.NODE_ENV === 'production' ? '/tmp/data/flota.db' : './data/flota.db';

// Asigură-te că directorul există
if (process.env.NODE_ENV === 'production') {
    if (!fs.existsSync('/tmp/data')) {
        fs.mkdirSync('/tmp/data', { recursive: true });
    }
} else {
    if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data', { recursive: true });
    }
}

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
            }
        }
    );
}

// Middleware autentificare
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Necesită autentificare' });
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
        <style>
            body { font-family: Arial; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
            .login-box { background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); width: 350px; text-align: center; }
            h2 { color: #333; margin-bottom: 30px; }
            input { width: 100%; padding: 12px; margin: 10px 0; border: 2px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 1em; }
            button { width: 100%; background: #4361ee; color: white; border: none; padding: 12px; border-radius: 8px; font-size: 1.1em; cursor: pointer; margin-top: 10px; }
            button:hover { background: #3a0ca3; }
            .error { color: #e74c3c; background: #f8d7da; padding: 10px; border-radius: 5px; margin: 10px 0; display: none; }
            .info { background: #e7f3ff; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 14px; color: #333; }
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
        </div>

        <script>
            document.getElementById('loginForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                const errorDiv = document.getElementById('errorMessage');
                
                errorDiv.style.display = 'none';
                
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

// Pagina principală
app.get('/', requireAuth, (req, res) => {
    res.send(`<!DOCTYPE html>
    <html>
    <head>
        <title>Management Flotă Auto</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; color: #333; line-height: 1.6; }
            
            /* Header */
            .header { background: linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%); color: white; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.1); position: relative; }
            .header h1 { margin-bottom: 0.5rem; font-size: 2rem; }
            .user-info { position: absolute; top: 1.5rem; right: 1.5rem; background: rgba(255,255,255,0.2); padding: 0.5rem 1rem; border-radius: 20px; backdrop-filter: blur(10px); }
            
            /* Navigation */
            .nav { background: white; padding: 1rem; border-bottom: 1px solid #e0e0e0; display: flex; gap: 1rem; flex-wrap: wrap; }
            .nav-btn { background: #4361ee; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; display: flex; align-items: center; gap: 0.5rem; }
            .nav-btn:hover { background: #3a0ca3; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(58, 12, 163, 0.3); }
            .nav-btn.secondary { background: #7209b7; }
            .nav-btn.success { background: #2ecc71; }
            .nav-btn.warning { background: #f39c12; }
            .nav-btn.danger { background: #e74c3c; }
            
            /* Container */
            .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
            
            /* Cards */
            .card { background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 2px 10px rgba(0,0,0,0.08); border-left: 4px solid #4361ee; }
            .card h2 { color: #2d3748; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
            
            /* Forms */
            .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
            .form-group { display: flex; flex-direction: column; }
            label { font-weight: 600; margin-bottom: 0.5rem; color: #4a5568; }
            input, select, textarea { padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1rem; transition: border-color 0.3s; }
            input:focus, select:focus, textarea:focus { outline: none; border-color: #4361ee; box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.1); }
            
            /* Buttons */
            .btn { background: #4361ee; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; }
            .btn:hover { background: #3a0ca3; transform: translateY(-2px); }
            .btn-success { background: #2ecc71; }
            .btn-warning { background: #f39c12; }
            .btn-danger { background: #e74c3c; }
            .btn-secondary { background: #6c757d; }
            
            /* Tables & Lists */
            .masina-item { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; transition: all 0.3s; display: flex; justify-content: space-between; align-items: center; }
            .masina-item:hover { transform: translateX(5px); border-color: #4361ee; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .masina-info { flex: 1; }
            .masina-actions { display: flex; gap: 0.5rem; }
            .masina-numar { font-size: 1.2rem; font-weight: bold; color: #2d3748; }
            .masina-details { color: #718096; margin-top: 0.25rem; }
            
            /* Tabs */
            .tabs { display: flex; border-bottom: 1px solid #e2e8f0; margin-bottom: 1.5rem; }
            .tab { padding: 1rem 1.5rem; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.3s; font-weight: 600; }
            .tab.active { border-bottom-color: #4361ee; color: #4361ee; }
            .tab-content { display: none; }
            .tab-content.active { display: block; }
            
            /* Alerts */
            .alert { padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
            .alert-success { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
            .alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
            .alert-warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
            
            /* Responsive */
            @media (max-width: 768px) {
                .container { padding: 1rem; }
                .form-grid { grid-template-columns: 1fr; }
                .masina-item { flex-direction: column; align-items: flex-start; gap: 1rem; }
                .masina-actions { width: 100%; justify-content: flex-end; }
                .user-info { position: static; margin-top: 1rem; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚗 Management Flotă Auto</h1>
            <p>Gestionare completă a mașinilor, consumului și documentelor</p>
            <div class="user-info">
                👤 ${req.session.user.nume} 
                <button onclick="logout()" class="btn btn-danger" style="margin-left: 10px; padding: 0.25rem 0.75rem; font-size: 0.8rem;">🚪 Delogare</button>
            </div>
        </div>
        
        <div class="nav">
            <button class="nav-btn" onclick="showTab('masini')">🚗 Mașinile Mele</button>
            <button class="nav-btn success" onclick="showTab('alimentari')">⛽ Alimentări</button>
            <button class="nav-btn warning" onclick="showTab('documente')">📄 Documente</button>
            <button class="nav-btn secondary" onclick="showTab('alerte')">🔔 Alertă Expirări</button>
            <button class="nav-btn" onclick="showTab('dashboard')">📊 Dashboard</button>
        </div>
        
        <div class="container">
            <!-- Tab Mașini -->
            <div id="masini" class="tab-content active">
                <div class="card">
                    <h2>📋 Lista Mașinilor</h2>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
                        <button class="btn" onclick="loadMasini()">🔄 Reîncarcă Lista</button>
                        <button class="btn btn-success" onclick="addSampleCars()">🚙 Adaugă Mașini Exemplu</button>
                    </div>
                    <div id="lista-masini">
                        <p>⏳ Se încarcă mașinile...</p>
                    </div>
                </div>
                
                <div class="card">
                    <h2>➕ Adaugă Mașină Nouă</h2>
                    <form id="form-masina">
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="numar">Număr Înmatriculare *</label>
                                <input type="text" id="numar" placeholder="ex: GJ07ZR" required>
                            </div>
                            <div class="form-group">
                                <label for="marca">Marcă *</label>
                                <input type="text" id="marca" placeholder="ex: BMW" required>
                            </div>
                            <div class="form-group">
                                <label for="model">Model *</label>
                                <input type="text" id="model" placeholder="ex: 740XD" required>
                            </div>
                            <div class="form-group">
                                <label for="culoare">Culoare</label>
                                <input type="text" id="culoare" placeholder="ex: Negru">
                            </div>
                        </div>
                        <button type="submit" class="btn btn-success">✅ Adaugă Mașina</button>
                    </form>
                </div>
            </div>
            
            <!-- Tab Alimentări -->
            <div id="alimentari" class="tab-content">
                <div class="card">
                    <h2>⛽ Gestionează Alimentări</h2>
                    <p>Selectează o mașină pentru a vedea sau adăuga alimentări</p>
                    <div id="alimentari-content">
                        <p>Încarcă mașinile pentru a gestiona alimentările...</p>
                    </div>
                </div>
            </div>
            
            <!-- Tab Documente -->
            <div id="documente" class="tab-content">
                <div class="card">
                    <h2>📄 Gestionează Documente</h2>
                    <p>Selectează o mașină pentru a vedea sau adăuga documente</p>
                    <div id="documente-content">
                        <p>Încarcă mașinile pentru a gestiona documentele...</p>
                    </div>
                </div>
            </div>
            
            <!-- Tab Alertă -->
            <div id="alerte" class="tab-content">
                <div class="card">
                    <h2>🔔 Alertă Expirări Documente</h2>
                    <button class="btn btn-warning" onclick="loadAlerte()">🔄 Verifică Alertă</button>
                    <div id="alerte-content" style="margin-top: 1rem;">
                        <p>Apasă butonul pentru a verifica documentele expirate sau care expiră în următoarele 30 de zile.</p>
                    </div>
                </div>
            </div>
            
            <!-- Tab Dashboard -->
            <div id="dashboard" class="tab-content">
                <div class="card">
                    <h2>📊 Dashboard General</h2>
                    <div id="dashboard-content">
                        <p>Se încarcă statisticile...</p>
                    </div>
                </div>
            </div>
        </div>

        <script>
            // Variabile globale
            let masini = [];
            
            // Funcții tab
            function showTab(tabName) {
                document.querySelectorAll('.tab-content').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.getElementById(tabName).classList.add('active');
                
                // Încarcă conținut specific tabului
                if (tabName === 'alimentari') loadAlimentariTab();
                if (tabName === 'documente') loadDocumenteTab();
                if (tabName === 'dashboard') loadDashboard();
            }
            
            // Funcții mașini
            function loadMasini() {
                fetch('/api/masini')
                .then(response => response.json())
                .then(data => {
                    masini = data.masini || [];
                    const container = document.getElementById('lista-masini');
                    
                    if (masini.length === 0) {
                        container.innerHTML = '<div class="alert alert-warning">🚗 Nu există mașini în baza de date. Adaugă prima mașină!</div>';
                        return;
                    }
                    
                    container.innerHTML = masini.map(masina => \`
                        <div class="masina-item">
                            <div class="masina-info">
                                <div class="masina-numar">\${masina.numar_inmatriculare}</div>
                                <div class="masina-details">\${masina.marca} \${masina.model} \${masina.culoare ? '• ' + masina.culoare : ''}</div>
                            </div>
                            <div class="masina-actions">
                                <button class="btn btn-warning" onclick="viewMasina(\${masina.id})">👁️ Vezi</button>
                                <button class="btn btn-danger" onclick="deleteMasina(\${masina.id})">🗑️ Șterge</button>
                            </div>
                        </div>
                    \`).join('');
                })
                .catch(error => {
                    console.error('Eroare:', error);
                    document.getElementById('lista-masini').innerHTML = '<div class="alert alert-error">Eroare la încărcarea mașinilor</div>';
                });
            }
            
            function addSampleCars() {
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
                    loadMasini();
                    showAlert('✅ ' + results.filter(r => r.success).length + ' mașini exemplu adăugate!', 'success');
                });
            }
            
            function deleteMasina(id) {
                if (confirm('Sigur dorești să ștergi această mașină?')) {
                    fetch('/api/masini/' + id, { method: 'DELETE' })
                    .then(r => r.json())
                    .then(data => {
                        if (data.success) {
                            loadMasini();
                            showAlert('✅ Mașină ștearsă cu succes!', 'success');
                        } else {
                            showAlert('❌ Eroare: ' + data.error, 'error');
                        }
                    })
                    .catch(error => {
                        showAlert('❌ Eroare: ' + error.message, 'error');
                    });
                }
            }
            
            function viewMasina(id) {
                const masina = masini.find(m => m.id == id);
                if (masina) {
                    alert(\`Detalii mașină:\n\nNumăr: \${masina.numar_inmatriculare}\nMarcă: \${masina.marca}\nModel: \${masina.model}\${masina.culoare ? '\\nCuloare: ' + masina.culoare : ''}\`);
                }
            }
            
            // Funcții alimentări
            function loadAlimentariTab() {
                if (masini.length === 0) {
                    loadMasini().then(() => {
                        renderAlimentariTab();
                    });
                } else {
                    renderAlimentariTab();
                }
            }
            
            function renderAlimentariTab() {
                const container = document.getElementById('alimentari-content');
                
                if (masini.length === 0) {
                    container.innerHTML = '<div class="alert alert-warning">Nu există mașini. Adaugă mai întâi o mașină.</div>';
                    return;
                }
                
                container.innerHTML = \`
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="select-masina-alimentare">Selectează Mașina</label>
                            <select id="select-masina-alimentare" onchange="loadAlimentariMasina()">
                                <option value="">-- Alege o mașină --</option>
                                \${masini.map(m => \`<option value="\${m.id}">\${m.numar_inmatriculare} - \${m.marca} \${m.model}</option>\`).join('')}
                            </select>
                        </div>
                    </div>
                    <div id="alimentari-masina-content" style="margin-top: 1.5rem;"></div>
                \`;
            }
            
            function loadAlimentariMasina() {
                const masinaId = document.getElementById('select-masina-alimentare').value;
                if (!masinaId) return;
                
                const masina = masini.find(m => m.id == masinaId);
                
                // Încarcă alimentările existente
                fetch(\`/api/masini/\${masinaId}/alimentari\`)
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('alimentari-masina-content');
                    const alimentari = data.alimentari || [];
                    
                    let html = \`
                        <h3>Alimentări pentru \${masina.numar_inmatriculare}</h3>
                        <button class="btn btn-success" onclick="showFormAlimentare(\${masinaId})">➕ Adaugă Alimentare</button>
                        
                        <div id="form-alimentare" style="display: none; margin: 1.5rem 0;">
                            <div class="card">
                                <h4>Formular Alimentare</h4>
                                <form id="form-noua-alimentare">
                                    <input type="hidden" id="alimentare-masina-id" value="\${masinaId}">
                                    <div class="form-grid">
                                        <div class="form-group">
                                            <label for="data_alimentare">Data Alimentării</label>
                                            <input type="datetime-local" id="data_alimentare" value="\${new Date().toISOString().slice(0, 16)}">
                                        </div>
                                        <div class="form-group">
                                            <label for="cantitate_litri">Cantitate (litri) *</label>
                                            <input type="number" step="0.01" id="cantitate_litri" placeholder="ex: 45.5" required>
                                        </div>
                                        <div class="form-group">
                                            <label for="cost_total">Cost Total (RON) *</label>
                                            <input type="number" step="0.01" id="cost_total" placeholder="ex: 250.75" required>
                                        </div>
                                        <div class="form-group">
                                            <label for="pret_per_litru">Preț per Litru (RON)</label>
                                            <input type="number" step="0.01" id="pret_per_litru" placeholder="ex: 5.50">
                                        </div>
                                        <div class="form-group">
                                            <label for="km_curent">Kilometraj Curent *</label>
                                            <input type="number" id="km_curent" placeholder="ex: 125000" required>
                                        </div>
                                        <div class="form-group">
                                            <label for="locatie">Locație</label>
                                            <input type="text" id="locatie" placeholder="ex: Petrom București">
                                        </div>
                                        <div class="form-group">
                                            <label for="tip_combustibil">Tip Combustibil</label>
                                            <select id="tip_combustibil">
                                                <option value="Benzină">Benzină</option>
                                                <option value="Motorină">Motorină</option>
                                                <option value="GPL">GPL</option>
                                                <option value="Electric">Electric</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                                        <button type="submit" class="btn btn-success">✅ Salvează Alimentarea</button>
                                        <button type="button" class="btn btn-secondary" onclick="hideFormAlimentare()">❌ Anulează</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                        
                        <div style="margin-top: 1.5rem;">
                            \${alimentari.length > 0 ? \`
                                <h4>Istoric Alimentări</h4>
                                \${alimentari.map(a => \`
                                    <div class="masina-item">
                                        <div class="masina-info">
                                            <div class="masina-numar">\${new Date(a.data_alimentare).toLocaleDateString()} - \${a.cantitate_litri}L</div>
                                            <div class="masina-details">
                                                Cost: \${a.cost_total} RON | Km: \${a.km_curent} | Consum: \${a.consum_mediu ? a.consum_mediu.toFixed(2) + 'L/100km' : 'N/A'}
                                                \${a.locatie ? '| Locație: ' + a.locatie : ''}
                                            </div>
                                        </div>
                                    </div>
                                \`).join('')}
                            \` : '<p>Nu există alimentări pentru această mașină.</p>'}
                        </div>
                    \`;
                    
                    container.innerHTML = html;
                })
                .catch(error => {
                    console.error('Eroare:', error);
                    document.getElementById('alimentari-masina-content').innerHTML = '<div class="alert alert-error">Eroare la încărcarea alimentărilor</div>';
                });
            }
            
            function showFormAlimentare(masinaId) {
                document.getElementById('form-alimentare').style.display = 'block';
            }
            
            function hideFormAlimentare() {
                document.getElementById('form-alimentare').style.display = 'none';
            }
            
            // Funcții documente
            function loadDocumenteTab() {
                if (masini.length === 0) {
                    loadMasini().then(() => {
                        renderDocumenteTab();
                    });
                } else {
                    renderDocumenteTab();
                }
            }
            
            function renderDocumenteTab() {
                const container = document.getElementById('documente-content');
                
                if (masini.length === 0) {
                    container.innerHTML = '<div class="alert alert-warning">Nu există mașini. Adaugă mai întâi o mașină.</div>';
                    return;
                }
                
                container.innerHTML = \`
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="select-masina-documente">Selectează Mașina</label>
                            <select id="select-masina-documente" onchange="loadDocumenteMasina()">
                                <option value="">-- Alege o mașină --</option>
                                \${masini.map(m => \`<option value="\${m.id}">\${m.numar_inmatriculare} - \${m.marca} \${m.model}</option>\`).join('')}
                            </select>
                        </div>
                    </div>
                    <div id="documente-masina-content" style="margin-top: 1.5rem;"></div>
                \`;
            }
            
            function loadDocumenteMasina() {
                const masinaId = document.getElementById('select-masina-documente').value;
                if (!masinaId) return;
                
                const masina = masini.find(m => m.id == masinaId);
                
                // Încarcă documentele existente
                fetch(\`/api/masini/\${masinaId}/documente\`)
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('documente-masina-content');
                    const documente = data.documente || [];
                    
                    let html = \`
                        <h3>Documente pentru \${masina.numar_inmatriculare}</h3>
                        <button class="btn btn-success" onclick="showFormDocument(\${masinaId})">➕ Adaugă Document</button>
                        
                        <div id="form-document" style="display: none; margin: 1.5rem 0;">
                            <div class="card">
                                <h4>Formular Document</h4>
                                <form id="form-nou-document">
                                    <input type="hidden" id="document-masina-id" value="\${masinaId}">
                                    <div class="form-grid">
                                        <div class="form-group">
                                            <label for="tip_document">Tip Document *</label>
                                            <select id="tip_document" required>
                                                <option value="">-- Alege tipul --</option>
                                                <option value="RCA">RCA</option>
                                                <option value="ITP">ITP</option>
                                                <option value="Carte Auto">Carte Auto</option>
                                                <option value="Talon">Talon</option>
                                                <option value="Asigurare Casco">Asigurare Casco</option>
                                                <option value="Permis Conducere">Permis Conducere</option>
                                                <option value="Altele">Altele</option>
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label for="numar_document">Număr Document</label>
                                            <input type="text" id="numar_document" placeholder="Număr document">
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
                                            <label for="cost">Cost (RON)</label>
                                            <input type="number" step="0.01" id="cost" placeholder="ex: 450.00">
                                        </div>
                                        <div class="form-group">
                                            <label for="furnizor">Furnizor</label>
                                            <input type="text" id="furnizor" placeholder="ex: Euroins">
                                        </div>
                                        <div class="form-group">
                                            <label for="observatii">Observații</label>
                                            <textarea id="observatii" rows="3" placeholder="Observații..."></textarea>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                                        <button type="submit" class="btn btn-success">✅ Salvează Document</button>
                                        <button type="button" class="btn btn-secondary" onclick="hideFormDocument()">❌ Anulează</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                        
                        <div style="margin-top: 1.5rem;">
                            \${documente.length > 0 ? \`
                                <h4>Listă Documente</h4>
                                \${documente.map(d => \`
                                    <div class="masina-item">
                                        <div class="masina-info">
                                            <div class="masina-numar">\${d.tip_document} \${d.numar_document ? '- ' + d.numar_document : ''}</div>
                                            <div class="masina-details">
                                                Expiră: \${new Date(d.data_expirare).toLocaleDateString()} | 
                                                \${d.cost ? 'Cost: ' + d.cost + ' RON | ' : ''}
                                                \${d.furnizor ? 'Furnizor: ' + d.furnizor : ''}
                                            </div>
                                        </div>
                                        <div class="masina-actions">
                                            <span class="\${getDocumentStatusClass(d.data_expirare)}">\${getDocumentStatus(d.data_expirare)}</span>
                                        </div>
                                    </div>
                                \`).join('')}
                            \` : '<p>Nu există documente pentru această mașină.</p>'}
                        </div>
                    \`;
                    
                    container.innerHTML = html;
                })
                .catch(error => {
                    console.error('Eroare:', error);
                    document.getElementById('documente-masina-content').innerHTML = '<div class="alert alert-error">Eroare la încărcarea documentelor</div>';
                });
            }
            
            function getDocumentStatus(expiryDate) {
                const today = new Date();
                const expDate = new Date(expiryDate);
                const diffTime = expDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays < 0) return 'EXPIRAT';
                if (diffDays <= 30) return 'EXPIRĂ CURÂND';
                return 'VALABIL';
            }
            
            function getDocumentStatusClass(expiryDate) {
                const today = new Date();
                const expDate = new Date(expiryDate);
                const diffTime = expDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays < 0) return 'alert alert-error';
                if (diffDays <= 30) return 'alert alert-warning';
                return 'alert alert-success';
            }
            
            function showFormDocument(masinaId) {
                document.getElementById('form-document').style.display = 'block';
            }
            
            function hideFormDocument() {
                document.getElementById('form-document').style.display = 'none';
            }
            
            // Funcții alerte
            function loadAlerte() {
                fetch('/api/alerte-expirare')
                .then(response => response.json())
                .then(data => {
                    const container = document.getElementById('alerte-content');
                    const alerte = data.alerte || [];
                    
                    if (alerte.length === 0) {
                        container.innerHTML = '<div class="alert alert-success">✅ Toate documentele sunt valabile!</div>';
                        return;
                    }
                    
                    let html = '<h3>Documente care expiră sau au expirat</h3>';
                    
                    alerte.forEach(alert => {
                        const statusClass = alert.status_alert === 'expirat' ? 'alert-error' : 
                                          alert.status_alert === 'expira_curand' ? 'alert-warning' : 'alert-success';
                        
                        html += \`
                            <div class="alert \${statusClass}">
                                <strong>\${alert.numar_inmatriculare} - \${alert.marca} \${alert.model}</strong><br>
                                \${alert.tip_document} expiră: \${new Date(alert.data_expirare).toLocaleDateString()}<br>
                                Status: \${alert.status_alert === 'expirat' ? '🚨 EXPIRAT' : '⚠️ EXPIRĂ CURÂND'}
                            </div>
                        \`;
                    });
                    
                    container.innerHTML = html;
                })
                .catch(error => {
                    console.error('Eroare:', error);
                    document.getElementById('alerte-content').innerHTML = '<div class="alert alert-error">Eroare la încărcarea alertelor</div>';
                });
            }
            
            // Funcții dashboard
            function loadDashboard() {
                const container = document.getElementById('dashboard-content');
                
                if (masini.length === 0) {
                    container.innerHTML = '<div class="alert alert-warning">Nu există mașini pentru a afișa statistici.</div>';
                    return;
                }
                
                // Statistici simple
                const totalMasini = masini.length;
                
                container.innerHTML = \`
                    <div class="form-grid">
                        <div class="card">
                            <h3>🚗 Total Mașini</h3>
                            <p style="font-size: 2rem; font-weight: bold; color: #4361ee;">\${totalMasini}</p>
                        </div>
                        <div class="card">
                            <h3>⛽ Status Alimentări</h3>
                            <p>Verifică alimentările pentru fiecare mașină</p>
                        </div>
                        <div class="card">
                            <h3>📄 Status Documente</h3>
                            <button class="btn btn-warning" onclick="loadAlerte(); showTab('alerte')">Verifică Alertă Expirări</button>
                        </div>
                    </div>
                    
                    <div class="card" style="margin-top: 1.5rem;">
                        <h3>Mașinile Tale</h3>
                        <div class="form-grid">
                            \${masini.map(masina => \`
                                <div class="card">
                                    <h4>\${masina.numar_inmatriculare}</h4>
                                    <p>\${masina.marca} \${masina.model}</p>
                                    <p><small>\${masina.culoare || 'Fără culoare specificată'}</small></p>
                                    <button class="btn" onclick="viewMasinaDetails(\${masina.id})">Vezi Detalii</button>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                \`;
            }
            
            function viewMasinaDetails(id) {
                const masina = masini.find(m => m.id == id);
                if (masina) {
                    alert(\`Detalii complete mașină:\n\n• Număr: \${masina.numar_inmatriculare}\n• Marcă: \${masina.marca}\n• Model: \${masina.model}\n• Culoare: \${masina.culoare || 'Nespecificată'}\n• Status: \${masina.status || 'Activ'}\n• Adăugată: \${new Date(masina.created_at).toLocaleDateString()}\`);
                }
            }
            
            // Event listeners pentru formulare
            document.addEventListener('DOMContentLoaded', function() {
                // Form mașină
                document.getElementById('form-masina').addEventListener('submit', function(e) {
                    e.preventDefault();
                    
                    const masina = {
                        numar_inmatriculare: document.getElementById('numar').value.toUpperCase(),
                        marca: document.getElementById('marca').value,
                        model: document.getElementById('model').value,
                        culoare: document.getElementById('culoare').value
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
                            showAlert('✅ Mașină adăugată cu succes! ID: ' + data.id, 'success');
                        } else {
                            showAlert('❌ Eroare: ' + data.error, 'error');
                        }
                    })
                    .catch(error => {
                        showAlert('❌ Eroare: ' + error.message, 'error');
                    });
                });
                
                // Form alimentare (adaugat dinamic)
                document.addEventListener('submit', function(e) {
                    if (e.target && e.target.id === 'form-noua-alimentare') {
                        e.preventDefault();
                        
                        const alimentare = {
                            data_alimentare: document.getElementById('data_alimentare').value,
                            cantitate_litri: parseFloat(document.getElementById('cantitate_litri').value),
                            cost_total: parseFloat(document.getElementById('cost_total').value),
                            pret_per_litru: document.getElementById('pret_per_litru').value ? parseFloat(document.getElementById('pret_per_litru').value) : null,
                            km_curent: parseInt(document.getElementById('km_curent').value),
                            locatie: document.getElementById('locatie').value,
                            tip_combustibil: document.getElementById('tip_combustibil').value
                        };
                        
                        const masinaId = document.getElementById('alimentare-masina-id').value;
                        
                        fetch(\`/api/masini/\${masinaId}/alimentari\`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(alimentare)
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                hideFormAlimentare();
                                loadAlimentariMasina();
                                showAlert('✅ Alimentare adăugată cu succes!', 'success');
                            } else {
                                showAlert('❌ Eroare: ' + data.error, 'error');
                            }
                        })
                        .catch(error => {
                            showAlert('❌ Eroare: ' + error.message, 'error');
                        });
                    }
                    
                    if (e.target && e.target.id === 'form-nou-document') {
                        e.preventDefault();
                        
                        const document = {
                            tip_document: document.getElementById('tip_document').value,
                            numar_document: document.getElementById('numar_document').value,
                            data_emitere: document.getElementById('data_emitere').value,
                            data_expirare: document.getElementById('data_expirare').value,
                            cost: document.getElementById('cost').value ? parseFloat(document.getElementById('cost').value) : null,
                            furnizor: document.getElementById('furnizor').value,
                            observatii: document.getElementById('observatii').value
                        };
                        
                        const masinaId = document.getElementById('document-masina-id').value;
                        
                        fetch(\`/api/masini/\${masinaId}/documente\`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(document)
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                hideFormDocument();
                                loadDocumenteMasina();
                                showAlert('✅ Document adăugat cu succes!', 'success');
                            } else {
                                showAlert('❌ Eroare: ' + data.error, 'error');
                            }
                        })
                        .catch(error => {
                            showAlert('❌ Eroare: ' + error.message, 'error');
                        });
                    }
                });
            });
            
            // Utilități
            function showAlert(message, type) {
                // Creează un alert temporar
                const alertDiv = document.createElement('div');
                alertDiv.className = \`alert alert-\${type}\`;
                alertDiv.textContent = message;
                alertDiv.style.position = 'fixed';
                alertDiv.style.top = '20px';
                alertDiv.style.right = '20px';
                alertDiv.style.zIndex = '1000';
                alertDiv.style.minWidth = '300px';
                
                document.body.appendChild(alertDiv);
                
                setTimeout(() => {
                    alertDiv.remove();
                }, 5000);
            }
            
            function logout() {
                fetch('/api/logout', { method: 'POST' })
                .then(() => {
                    window.location.href = '/login';
                })
                .catch(error => {
                    window.location.href = '/login';
                });
            }
            
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

// Verificare autentificare
app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
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
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Mașina nu a fost găsită' });
        }
        res.json({ success: true, message: 'Mașină ștearsă cu succes!' });
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
    const { data_alimentare, cantitate_litri, cost_total, pret_per_litru, km_curent, locatie, tip_combustibil } = req.body;
    
    if (!cantitate_litri || !cost_total || !km_curent) {
        return res.status(400).json({ error: 'Cantitate, cost și kilometraj sunt obligatorii' });
    }
    
    // Calculează kilometrii parcurși și consumul
    db.get(
        `SELECT km_curent FROM alimentari 
         WHERE masina_id = ? AND km_curent IS NOT NULL 
         ORDER BY data_alimentare DESC LIMIT 1`,
        [masinaId],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            let kmParcursi = 0;
            let consumMediu = 0;
            
            if (row && row.km_curent) {
                kmParcursi = km_curent - row.km_curent;
                if (kmParcursi > 0) {
                    consumMediu = (cantitate_litri / kmParcursi) * 100; // litri/100km
                }
            }
            
            // Salvează alimentarea
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
        }
    );
});

// Rute documente
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
        environment: process.env.NODE_ENV
    });
});

// Ruta pentru verificare status
app.get('/status', (req, res) => {
    res.json({ 
        status: 'online',
        message: 'Aplicația de management flotă auto rulează',
        timestamp: new Date().toISOString()
    });
});

// Ruta de bază
app.get('/api', (req, res) => {
    res.json({ 
        message: 'Bun venit la API-ul Management Flotă Auto',
        version: '1.0.0',
        endpoints: [
            '/api/login',
            '/api/masini',
            '/api/health'
        ]
    });
});

// Pornire server
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 ========================================');
    console.log('✅ SERVERUL A PORNIT CU SUCCES!');
    console.log(`📍 Accesează: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('🔐 User: Tzrkalex');
    console.log('🔑 Parola: Ro27821091');
    console.log('💾 Baza de date:', dbPath);
    console.log('🚀 ========================================');
});