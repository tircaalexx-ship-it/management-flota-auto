const express = require('express');
const cale = require('path');
const parserCorp = require('body-parser');
const aplicatie = express();
const PORT = process.env.PORT || 3000;

// Middleware
aplicatie.use(parserCorp.urlencoded({ extended: true }));
aplicatie.use(parserCorp.json());
aplicatie.use(express.static(cale.join(__dirname, 'public')));

// Setează EJS ca motor de template
aplicatie.set('view engine', 'ejs');
aplicatie.set('views', cale.join(__dirname, 'views'));

// Bază de date în memorie
let masini = [
    { id: 1, marca: 'Volkswagen', model: 'Golf', an: 2020, nrInmatriculare: 'B123ABC', consum: 5.8, stare: 'Activă' },
    { id: 2, marca: 'BMW', model: 'X5', an: 2019, nrInmatriculare: 'B456XYZ', consum: 8.2, stare: 'În service' },
    { id: 3, marca: 'Audi', model: 'A4', an: 2021, nrInmatriculare: 'B789DEF', consum: 6.1, stare: 'Activă' },
    { id: 4, marca: 'Mercedes', model: 'C-Class', an: 2022, nrInmatriculare: 'B101GHI', consum: 7.3, stare: 'Închiriată' }
];

// Rute principale
aplicatie.get('/', (cerere, raspuns) => {
    raspuns.render('dashboard', { 
        titlu: 'Panou Control Flotă Auto',
        masini: masini,
        totalMasini: masini.length,
        masiniActive: masini.filter(m => m.stare === 'Activă').length
    });
});

// Rută pentru pagina de login
aplicatie.get('/login', (cerere, raspuns) => {
    raspuns.sendFile(cale.join(__dirname, 'public', 'login.html'));
});

// Rută pentru autentificare
aplicatie.post('/login', (cerere, raspuns) => {
    const { utilizator, parola } = cerere.body;
    
    // Verificare simplă (în producție folosește baza de date)
    if (utilizator === 'Tzrkalex' && parola === 'Ro27821091') {
        raspuns.redirect('/');
    } else {
        raspuns.redirect('/login?error=1');
    }
});

// Pagina de gestionare mașini
aplicatie.get('/masini', (cerere, raspuns) => {
    raspuns.render('masini', { 
        titlu: 'Gestionare Mașini',
        masini: masini 
    });
});

// Adăugare mașină nouă - FORMULAR
aplicatie.get('/masini/adauga', (cerere, raspuns) => {
    raspuns.render('adauga-masina', { 
        titlu: 'Adaugă Mașină Nouă' 
    });
});

// Adăugare mașină nouă - POST
aplicatie.post('/masini/adauga', (cerere, raspuns) => {
    const masinaNoua = {
        id: masini.length > 0 ? Math.max(...masini.map(m => m.id)) + 1 : 1,
        marca: cerere.body.marca,
        model: cerere.body.model,
        an: parseInt(cerere.body.an),
        nrInmatriculare: cerere.body.nrInmatriculare,
        consum: parseFloat(cerere.body.consum),
        stare: cerere.body.stare
    };
    
    masini.push(masinaNoua);
    raspuns.redirect('/masini');
});

// Editare mașină - FORMULAR
aplicatie.get('/masini/editeaza/:id', (cerere, raspuns) => {
    const id = parseInt(cerere.params.id);
    const masina = masini.find(m => m.id === id);
    
    if (!masina) {
        return raspuns.status(404).send('Mașina nu a fost găsită');
    }
    
    raspuns.render('editeaza-masina', { 
        titlu: 'Editează Mașină',
        masina: masina 
    });
});

// Editare mașină - POST
aplicatie.post('/masini/editeaza/:id', (cerere, raspuns) => {
    const id = parseInt(cerere.params.id);
    const index = masini.findIndex(m => m.id === id);
    
    if (index === -1) {
        return raspuns.status(404).send('Mașina nu a fost găsită');
    }
    
    masini[index] = {
        id: id,
        marca: cerere.body.marca,
        model: cerere.body.model,
        an: parseInt(cerere.body.an),
        nrInmatriculare: cerere.body.nrInmatriculare,
        consum: parseFloat(cerere.body.consum),
        stare: cerere.body.stare
    };
    
    raspuns.redirect('/masini');
});

// Ștergere mașină
aplicatie.post('/masini/sterge/:id', (cerere, raspuns) => {
    const id = parseInt(cerere.params.id);
    masini = masini.filter(m => m.id !== id);
    raspuns.redirect('/masini');
});

// Raport consum
aplicatie.get('/rapoarte/consum', (cerere, raspuns) => {
    raspuns.render('raport-consum', { 
        titlu: 'Raport Consum',
        masini: masini 
    });
});

// Statistici
aplicatie.get('/statistici', (cerere, raspuns) => {
    const statistici = {
        totalMasini: masini.length,
        masiniActive: masini.filter(m => m.stare === 'Activă').length,
        masiniService: masini.filter(m => m.stare === 'În service').length,
        masiniInchiriate: masini.filter(m => m.stare === 'Închiriată').length,
        consumMediu: (masini.reduce((suma, m) => suma + m.consum, 0) / masini.length).toFixed(2)
    };
    
    raspuns.render('statistici', { 
        titlu: 'Statistici Flotă',
        statistici: statistici 
    });
});

// API pentru date JSON
aplicatie.get('/api/masini', (cerere, raspuns) => {
    raspuns.json(masini);
});

// Pornire server
aplicatie.listen(PORT, () => {
    console.log(`🚗 Server flotă auto rulând pe portul ${PORT}`);
    console.log(`📊 Accesează: http://localhost:${PORT}`);
});

module.exports = aplicatie;