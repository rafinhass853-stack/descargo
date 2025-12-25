import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { Users, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import L from 'leaflet';
import { db } from "./firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

// Estilos obrigatórios para o funcionamento do agrupamento (Cluster)
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Ícone personalizado para o caminhão
const caminhaoIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -35],
});

// Componente para garantir que o mapa redimensione corretamente ao abrir
const MapResizer = () => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 100);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

const DashboardGeral = ({ styles, totalCadastradosProp }) => {
    const [motoristasAtivos, setMotoristasAtivos] = useState([]);
    const [totalCadastradosInterno, setTotalCadastradosInterno] = useState(0);

    useEffect(() => {
        // 1. Escuta contagem de motoristas (Coleção 'motoristas')
        // Caso a prop externa falhe, o dashboard mantém sua própria contagem de segurança
        const qMotoristas = query(collection(db, "motoristas"));
        const unsubscribeMotoristas = onSnapshot(qMotoristas, (snapshot) => {
            const validos = snapshot.docs.filter(doc => {
                const d = doc.data();
                return d.email || d.nome;
            });
            setTotalCadastradosInterno(validos.length);
        });

        // 2. Monitoramento de Localização em Tempo Real
        const qLoc = query(collection(db, "localizacao_realtime"));
        const unsubscribeLoc = onSnapshot(qLoc, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                const dados = doc.data();
                if (dados.latitude && dados.longitude) {
                    lista.push({
                        id: doc.id,
                        usuario: dados.email || dados.nome || "Motorista",
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
        };
    }, []);

    // Lógica de Cálculos para os Cards Informativos
    const emViagem = motoristasAtivos.filter(m => 
        m.statusOp.toLowerCase().includes('viagem') || 
        m.statusOp.toLowerCase().includes('carregando')
    ).length;

    const aguardando = motoristasAtivos.filter(m => 
        m.statusOp === 'Sem programação' || 
        m.statusOp === 'Disponível'
    ).length;

    const foraJornada = motoristasAtivos.filter(m => 
        m.statusJornada.toLowerCase() === 'fora da jornada'
    ).length;

    // Prioriza a prop vinda do PainelGestor, se não existir usa a interna
    const exibirTotal = totalCadastradosProp || totalCadastradosInterno;

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h2 style={styles.titulo}>Dashboard Operacional</h2>
                <span style={{ fontSize: '12px', color: '#666' }}>Atualizado em tempo real</span>
            </div>
            
            <div style={styles.grid}>
                {/* Card: Total de Motoristas */}
                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>MOTORISTAS CADASTRADOS</span>
                        <span style={styles.cardValor}>{exibirTotal}</span>
                    </div>
                    <Users size={24} color="#FFD700" style={{ opacity: 0.6 }} />
                </div>

                {/* Card: Em Operação */}
                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>EM OPERAÇÃO</span>
                        <span style={{...styles.cardValor, color: '#2ecc71'}}>{emViagem}</span>
                    </div>
                    <CheckCircle2 size={24} color="#2ecc71" />
                </div>

                {/* Card: Aguardando Carga */}
                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>AGUARDANDO CARGA</span>
                        <span style={{...styles.cardValor, color: '#FFD700'}}>{aguardando}</span>
                    </div>
                    <AlertCircle size={24} color="#FFD700" />
                </div>

                {/* Card: Fora de Jornada */}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '10px', height: '10px', borderRadius: '50%', 
                            backgroundColor: '#2ecc71', boxShadow: '0 0 8px #2ecc71',
                            animation: 'pulse 2s infinite'
                        }}></div>
                        <small>Monitorando {motoristasAtivos.length} veículos agora</small>
                    </div>
                </div>
                
                <MapContainer 
                    center={[-21.78, -48.17]} 
                    zoom={6} 
                    style={{ height: '550px', width: '100%', zIndex: 1 }}
                >
                    <MapResizer />
                    <TileLayer 
                        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                        attribution='&copy; Google Maps'
                    />

                    {/* AGRUPAMENTO AUTOMÁTICO (CLUSTER) */}
                    <MarkerClusterGroup
                        spiderfyOnMaxZoom={true}
                        showCoverageOnHover={false}
                        maxClusterRadius={40}
                    >
                        {motoristasAtivos.map((mot) => (
                            <Marker 
                                key={mot.id} 
                                position={[mot.lat, mot.lng]} 
                                icon={caminhaoIcon}
                            >
                                <Popup>
                                    <div style={{ color: '#000', minWidth: '160px', fontFamily: 'sans-serif' }}>
                                        <div style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', pb: '5px', mb: '5px' }}>
                                            {mot.usuario.toUpperCase()}
                                        </div>
                                        <div style={{ fontSize: '12px' }}>
                                            <strong>Status:</strong> {mot.statusOp}<br/>
                                            <strong>Jornada:</strong> {mot.statusJornada}<br/>
                                            <div style={{ mt: '5px', fontSize: '10px', color: '#999' }}>
                                                Atualizado: {mot.ultimaAtualizacao}
                                            </div>
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