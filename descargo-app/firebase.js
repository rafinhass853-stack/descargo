import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // <-- Adicione esta linha

// Configuração do seu projeto
const firebaseConfig = {
  apiKey: "AIzaSyAAANwxEopbLtRmWqF2b9mrOXbOwUf5x8M",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app", // <-- Verifique se este domínio está correto no console
  messagingSenderId: "345718597496",
  appId: "1:345718597496:web:97af37f598666e0a3bca8d",
};

// Inicialização segura
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Exportando as instâncias
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // <-- Adicione esta linha

export { auth, db, storage, app }; // <-- Adicione storage aqui