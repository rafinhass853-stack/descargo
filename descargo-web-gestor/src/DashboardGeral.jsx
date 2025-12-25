import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Circle } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { Users, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import L from 'leaflet';
import { db } from "./firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const caminhaoIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -35],
});

const MapResizer = () => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => { map.invalidateSize(); }, 100);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

const DashboardGeral = ({ styles, totalCadastradosProp }) => {
    const [motoristasAtivos, setMotoristasAtivos] = useState([]);
    const [totalCadastradosInterno, setTotalCadastradosInterno] = useState(0);
    const [cercas, setCercas] = useState([]); // Novo estado para as cercas

    useEffect(() => {
        // 1. Busca total de motoristas cadastrados
        const qMotoristas = query(collection(db, "cadastro_motoristas"));
        const unsubscribeMotoristas = onSnapshot(qMotoristas, (snapshot) => {
            setTotalCadastradosInterno(snapshot.size);
        });

        // 2. Busca cercas de clientes (Geofences)
        const qCercas = query(collection(db, "cadastro_clientes_pontos"));
        const unsubscribeCercas = onSnapshot(qCercas, (snapshot) => {
            const listaCercas = [];
            snapshot.forEach((doc) => {
                listaCercas.push({ id: doc.id, ...doc.data() });
            });
            setCercas(listaCercas);
        });

        // 3. Busca localização em tempo real dos motoristas
        const qLoc = query(collection(db, "localizacao_realtime"));
        const unsubscribeLoc = onSnapshot(qLoc, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                const dados = doc.data();
                if (dados.latitude && dados.longitude) {
                    lista.push({
                        id: doc.id,
                        usuario: dados.nome || dados.email?.split('@')[0] || "Motorista",
                        lat: parseFloat(dados.latitude),
                        lng: parseFloat(dados.longitude),
                        statusOp: dados.statusOperacional || 'Sem programação',
                        statusJornada: dados.statusJornada || 'fora da jornada',
                        ultimaAtualizacao: dados.ultimaAtualizacao?.toDate 
                            ? dados.ultimaAtualizacao.toDate().toLocaleTimeString() 
                            : new Date().toLocaleTimeString()
                    });
                }
            });
            setMotoristasAtivos(lista);
        });

        return () => { 
            unsubscribeMotoristas(); 
            unsubscribeLoc(); 
            unsubscribeCercas(); 
        };
    }, []);

    const emViagem = motoristasAtivos.filter(m => 
        m.statusOp.toLowerCase().includes('viagem') || m.statusOp.toLowerCase().includes('carregando')
    ).length;

    const aguardando = motoristasAtivos.filter(m => 
        m.statusOp === 'Sem programação' || m.statusOp === 'Disponível'
    ).length;

    const foraJornada = motoristasAtivos.filter(m => 
        m.statusJornada.toLowerCase() === 'fora da jornada'
    ).length;

    const exibirTotal = totalCadastradosProp > 0 ? totalCadastradosProp : totalCadastradosInterno;

    // Função auxiliar para renderizar cada cerca salva
    const RenderCercasSalvas = () => {
        return cercas.map(c => {
            if (c.geofence?.tipo === 'circle' && c.geofence.centro) {
                return (
                    <Circle 
                        key={c.id} 
                        center={[c.geofence.centro.lat, c.geofence.centro.lng]} 
                        radius={c.geofence.raio} 
                        pathOptions={{ color: '#FFD700', fillColor: '#FFD700', fillOpacity: 0.2 }}
                    >
                        <Popup><strong>Cliente:</strong> {c.cliente}</Popup>
                    </Circle>
                );
            }
            if (c.geofence?.coordenadas) {
                const positions = c.geofence.coordenadas.map(coord => [coord.lat, coord.lng]);
                return (
                    <Polygon 
                        key={c.id} 
                        positions={positions} 
                        pathOptions={{ color: '#FFD700', fillColor: '#FFD700', fillOpacity: 0.2 }}
                    >
                        <Popup><strong>Cliente:</strong> {c.cliente}</Popup>
                    </Polygon>
                );
            }
            return null;
        });
    };

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h2 style={styles.titulo}>Dashboard Operacional</h2>
                <span style={{ fontSize: '12px', color: '#666' }}>Monitoramento de Cercas Ativo</span>
            </div>
            
            <div style={styles.grid}>
                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>MOTORISTAS CADASTRADOS</span>
                        <span style={styles.cardValor}>{exibirTotal}</span>
                    </div>
                    <Users size={24} color="#FFD700" style={{ opacity: 0.6 }} />
                </div>

                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>EM OPERAÇÃO</span>
                        <span style={{...styles.cardValor, color: '#2ecc71'}}>{emViagem}</span>
                    </div>
                    <CheckCircle2 size={24} color="#2ecc71" />
                </div>

                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>AGUARDANDO CARGA</span>
                        <span style={{...styles.cardValor, color: '#FFD700'}}>{aguardando}</span>
                    </div>
                    <AlertCircle size={24} color="#FFD700" />
                </div>

                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>FORA DE JORNADA</span>
                        <span style={{...styles.cardValor, color: '#ff4d4d'}}>{foraJornada}</span>
                    </div>
                    <Clock size={24} color="#ff4d4d" />
                </div>
            </div>

            <div style={styles.mapaContainer}>
                <div style={styles.mapaHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#2ecc71', boxShadow: '0 0 8px #2ecc71' }}></div>
                            <small>{motoristasAtivos.length} Veículos</small>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '2px', border: '1px solid #FFD700', backgroundColor: 'rgba(255, 215, 0, 0.2)' }}></div>
                            <small>{cercas.length} Cercas Ativas</small>
                        </div>
                    </div>
                </div>
                
                <MapContainer center={[-21.78, -48.17]} zoom={6} style={{ height: '550px', width: '100%', zIndex: 1 }}>
                    <MapResizer />
                    <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution='&copy; Google Maps' />
                    
                    {/* Renderiza as Geofences dos Clientes */}
                    <RenderCercasSalvas />

                    {/* Agrupamento de Caminhões */}
                    <MarkerClusterGroup spiderfyOnMaxZoom={true} showCoverageOnHover={false} maxClusterRadius={40}>
                        {motoristasAtivos.map((mot) => (
                            <Marker key={mot.id} position={[mot.lat, mot.lng]} icon={caminhaoIcon}>
                                <Popup>
                                    <div style={{ color: '#000', minWidth: '160px', fontFamily: 'sans-serif' }}>
                                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '5px' }}>
                                            {mot.usuario.toUpperCase()}
                                        </div>
                                        <div style={{ fontSize: '12px' }}>
                                            <strong>Status:</strong> {mot.statusOp}<br/>
                                            <strong>Jornada:</strong> {mot.statusJornada}<br/>
                                            <div style={{ marginTop: '5px', fontSize: '10px', color: '#999' }}>Atualizado: {mot.ultimaAtualizacao}</div>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MarkerClusterGroup>
                </MapContainer>
            </div>
        </>
    );
};

export default DashboardGeral;