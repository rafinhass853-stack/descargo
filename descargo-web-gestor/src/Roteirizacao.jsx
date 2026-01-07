import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, Polygon, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import { db } from "./firebase";
import { 
    collection, 
    onSnapshot, 
    addDoc, 
    deleteDoc, 
    updateDoc, 
    doc, 
    serverTimestamp, 
    query, 
    orderBy 
} from "firebase/firestore";
import { Navigation, Save, List, Trash2, Edit3, XCircle, Gauge } from 'lucide-react';

// --- CORREÇÃO DE ÍCONES (IMPORTANTE PARA VITE/REACT 19) ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- CONTROLLER DO MAPA E ROTAS ---
const MapEvents = ({ waypoints, setDistancia }) => {
    const map = useMap();
    const routingControlRef = useRef(null);

    useEffect(() => {
        // Força o mapa a preencher o container (Evita tela branca)
        setTimeout(() => { map.invalidateSize(); }, 300);
    }, [map]);

    useEffect(() => {
        if (!map || !waypoints || waypoints.length < 2) return;

        if (routingControlRef.current) {
            map.removeControl(routingControlRef.current);
        }

        const control = L.Routing.control({
            waypoints: waypoints.map(p => L.latLng(p.lat, p.lng)),
            lineOptions: { styles: [{ color: '#FFD700', weight: 6, opacity: 0.8 }] },
            routeWhileDragging: false,
            addWaypoints: false,
            show: false,
        }).addTo(map);

        routingControlRef.current = control;

        control.on('routesfound', (e) => {
            const distKm = (e.routes[0].summary.totalDistance / 1000).toFixed(2);
            setDistancia(distKm);
        });

        // Esconde o painel de texto do Leaflet
        const container = control.getContainer();
        if (container) container.style.display = 'none';

        const bounds = L.latLngBounds(waypoints.map(p => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });

        return () => {
            if (routingControlRef.current && map) map.removeControl(routingControlRef.current);
        };
    }, [map, waypoints]);

    return null;
};

const Roteirizacao = () => {
    const [clientes, setClientes] = useState([]);
    const [rotasSalvas, setRotasSalvas] = useState([]);
    const [pontoA, setPontoA] = useState(null);
    const [pontoB, setPontoB] = useState(null);
    const [rotaAtiva, setRotaAtiva] = useState([]);
    const [distanciaAtual, setDistanciaAtual] = useState(0);

    useEffect(() => {
        const unsubC = onSnapshot(collection(db, "cadastro_clientes_pontos"), (snap) => {
            setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const q = query(collection(db, "rotas_planejadas"), orderBy("criadoEm", "desc"));
        const unsubR = onSnapshot(q, (snap) => {
            setRotasSalvas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => { unsubC(); unsubR(); };
    }, []);

    const gerarRota = () => {
        if (pontoA?.geofence?.coordenadas && pontoB?.geofence?.coordenadas) {
            const cA = pontoA.geofence.coordenadas[0];
            const cB = pontoB.geofence.coordenadas[0];
            setRotaAtiva([
                { lat: cA.lat || cA[0], lng: cA.lng || cA[1] },
                { lat: cB.lat || cB[0], lng: cB.lng || cB[1] }
            ]);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ color: '#FFD700', margin: 0 }}>Roteirização</h2>
                <button onClick={gerarRota} style={{ background: '#FFD700', padding: '10px 20px', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                    <Navigation size={16} /> Gerar Trajeto
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', flex: 1, minHeight: '600px' }}>
                <div style={{ background: '#0a0a0a', padding: '20px', borderRadius: '10px', border: '1px solid #222' }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px', background: '#111', padding: '15px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#666' }}>DISTÂNCIA</span>
                        <h2 style={{ color: '#FFD700', margin: 0 }}>{distanciaAtual} KM</h2>
                    </div>
                    
                    <select style={{ width: '100%', padding: '10px', background: '#111', color: '#fff', marginBottom: '10px' }} onChange={(e) => setPontoA(clientes.find(c => c.id === e.target.value))}>
                        <option>Selecione a Origem...</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.cliente}</option>)}
                    </select>

                    <select style={{ width: '100%', padding: '10px', background: '#111', color: '#fff' }} onChange={(e) => setPontoB(clientes.find(c => c.id === e.target.value))}>
                        <option>Selecione o Destino...</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.cliente}</option>)}
                    </select>
                </div>

                <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #222', background: '#111' }}>
                    <MapContainer center={[-23.5, -46.6]} zoom={6} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapEvents waypoints={rotaAtiva} setDistancia={setDistanciaAtual} />
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};

export default Roteirizacao;