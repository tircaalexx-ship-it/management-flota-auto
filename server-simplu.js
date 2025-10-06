const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));

// Rute simple
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Flota Auto - TEST</title>
            <style>
                body { font-family: Arial; background: #667eea; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .container { text-align: center; }
                h1 { font-size: 2.5em; }
                .login-box { background: white; color: #333; padding: 30px; border-radius: 10px; margin-top: 20px; }
                input, button { padding: 10px; margin: 5px; border-radius: 5px; border: 1px solid #ddd; }
                button { background: #667eea; color: white; border: none; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚗 Flota Auto - TEST</h1>
                <div class="login-box">
                    <h3>Test Login</h3>
                    <form action="/login" method="POST">
                        <input type="text" name="username" placeholder="Username" required><br>
                        <input type="password" name="password" placeholder="Password" required><br>
                        <button type="submit">Login</button>
                    </form>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt:', username, password);
    
    if (username === 'admin' && password === 'admin') {
        res.send(`
            <h1>✅ Login Successful!</h1>
            <p>Welcome, ${username}!</p>
            <a href="/">Back to Login</a>
        `);
    } else {
        res.send(`
            <h1>❌ Login Failed!</h1>
            <p>Invalid credentials. Try admin/admin</p>
            <a href="/">Try Again</a>
        `);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server TEST running on http://localhost:${PORT}`);
    console.log(`🔑 Test with: admin / admin`);
});