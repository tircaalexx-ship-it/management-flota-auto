const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Management Flotă Auto</title>
        <style>
            body { font-family: Arial; background: #667eea; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .container { text-align: center; }
            h1 { font-size: 3em; }
            a { color: yellow; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚗 Management Flotă Auto</h1>
            <p>Serverul funcționează perfect!</p>
            <p>Accesează <a href="/login">pagina de login</a></p>
        </div>
    </body>
    </html>
  `);
});

app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Login</title>
        <style>
            body { font-family: Arial; background: #667eea; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .login-box { background: white; padding: 30px; border-radius: 10px; text-align: center; }
            button { background: #4361ee; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="login-box">
            <h2>🔐 Autentificare</h2>
            <p>Totul funcționează!</p>
            <button onclick="window.location.href='/'">👉 Mergi la Pagina Principală</button>
        </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log('🚀 Serverul rulează pe http://localhost:' + PORT);
}); 
