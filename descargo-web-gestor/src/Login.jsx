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
      await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log("Sucesso: Gestor logado!");
    } catch (error) {
      console.error("Erro completo:", error.code);
      if (error.code === 'auth/invalid-credential') {
        alert("E-mail ou senha incorretos.");
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

        <div className="footer-dev">
          <a 
            href="https://www.linkedin.com/in/rafael-araujo1992/" 
            target="_blank" 
            rel="noreferrer" 
            className="dev-name"
          >
            Desenvolvido por Rafael Araujo
          </a>

          <div className="social-icons-row">
            <a href="https://www.instagram.com/rafael.araujo1992/" target="_blank" rel="noreferrer">
              <img src="https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg" alt="Instagram" className="logo-social-web" />
            </a>
            
            <a href="https://wa.me/5516988318626" target="_blank" rel="noreferrer">
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="logo-social-web" />
            </a>
            
            <a href="https://www.linkedin.com/in/rafael-araujo1992/" target="_blank" rel="noreferrer">
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png" alt="LinkedIn" className="logo-social-web" />
            </a>
            
            <a href="mailto:rafinhass853@gmail.com">
              <img src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg" alt="E-mail" className="logo-social-web" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}