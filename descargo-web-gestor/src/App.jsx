import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from "firebase/auth";
import TelaLogin from './TelaLogin';
import PainelGestor from './PainelGestor';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // Monitora se o Firebase autenticou o gestor
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setCarregando(false);
    });
    return () => unsubscribe();
  }, []);

  if (carregando) return <div style={{background:'#000', height:'100vh'}} />;

  // Se houver usuário, mostra o Painel. Se não, mostra o Login.
  return usuario ? <PainelGestor /> : <TelaLogin />;
}

export default App;