import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { db } from "./firebase";
import { collection, onSnapshot } from "firebase/firestore";
import 'leaflet/dist/leaflet.css';

// Configuração do ícone do caminhão (estilo frota logística)
const motoristaIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35],
});

const MapaMonitoramento = () => {
    const [motoristas, setMotoristas] = useState([]);

    useEffect(() => {
        // Esta parte conecta no seu Firebase e "escuta" quando um motorista se move
        const unsubscribe = onSnapshot(collection(db, "usuarios"), (snapshot) => {
            const docs = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                // Só mostra no mapa se o motorista tiver latitude e longitude salvas
                if (data.latitude && data.longitude) {
                    docs.push({ id: doc.id, ...data });
                }
            });
            setMotoristas(docs);
        });
        return () => unsubscribe();
    }, []);

    return (
        <div style={{ 
            height: '400px', 
            width: '100%', 
            borderRadius: '12px', 
            overflow: 'hidden', 
            marginBottom: '25px', 
            border: '1px solid #333' 
        }}>
            <MapContainer 
                center={[-23.5505, -46.6333]} // Inicia focado em SP (pode mudar para sua região)
                zoom={5} 
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                {motoristas.map((m) => (
                    <Marker key={m.id} position={[m.latitude, m.longitude]} icon={motoristaIcon}>
                        <Popup>
                            <div style={{color: '#000', fontSize: '12px'}}>
                                <strong>{m.nome || m.email}</strong><br/>
                                <span style={{color: '#666'}}>Localização em tempo real</span>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};

export default MapaMonitoramento;