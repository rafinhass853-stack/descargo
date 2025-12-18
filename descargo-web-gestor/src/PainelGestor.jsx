import React, { useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { db, auth } from './firebaseConfig';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import './App.css';

const mapStyleNoite = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

const containerStyle = { width: '100%', height: '100%' };
const centerDefault = { lat: -21.785, lng: -48.175 }; 

export default function PainelGestor() {
  const [motoristas, setMotoristas] = useState([]);
  const [mapa, setMapa] = useState(null);
  const [focoLocal, setFocoLocal] = useState(centerDefault);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: "AIzaSyB_FeGv50C-S4--2Lf4CKhInsuKBYSQZTk" 
  });

  useEffect(() => {
    const q = query(collection(db, "motoristas"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMotoristas(lista);
    });
    return () => unsubscribe();
  }, []);

  const verNoMapa = (pos) => {
    if (pos?.latitude && pos?.longitude) {
      const novaPos = { lat: pos.latitude, lng: pos.longitude };
      setFocoLocal(novaPos);
      if (mapa) mapa.panTo(novaPos);
    }
  };

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo-small">DESCARGO</h1>
          <p className="gestor-label">GESTOR CONECTADO</p>
        </div>

        <div className="lista-scroll">
          {motoristas.length === 0 ? (
            <p className="msg-vazia">Aguardando sinal dos motoristas...</p>
          ) : (
            motoristas.map(m => (
              <div key={m.id} className="card-mini" onClick={() => verNoMapa(m.ultimaLocalizacao)}>
                <div className="card-mini-row">
                  <span className="nome">{m.nome || 'Motorista'}</span>
                  <div className={`ponto-status ${m.status === 'EM_JORNADA' ? 'online' : 'offline'}`} />
                </div>
                <p className="status-texto">{m.status || 'OFFLINE'}</p>
                <button className="btn-focar">FOCAR NO MAPA</button>
              </div>
            ))
          )}
        </div>

        <button className="btn-sair" onClick={() => signOut(auth)}>LOGOUT SISTEMA</button>
      </aside>

      <main className="map-area">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={focoLocal}
            zoom={13}
            onLoad={map => setMapa(map)}
            options={{ styles: mapStyleNoite, disableDefaultUI: true, zoomControl: true }}
          >
            {motoristas.map(m => m.ultimaLocalizacao && (
              <Marker 
                key={m.id}
                position={{ lat: m.ultimaLocalizacao.latitude, lng: m.ultimaLocalizacao.longitude }}
                label={{ text: m.nome?.substring(0,1), color: '#000', fontWeight: 'bold' }}
                icon={{
                  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
                  fillColor: m.status === 'EM_JORNADA' ? "#2ecc71" : "#FFD700",
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: "#FFF",
                  scale: 1.5,
                  anchor: { x: 12, y: 22 }
                }}
              />
            ))}
          </GoogleMap>
        ) : <div className="loading-map">Carregando Mapa...</div>}
      </main>
    </div>
  );
}