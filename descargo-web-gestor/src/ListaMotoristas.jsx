import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query } from 'firebase/firestore';

export default function ListaMotoristas() {
  const [motoristas, setMotoristas] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "motoristas"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMotoristas(lista);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="container-lista">
      <div className="header-lista">
        <h3>📍 MOTORISTAS EM ATIVIDADE</h3>
        <div className="linha-destaque-pequena"></div>
      </div>

      <div className="grid-motoristas">
        {motoristas.length === 0 ? (
          <p className="status-vazio">Nenhum motorista online no momento.</p>
        ) : (
          motoristas.map((m) => (
            <div key={m.id} className="card-motorista">
              <div className="card-header">
                <span className="motorista-nome">{m.nome || 'Motorista'}</span>
                <span className={`status-badge ${m.status?.toLowerCase()}`}>
                  {m.status || 'OFFLINE'}
                </span>
              </div>
              
              <div className="card-body">
                <p><strong>Email:</strong> {m.email}</p>
                <p><strong>Jornada:</strong> {m.jornada || 'Não iniciada'}</p>
                <p className="localizacao">
                  {m.ultimaLocalizacao 
                    ? `Lat: ${m.ultimaLocalizacao.latitude.toFixed(4)}, Lng: ${m.ultimaLocalizacao.longitude.toFixed(4)}`
                    : 'Localização não disponível'}
                </p>
              </div>

              <div className="card-footer">
                <button className="btn-acao-mapa">VER NO MAPA</button>
                <button className="btn-acao-detalhes">HISTÓRICO</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}