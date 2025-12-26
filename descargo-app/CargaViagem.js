import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import { db } from "./firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Navigation, MapPin, Package, AlertTriangle } from 'lucide-react';
import L from 'leaflet';

// Ajuste do ícone padrão do Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const ChangeMapView = ({ center }) => {
    const map = useMap();
    useEffect(() => { if (center) map.setView(center, 15); }, [center]);
    return null;
};

const CargaViagem = ({ motoristaEmail }) => {
    const [viagemAtiva, setViagemAtiva] = useState(null);
    const [cercaDestino, setCercaDestino] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. BUSCA A ORDEM DE SERVIÇO ATIVA DO MOTORISTA
        const q = query(
            collection(db, "ordens_servico"),
            where("motorista_email", "==", motoristaEmail),
            where("status", "==", "EM VIAGEM")
        );

        const unsubViagem = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const dados = snapshot.docs[0].data();
                setViagemAtiva(dados);
                // 2. BUSCA A CERCA BASEADA NO NOME DO CLIENTE DA OS
                buscarCercaNoMapa(dados.cliente_destino);
            } else {
                setViagemAtiva(null);
                setCercaDestino(null);
            }
            setLoading(false);
        });

        return () => unsubViagem();
    }, [motoristaEmail]);

    const buscarCercaNoMapa = (nomeCliente) => {
        if (!nomeCliente) return;

        // Padronizamos para maiúsculo para garantir o cruzamento dos dados
        const nomeBusca = nomeCliente.toUpperCase();
        
        const qCerca = query(
            collection(db, "cadastro_clientes_pontos"),
            where("cliente", "==", nomeBusca)
        );

        onSnapshot(qCerca, (snapshot) => {
            if (!snapshot.empty) {
                setCercaDestino(snapshot.docs[0].data());
            } else {
                setCercaDestino(null);
            }
        });
    };

    if (loading) return <div style={{color: '#fff', padding: '20px'}}>Carregando Viagem...</div>;

    return (
        <div style={{ backgroundColor: '#000', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif' }}>
            
            {/* CABEÇALHO DA VIAGEM */}
            <div style={{ padding: '20px', borderBottom: '1px solid #222' }}>
                <h2 style={{ color: '#FFD700', margin: 0, fontSize: '18px' }}>VIAGEM EM ANDAMENTO</h2>
                {viagemAtiva ? (
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Package size={18} color="#666" />
                        <span>Carga: <strong>{viagemAtiva.produto}</strong></span>
                    </div>
                ) : (
                    <p style={{ color: '#666' }}>Nenhuma carga ativa no momento.</p>
                )}
            </div>

            {/* MAPA COM A CERCA */}
            <div style={{ height: '400px', width: '100%', position: 'relative' }}>
                <MapContainer center={[-21.78, -48.17]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
                    
                    {cercaDestino && cercaDestino.geofence && (
                        <>
                            {cercaDestino.geofence.tipo === 'circle' ? (
                                <Circle 
                                    center={[cercaDestino.geofence.centro.lat, cercaDestino.geofence.centro.lng]}
                                    radius={cercaDestino.geofence.raio}
                                    pathOptions={{ color: '#FFD700', fillColor: '#FFD700', fillOpacity: 0.3 }}
                                />
                            ) : (
                                <Polygon 
                                    positions={cercaDestino.geofence.coordenadas.map(c => [c.lat, c.lng])}
                                    pathOptions={{ color: '#FFD700', fillColor: '#FFD700', fillOpacity: 0.3 }}
                                />
                            )}
                            <ChangeMapView center={
                                cercaDestino.geofence.tipo === 'circle' 
                                ? [cercaDestino.geofence.centro.lat, cercaDestino.geofence.centro.lng]
                                : [cercaDestino.geofence.coordenadas[0].lat, cercaDestino.geofence.coordenadas[0].lng]
                            } />
                        </>
                    )}
                </MapContainer>

                {/* ALERTA DE CERCA NÃO ENCONTRADA */}
                {viagemAtiva && !cercaDestino && (
                    <div style={{
                        position: 'absolute', top: 10, left: 10, right: 10, zIndex: 1000,
                        backgroundColor: 'rgba(231, 76, 60, 0.9)', padding: '10px', borderRadius: '5px',
                        display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px'
                    }}>
                        <AlertTriangle size={16} />
                        <span>Atenção: Cerca de destino não cadastrada para {viagemAtiva.cliente_destino}</span>
                    </div>
                )}
            </div>

            {/* DETALHES DO DESTINO */}
            {viagemAtiva && (
                <div style={{ padding: '20px' }}>
                    <div style={{ backgroundColor: '#111', padding: '15px', borderRadius: '10px', border: '1px solid #222' }}>
                        <div style={{ color: '#666', fontSize: '11px', marginBottom: '5px' }}>DESTINO FINAL</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MapPin size={18} color="#FFD700" />
                            {viagemAtiva.cliente_destino.toUpperCase()}
                        </div>
                        <div style={{ color: '#aaa', fontSize: '13px', marginTop: '5px' }}>
                            {viagemAtiva.cidade_destino}
                        </div>
                    </div>

                    <button 
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${viagemAtiva.cliente_destino}`)}
                        style={{
                            width: '100%', marginTop: '20px', padding: '15px', borderRadius: '10px',
                            backgroundColor: '#FFD700', border: 'none', fontWeight: 'bold',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                        }}
                    >
                        <Navigation size={20} /> INICIAR NAVEGAÇÃO GPS
                    </button>
                </div>
            )}
        </div>
    );
};

export default CargaViagem;