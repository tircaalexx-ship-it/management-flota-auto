const bcrypt = require('bcryptjs');
const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    router.post('/login', (req, res) => {
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

    router.post('/logout', (req, res) => {
        req.session.destroy((err) => {
            if (err) return res.status(500).json({ error: 'Eroare la logout' });
            res.json({ success: true, message: 'Delogare reușită' });
        });
    });

    router.get('/check-auth', (req, res) => {
        if (req.session.user) {
            res.json({ authenticated: true, user: req.session.user });
        } else {
            res.json({ authenticated: false });
        }
    });

    return router;
};