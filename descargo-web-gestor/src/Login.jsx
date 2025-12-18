import React, { useState } from 'react';
import { auth } from './firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import './App.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      alert("Por favor, preencha e-mail e senha.");
      return;
    }

    setLoading(true);
    try {
      // Tenta logar no Firebase com os dados digitados
      await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log("Sucesso: Gestor logado!");
    } catch (error) {
      console.error("Erro completo:", error.code);
      
      // Mensagens amigáveis para erros comuns
      if (error.code === 'auth/invalid-credential') {
        alert("E-mail ou senha incorretos. Verifique os dados no Firebase.");
      } else if (error.code === 'auth/user-not-found') {
        alert("Usuário não encontrado.");
      } else {
        alert("Erro ao acessar o painel: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-login">
      <div className="content-login">
        <h1 className="logo">DESCARGO</h1>
        <div className="linha-destaque"></div>
        <p className="subtitle">PAINEL WEB GESTOR</p>

        <form onSubmit={handleLogin} style={{ width: '100%' }}>
          <input 
            type="email" 
            className="input-fundo"
            placeholder="E-mail" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoCapitalize="none"
          />
          
          <input 
            type="password" 
            className="input-fundo"
            placeholder="Senha" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" className="btn-entrar" disabled={loading}>
            {loading ? 'AUTENTICANDO...' : 'ENTRAR NO PAINEL'}
          </button>
        </form>

        <a 
          href="https://wa.me/5516988318626" 
          target="_blank" 
          rel="noreferrer" 
          className="suporte-link"
        >
          💬 SUPORTE WHATSAPP
        </a>
      </div>
    </div>
  );
}