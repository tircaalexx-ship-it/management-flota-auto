const express = require('express');
const cale = require('path');
const parserCorp = require('body-parser');
const session = require('express-session');
const aplicatie = express();
const PORT = process.env.PORT || 3000;

// Middleware de bază
aplicatie.use(parserCorp.urlencoded({ extended: true }));
aplicatie.use(parserCorp.json());
aplicatie.use(express.static(cale.join(__dirname, 'public')));

// Configurare sesiune pentru producție
aplicatie.use(session({
    secret: process.env.SESSION_SECRET || 'development-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Setează EJS
aplicatie.set('view engine', 'ejs');
aplicatie.set('views', cale.join(__dirname, 'views'));

// Middleware pentru logging
aplicatie.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Utilizatori
const utilizatori = [
    {
        username: 'Tzrkalex',
        parola: 'Ro27821091',
        rol: 'admin',
        nume: 'Alexandru Tîrcă',
        permisiuni: ['vizualizare', 'adaugare', 'editare', 'stergere', 'rapoarte', 'administrare']
    },
    {
        username: 'Apavie',
        parola: 'Ro15307144', 
        rol: 'user',
        nume: 'Pavie Adrian',
        permisiuni: ['vizualizare', 'adaugare']
    }
];

// Date inițiale
let masini = [
    { 
        id: 1, 
        marca: 'Volkswagen', 
        model: 'Golf', 
        an: 2020, 
        nrInmatriculare: 'B123ABC', 
        consum: 5.8, 
        stare: 'Activă', 
        adaugatDe: 'Tzrkalex',
        dataAdaugare: new Date().toISOString()
    }
];

let interventii = [];

// Middleware autentificare
function verificaAutentificare(req, res, next) {
    if (req.session.esteAutentificat || req.path === '/login' || req.path === '/' || req.path === '/health') {
        next();
    } else {
        res.redirect('/login');
    }
}

aplicatie.use(verificaAutentificare);

// Variabile globale pentru views
aplicatie.use((req, res, next) => {
    res.locals.utilizator = req.session.utilizator;
    res.locals.rol = req.session.rol;
    res.locals.permisiuni = req.session.permisiuni;
    res.locals.nume = req.session.nume;
    next();
});

// Rute de bază
aplicatie.get('/', (req, res) => {
    if (req.session.esteAutentificat) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

aplicatie.get('/dashboard', (req, res) => {
    try {
        res.render('dashboard', { 
            titlu: 'Panou Control Flotă Auto',
            masini: masini,
            totalMasini: masini.length,
            masiniActive: masini.filter(m => m.stare === 'Activă').length
        });
    } catch (error) {
        console.error('Eroare la render dashboard:', error);
        res.status(500).render('eroare', {
            titlu: 'Eroare Server',
            mesaj: 'A apărut o eroare la încărcarea dashboard-ului.'
        });
    }
});

// Login
aplicatie.get('/login', (req, res) => {
    if (req.session.esteAutentificat) {
        return res.redirect('/dashboard');
    }
    res.render('login', { 
        titlu: 'Autentificare',
        eroare: req.query.eroare 
    });
});

aplicatie.post('/login', (req, res) => {
    try {
        const { username, parola } = req.body;
        
        const utilizator = utilizatori.find(u => u.username === username && u.parola === parola);
        
        if (utilizator) {
            req.session.esteAutentificat = true;
            req.session.utilizator = utilizator.username;
            req.session.rol = utilizator.rol;
            req.session.permisiuni = utilizator.permisiuni;
            req.session.nume = utilizator.nume;
            res.redirect('/dashboard');
        } else {
            res.redirect('/login?eroare=1');
        }
    } catch (error) {
        console.error('Eroare la login:', error);
        res.redirect('/login?eroare=1');
    }
});

// Logout
aplicatie.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Eroare la logout:', err);
        }
        res.redirect('/login');
    });
});

// Ruta de health check
aplicatie.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        masini: masini.length,
        interventii: interventii.length
    });
});

// Rute simple pentru test
aplicatie.get('/masini', (req, res) => {
    try {
        res.render('masini', { 
            titlu: 'Gestionare Mașini',
            masini: masini 
        });
    } catch (error) {
        console.error('Eroare la render masini:', error);
        res.status(500).render('eroare', {
            titlu: 'Eroare Server',
            mesaj: 'A apărut o eroare la încărcarea paginii mașini.'
        });
    }
});

// Handler pentru erori 404
aplicatie.use((req, res) => {
    res.status(404).render('eroare', {
        titlu: 'Pagina nu a fost găsită',
        mesaj: 'Pagina pe care o căutați nu există!'
    });
});

// Handler pentru erori generale
aplicatie.use((err, req, res, next) => {
    console.error('Eroare generală:', err);
    res.status(500).render('eroare', {
        titlu: 'Eroare Server',
        mesaj: 'A apărut o eroare internă pe server.'
    });
});

// Pornire server
aplicatie.listen(PORT, () => {
    console.log(`🚗 Server flotă auto rulând pe portul ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🌍 Mediu: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = aplicatie;