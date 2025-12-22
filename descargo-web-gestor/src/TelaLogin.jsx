import React, { useState } from 'react';
import { auth } from './firebase';
import { signInWithEmailAndPassword } from "firebase/auth";
// Importando os ícones específicos para Web (requer: npm install react-icons)
import { FaWhatsapp, FaInstagram, FaLinkedin } from 'react-icons/fa';

const TelaLogin = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const realizarLogin = async (e) => {
    e.preventDefault();
    if (!email || !senha) return alert("Preencha e-mail e senha.");

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      // Login bem-sucedido: o Firebase mudará o estado automaticamente
    } catch (err) {
      // Usamos 'err' no console para o VS Code não marcar erro de variável não utilizada
      console.error("Erro detalhado no login:", err); 
      alert("Erro no Login. Verifique se você digitou o e-mail e senha corretamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.contentLogin}>
        <h1 style={styles.logo}>DESCARGO</h1>
        <div style={styles.linhaDestaque}></div>
        <p style={styles.subtitulo}>PAINEL DO GESTOR</p>

        <form onSubmit={realizarLogin} style={styles.form}>
          <input 
            type="email" 
            placeholder="E-mail" 
            style={styles.inputFundo} 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="Senha" 
            style={styles.inputFundo} 
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <button type="submit" style={styles.btnEntrar} disabled={loading}>
            {loading ? "CARREGANDO..." : "ENTRAR NO SISTEMA"}
          </button>
        </form>

        <div style={styles.footerDev}>
          <p style={styles.textoDev}>Desenvolvido por Rafael Araujo</p>
          <div style={styles.rowIcones}>
            <a href="https://wa.me/5516988318626" target="_blank" rel="noreferrer" title="WhatsApp">
              <FaWhatsapp size={30} color="#25D366" />
            </a>
            <a href="https://www.instagram.com/rafael.araujo1992/" target="_blank" rel="noreferrer" title="Instagram">
              <FaInstagram size={30} color="#E1306C" />
            </a>
            <a href="https://www.linkedin.com/in/rafael-araujo1992/" target="_blank" rel="noreferrer" title="LinkedIn">
              <FaLinkedin size={30} color="#0077B5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    margin: 0,
    fontFamily: 'Arial, sans-serif'
  },
  contentLogin: {
    width: '100%',
    maxWidth: '380px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
  },
  logo: { fontSize: '48px', fontWeight: '900', color: '#FFD700', margin: 0 },
  linhaDestaque: { height: '4px', backgroundColor: '#FF8C00', width: '80px', margin: '10px 0 25px 0' },
  subtitulo: { color: '#888', fontSize: '13px', letterSpacing: '3px', marginBottom: '35px', fontWeight: 'bold' },
  form: { width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' },
  inputFundo: { 
    backgroundColor: '#161616', color: '#FFF', padding: '18px', borderRadius: '10px', 
    border: '1px solid #222', fontSize: '16px', outline: 'none' 
  },
  btnEntrar: { 
    backgroundColor: '#FFD700', color: '#000', padding: '18px', borderRadius: '10px', 
    border: 'none', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', marginTop: '10px' 
  },
  footerDev: { marginTop: '50px', textAlign: 'center' },
  textoDev: { color: '#666', fontSize: '13px', marginBottom: '20px' },
  rowIcones: { display: 'flex', gap: '30px', justifyContent: 'center' },
};

export default TelaLogin;