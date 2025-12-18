import React, { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './Login';
import PainelGestor from './PainelGestor'; // Importando o novo painel profissional
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Monitora o estado da autenticação em tempo real
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe(); // Limpa o monitoramento ao fechar o app
  }, []);

  // Tela de carregamento com o estilo Dark
  if (loading) {
    return (
      <div className="container-login">
        <div className="content-login">
          <h1 className="logo">DESCARGO</h1>
          <div className="linha-destaque"></div>
          <p style={{ color: '#FFD700', fontWeight: 'bold' }}>INICIALIZANDO SISTEMA...</p>
        </div>
      </div>
    );
  }

  // Se não houver usuário logado, mostra a tela de Login Dark & Gold
  if (!user) {
    return <Login />;
  }

  // Se estiver logado, mostra o Painel Gestor com Mapa e Lista Lateral
  return <PainelGestor />;
}

export default App;