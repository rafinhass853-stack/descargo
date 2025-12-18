const express = require('express');
const cors = require('cors');
const admin = require("firebase-admin");

// Ele busca o arquivo que você já renomeou
const serviceAccount = require("./firebase-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());

// ROTA DE TESTE GOOGLE
app.get('/testar-google', async (req, res) => {
    try {
        const testeRef = db.collection('verificacao').doc('primeiro_teste');
        await testeRef.set({
            conectado: true,
            plataforma: "Google Firebase",
            data: new Date().toISOString()
        });
        res.json({ mensagem: "🚀 Conexão com Google Firebase OK!" });
    } catch (error) {
        res.status(500).json({ erro: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor Google rodando em http://localhost:${PORT}`);
});