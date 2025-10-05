const express = require('express');
const cale = require('path');
const parserCorp = require('body-parser');
const session = require('express-session');
const aplicatie = express();
const PORT = process.env.PORT || 3000;

// Middleware
aplicatie.use(parserCorp.urlencoded({ extended: true }));
aplicatie.use(parserCorp.json());
aplicatie.use(express.static(cale.join(__dirname, 'public')));

// Middleware pentru sesiuni
aplicatie.use(session({
    secret: process.env.SESSION_SECRET || 'flota-auto-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Setează EJS ca motor de template
aplicatie.set('view engine', 'ejs');
aplicatie.set('views', cale.join(__dirname, 'views'));

// Baza de date cu utilizatori și permisiuni
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

// Baza de date în memorie pentru mașini
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
    },
    { 
        id: 2, 
        marca: 'BMW', 
        model: 'X5', 
        an: 2019, 
        nrInmatriculare: 'B456XYZ', 
        consum: 8.2, 
        stare: 'În service', 
        adaugatDe: 'Tzrkalex',
        dataAdaugare: new Date().toISOString()
    }
];

let interventii = [
    { 
        id: 1, 
        masinaId: 1, 
        tip: 'Service', 
        descriere: 'Schimb ulei și filtre', 
        cost: 450, 
        data: '2024-01-15', 
        kilometraj: 15000, 
        adaugatDe: 'Tzrkalex' 
    }
];

// Middleware pentru verificarea autentificării
function verificaAutentificare(cerere, raspuns, next) {
    if (cerere.session.esteAutentificat || cerere.path === '/login' || cerere.path === '/') {
        next();
    } else {
        raspuns.redirect('/login');
    }
}

// Middleware pentru verificarea permisiunilor
function verificaPermisiune(permisiune) {
    return (cerere, raspuns, next) => {
        if (cerere.session.permisiuni && cerere.session.permisiuni.includes(permisiune)) {
            next();
        } else {
            raspuns.status(403).render('eroare', {
                titlu: 'Acces Restricționat',
                mesaj: 'Nu aveți permisiunea de a accesa această resursă!'
            });
        }
    };
}

aplicatie.use(verificaAutentificare);

// Middleware pentru variabile globale în views
aplicatie.use((cerere, raspuns, next) => {
    raspuns.locals.utilizator = cerere.session.utilizator;
    raspuns.locals.rol = cerere.session.rol;
    raspuns.locals.permisiuni = cerere.session.permisiuni;
    raspuns.locals.nume = cerere.session.nume;
    next();
});

// ================= RUTE =================

// RUTA PRINCIPALĂ - redirect către login sau dashboard
aplicatie.get('/', (cerere, raspuns) => {
    if (cerere.session.esteAutentificat) {
        raspuns.redirect('/dashboard');
    } else {
        raspuns.redirect('/login');
    }
});

// DASHBOARD
aplicatie.get('/dashboard', (cerere, raspuns) => {
    if (!cerere.session.esteAutentificat) {
        return raspuns.redirect('/login');
    }
    
    raspuns.render('dashboard', { 
        titlu: 'Panou Control Flotă Auto',
        masini: masini,
        totalMasini: masini.length,
        masiniActive: masini.filter(m => m.stare === 'Activă').length
    });
});

// LOGIN
aplicatie.get('/login', (cerere, raspuns) => {
    if (cerere.session.esteAutentificat) {
        return raspuns.redirect('/dashboard');
    }
    raspuns.render('login', { 
        titlu: 'Autentificare',
        eroare: cerere.query.eroare 
    });
});

aplicatie.post('/login', (cerere, raspuns) => {
    const { username, parola } = cerere.body;
    
    const utilizator = utilizatori.find(u => u.username === username && u.parola === parola);
    
    if (utilizator) {
        cerere.session.esteAutentificat = true;
        cerere.session.utilizator = utilizator.username;
        cerere.session.rol = utilizator.rol;
        cerere.session.permisiuni = utilizator.permisiuni;
        cerere.session.nume = utilizator.nume;
        raspuns.redirect('/dashboard');
    } else {
        raspuns.redirect('/login?eroare=1');
    }
});

// LOGOUT
aplicatie.get('/logout', (cerere, raspuns) => {
    cerere.session.destroy((eroare) => {
        if (eroare) {
            console.error('Eroare la logout:', eroare);
        }
        raspuns.redirect('/login');
    });
});

// GESTIUNE MAȘINI
aplicatie.get('/masini', (cerere, raspuns) => {
    raspuns.render('masini', { 
        titlu: 'Gestionare Mașini',
        masini: masini 
    });
});

// ADAUGARE MAȘINĂ
aplicatie.get('/masini/adauga', verificaPermisiune('adaugare'), (cerere, raspuns) => {
    raspuns.render('adauga-masina', { 
        titlu: 'Adaugă Mașină Nouă',
        eroare: null
    });
});

aplicatie.post('/masini/adauga', verificaPermisiune('adaugare'), (cerere, raspuns) => {
    try {
        const masinaNoua = {
            id: masini.length > 0 ? Math.max(...masini.map(m => m.id)) + 1 : 1,
            marca: cerere.body.marca,
            model: cerere.body.model,
            an: parseInt(cerere.body.an),
            nrInmatriculare: cerere.body.nrInmatriculare.toUpperCase(),
            consum: parseFloat(cerere.body.consum),
            stare: cerere.body.stare,
            dataAdaugare: new Date().toISOString(),
            adaugatDe: cerere.session.utilizator
        };
        
        const existaDeja = masini.find(m => m.nrInmatriculare === masinaNoua.nrInmatriculare);
        if (existaDeja) {
            return raspuns.render('adauga-masina', {
                titlu: 'Adaugă Mașină Nouă',
                eroare: 'Numărul de înmatriculare există deja!'
            });
        }
        
        masini.push(masinaNoua);
        raspuns.redirect('/masini');
    } catch (eroare) {
        console.error('Eroare la adăugare mașină:', eroare);
        raspuns.render('adauga-masina', {
            titlu: 'Adaugă Mașină Nouă',
            eroare: 'A apărut o eroare. Verifică datele introduse!'
        });
    }
});

// EDITARE MAȘINĂ
aplicatie.get('/masini/editeaza/:id', verificaPermisiune('editare'), (cerere, raspuns) => {
    const id = parseInt(cerere.params.id);
    const masina = masini.find(m => m.id === id);
    
    if (!masina) {
        return raspuns.status(404).render('eroare', {
            titlu: 'Mașina nu a fost găsită',
            mesaj: 'Mașina pe care încercați să o editați nu există!'
        });
    }
    
    raspuns.render('editeaza-masina', { 
        titlu: 'Editează Mașină',
        masina: masina 
    });
});

aplicatie.post('/masini/editeaza/:id', verificaPermisiune('editare'), (cerere, raspuns) => {
    const id = parseInt(cerere.params.id);
    const index = masini.findIndex(m => m.id === id);
    
    if (index === -1) {
        return raspuns.status(404).render('eroare', {
            titlu: 'Mașina nu a fost găsită',
            mesaj: 'Mașina pe care încercați să o editați nu există!'
        });
    }
    
    masini[index] = {
        ...masini[index],
        marca: cerere.body.marca,
        model: cerere.body.model,
        an: parseInt(cerere.body.an),
        nrInmatriculare: cerere.body.nrInmatriculare.toUpperCase(),
        consum: parseFloat(cerere.body.consum),
        stare: cerere.body.stare
    };
    
    raspuns.redirect('/masini');
});

// ȘTERGERE MAȘINĂ
aplicatie.post('/masini/sterge/:id', verificaPermisiune('stergere'), (cerere, raspuns) => {
    const id = parseInt(cerere.params.id);
    const index = masini.findIndex(m => m.id === id);
    
    if (index === -1) {
        return raspuns.status(404).render('eroare', {
            titlu: 'Mașina nu a fost găsită',
            mesaj: 'Mașina pe care încercați să o ștergeți nu există!'
        });
    }
    
    masini = masini.filter(m => m.id !== id);
    interventii = interventii.filter(i => i.masinaId !== id);
    raspuns.redirect('/masini');
});

// INTERVENȚII MAȘINI
aplicatie.get('/masini/:id/interventii', (cerere, raspuns) => {
    const id = parseInt(cerere.params.id);
    const masina = masini.find(m => m.id === id);
    
    if (!masina) {
        return raspuns.status(404).render('eroare', {
            titlu: 'Mașina nu a fost găsită',
            mesaj: 'Mașina pentru care încercați să vedeți intervențiile nu există!'
        });
    }
    
    const interventiiMasina = interventii.filter(i => i.masinaId === id);
    
    raspuns.render('interventii-masina', {
        titlu: `Intervenții - ${masina.marca} ${masina.model}`,
        masina: masina,
        interventii: interventiiMasina
    });
});

aplicatie.post('/masini/:id/interventii', verificaPermisiune('adaugare'), (cerere, raspuns) => {
    const masinaId = parseInt(cerere.params.id);
    
    try {
        const interventieNoua = {
            id: interventii.length > 0 ? Math.max(...interventii.map(i => i.id)) + 1 : 1,
            masinaId: masinaId,
            tip: cerere.body.tip,
            descriere: cerere.body.descriere,
            cost: parseFloat(cerere.body.cost),
            data: cerere.body.data,
            kilometraj: parseInt(cerere.body.kilometraj),
            adaugatDe: cerere.session.utilizator
        };
        
        interventii.push(interventieNoua);
        raspuns.redirect(`/masini/${masinaId}/interventii`);
    } catch (eroare) {
        console.error('Eroare la adăugare intervenție:', eroare);
        raspuns.redirect(`/masini/${masinaId}/interventii`);
    }
});

// RAPOARTE
aplicatie.get('/rapoarte/consum', (cerere, raspuns) => {
    raspuns.render('raport-consum', { 
        titlu: 'Raport Consum',
        masini: masini 
    });
});

aplicatie.get('/rapoarte/documente', verificaPermisiune('rapoarte'), (cerere, raspuns) => {
    raspuns.render('rapoarte-documente', {
        titlu: 'Rapoarte și Documente',
        masini: masini,
        interventii: interventii
    });
});

// STATISTICI
aplicatie.get('/statistici', (cerere, raspuns) => {
    const statistici = {
        totalMasini: masini.length,
        masiniActive: masini.filter(m => m.stare === 'Activă').length,
        masiniService: masini.filter(m => m.stare === 'În service').length,
        masiniInchiriate: masini.filter(m => m.stare === 'Închiriată').length,
        consumMediu: masini.length > 0 ? (masini.reduce((sum, m) => sum + m.consum, 0) / masini.length).toFixed(2) : 0,
        costTotalInterventii: interventii.reduce((sum, i) => sum + i.cost, 0),
        totalInterventii: interventii.length
    };
    
    raspuns.render('statistici', { 
        titlu: 'Statistici Flotă',
        statistici: statistici 
    });
});

// PAGINA DE ERORI
aplicatie.get('/eroare', (cerere, raspuns) => {
    raspuns.render('eroare', {
        titlu: 'Eroare',
        mesaj: 'A apărut o eroare neașteptată!'
    });
});

// RUTĂ pentru verificare status server
aplicatie.get('/status', (cerere, raspuns) => {
    raspuns.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        masini: masini.length,
        interventii: interventii.length
    });
});

// RUTĂ 404 - pentru orice altceva
aplicatie.use((cerere, raspuns) => {
    raspuns.status(404).render('eroare', {
        titlu: 'Pagina nu a fost găsită',
        mesaj: 'Pagina pe care o căutați nu există!'
    });
});

// Pornire server
aplicatie.listen(PORT, () => {
    console.log(`🚗 Server flotă auto rulând pe portul ${PORT}`);
    console.log(`📊 Accesează: http://localhost:${PORT}`);
    console.log(`🌍 Mediu: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = aplicatie;