import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Users, AlertCircle, UserMinus, CheckCircle2, Clock } from 'lucide-react';
import L from 'leaflet';
import { db } from "./firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

// Ícone personalizado para o caminhão
const caminhaoIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -35],
});

// Componente auxiliar para corrigir o bug de carregamento do mapa
const MapResizer = () => {
    const map = useMap();
    useEffect(() => {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [map]);
    return null;
};

const DashboardGeral = ({ styles }) => {
    const [motoristasAtivos, setMotoristasAtivos] = useState([]);
    const [totalCadastrados, setTotalCadastrados] = useState(0);

    useEffect(() => {
        // Escuta a coleção de localização enviada pelo APP do motorista
        const q = query(collection(db, "localizacao_realtime"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const listaMotoristas = [];
            snapshot.forEach((doc) => {
                const dados = doc.data();
                // Só adiciona se houver coordenadas válidas
                if (dados.latitude && dados.longitude) {
                    listaMotoristas.push({
                        id: doc.id,
                        usuario: dados.email || dados.motoristaId,
                        lat: dados.latitude,
                        lng: dados.longitude,
                        statusOp: dados.statusOperacional || 'Não informado',
                        statusJornada: dados.statusJornada || 'fora da jornada',
                        ultimaAtualizacao: dados.ultimaAtualizacao?.toDate().toLocaleTimeString() || '--:--'
                    });
                }
            });
            setMotoristasAtivos(listaMotoristas);
        });

        return () => unsubscribe();
    }, []);

    // Cálculos de contadores baseados no status que vem do App
    const emViagem = motoristasAtivos.filter(m => m.statusOp.includes('Viagem')).length;
    const semProgramacao = motoristasAtivos.filter(m => m.statusOp === 'Sem programação').length;
    const foraJornada = motoristasAtivos.filter(m => m.statusJornada === 'fora da jornada').length;

    return (
        <>
            <h2 style={styles.titulo}>Dashboard Operacional</h2>
            
            <div style={styles.grid}>
                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>TOTAL NO MAPA</span>
                        <span style={styles.cardValor}>{motoristasAtivos.length}</span>
                    </div>
                    <Users size={24} color="#FFD700" opacity={0.5} />
                </div>

                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>EM OPERAÇÃO (VIAGEM)</span>
                        <span style={{...styles.cardValor, color: '#2ecc71'}}>{emViagem}</span>
                    </div>
                    <CheckCircle2 size={24} color="#2ecc71" />
                </div>

                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>AGUARDANDO CARGA</span>
                        <span style={{...styles.cardValor, color: '#FFD700'}}>{semProgramacao}</span>
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
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <div style={{width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#2ecc71', boxShadow: '0 0 5px #2ecc71'}}></div>
                        <small>Monitoramento em Tempo Real (Via App Motorista)</small>
                    </div>
                </div>
                <MapContainer 
                    center={[-21.78, -48.17]} 
                    zoom={8} 
                    style={{ height: '500px', width: '100%', borderRadius: '0 0 8px 8px', zIndex: 1 }}
                >
                    <MapResizer />
                    <TileLayer 
                        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                        attribution='&copy; Google Maps'
                    />
                    
                    {motoristasAtivos.map((mot) => (
                        <Marker key={mot.id} position={[mot.lat, mot.lng]} icon={caminhaoIcon}>
                            <Popup>
                                <div style={{color: '#000', padding: '5px', minWidth: '150px'}}>
                                    <strong style={{fontSize: '14px'}}>{mot.usuario.split('@')[0].toUpperCase()}</strong>
                                    <hr style={{margin: '5px 0', borderColor: '#eee'}}/>
                                    <div style={{fontSize: '11px', marginBottom: '3px'}}>
                                        <strong>Status:</strong> <span style={{color: '#d35400'}}>{mot.statusOp}</span>
                                    </div>
                                    <div style={{fontSize: '11px', marginBottom: '3px'}}>
                                        <strong>Jornada:</strong> {mot.statusJornada}
                                    </div>
                                    <div style={{fontSize: '10px', color: '#888', marginTop: '5px'}}>
                                        Atualizado às: {mot.ultimaAtualizacao}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </>
    );
};

export default DashboardGeral;