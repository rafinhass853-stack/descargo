import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Users, AlertCircle, UserMinus, CheckCircle2 } from 'lucide-react';
import L from 'leaflet';

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

const DashboardGeral = ({ totalMotoristas, motoristasOnline, styles }) => {
    return (
        <>
            <h2 style={styles.titulo}>Dashboard Operacional</h2>
            
            <div style={styles.grid}>
                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>MOTORISTAS CADASTRADOS</span>
                        <span style={styles.cardValor}>{totalMotoristas}</span>
                    </div>
                    <Users size={24} color="#FFD700" opacity={0.5} />
                </div>

                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>MOTORISTAS LOGADOS (APP)</span>
                        <span style={styles.cardValor}>{motoristasOnline.length}</span>
                    </div>
                    <div style={styles.pontoOnline} />
                </div>

                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>PROGRAMADOS</span>
                        <span style={{...styles.cardValor, color: '#444'}}>--</span>
                    </div>
                    <CheckCircle2 size={24} color="#444" />
                </div>

                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>SEM PROGRAMAÇÃO</span>
                        <span style={{...styles.cardValor, color: '#444'}}>--</span>
                    </div>
                    <AlertCircle size={24} color="#444" />
                </div>

                <div style={styles.card}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>SEM VEÍCULO ALOCADO</span>
                        <span style={{...styles.cardValor, color: '#444'}}>--</span>
                    </div>
                    <UserMinus size={24} color="#444" />
                </div>
            </div>

            <div style={styles.mapaContainer}>
                <div style={styles.mapaHeader}>
                    <small>Localização em Tempo Real (Araraquara/Região)</small>
                </div>
                <MapContainer 
                    center={[-21.78, -48.17]} 
                    zoom={8} 
                    style={{ height: '450px', width: '100%', zIndex: 1 }}
                >
                    <MapResizer />
                    <TileLayer 
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                    />
                    {motoristasOnline.map((mot) => (
                        mot.lat && mot.lng && (
                            <Marker key={mot.id} position={[mot.lat, mot.lng]} icon={caminhaoIcon}>
                                <Popup>
                                    <div style={{color: '#000', padding: '5px'}}>
                                        <strong>{mot.usuario || 'Motorista'}</strong><br/>
                                        <span style={{color: '#d35400'}}>Status: Ativo</span>
                                    </div>
                                </Popup>
                            </Marker>
                        )
                    ))}
                </MapContainer>
            </div>
        </>
    );
};

export default DashboardGeral;