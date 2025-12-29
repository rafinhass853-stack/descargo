import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuração do seu projeto (conforme as imagens do console Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyAAANwxEopbLtRmWqF2b9mrOXbOwUf5x8M",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app",
  messagingSenderId: "345718597496",
  appId: "1:345718597496:web:97af37f598666e0a3bca8d",
};

// Inicialização segura para evitar erros de re-inicialização no React Native
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Exportando as instâncias para uso nos componentes
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, app };