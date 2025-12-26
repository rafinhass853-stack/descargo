import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Circle } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { 
    Users, AlertCircle, CheckCircle2, Clock, 
    Eye, MessageCircle, Truck, Search, MapPin
} from 'lucide-react';
import L from 'leaflet';
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Ícone do caminhão
const caminhaoIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -35],
});

const ChangeView = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo(center, zoom, { duration: 1.5 });
    }, [center, zoom, map]);
    return null;
};

const DashboardGeral = ({ styles, totalCadastradosProp }) => {
    const [motoristasCadastrados, setMotoristasCadastrados] = useState([]);
    const [localizacoes, setLocalizacoes] = useState({});
    const [cercas, setCercas] = useState([]);
    const [mapFocus, setMapFocus] = useState({ center: [-21.78, -48.17], zoom: 6 });
    const [filtroGrid, setFiltroGrid] = useState("");

    useEffect(() => {
        // 1. PUXA TODOS OS MOTORISTAS CADASTRADOS (PARA O GRID)
        const unsubMot = onSnapshot(query(collection(db, "cadastro_motoristas"), orderBy("nome", "asc")), (snapshot) => {
            const lista = [];
            snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
            setMotoristasCadastrados(lista);
        });

        // 2. PUXA AS CERCAS
        const unsubCercas = onSnapshot(collection(db, "cadastro_clientes_pontos"), (snapshot) => {
            const lista = [];
            snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
            setCercas(lista);
        });

        // 3. PUXA LOCALIZAÇÕES REALTIME (MAPEIA POR EMAIL PARA CRUZAR DADOS)
        const unsubLoc = onSnapshot(collection(db, "localizacao_realtime"), (snapshot) => {
            const locs = {};
            snapshot.forEach(doc => {
                const d = doc.data();
                const chave = d.email?.toLowerCase() || d.nome?.toUpperCase();
                if (chave) {
                    locs[chave] = {
                        lat: parseFloat(d.latitude),
                        lng: parseFloat(d.longitude),
                        statusOp: d.statusOperacional || 'Sem programação',
                        statusJornada: d.statusJornada || 'fora da jornada',
                        ultima: d.ultimaAtualizacao?.toDate ? 
                                d.ultimaAtualizacao.toDate().toLocaleTimeString('pt-BR') : "---"
                    };
                }
            });
            setLocalizacoes(locs);
        });

        return () => { unsubMot(); unsubCercas(); unsubLoc(); };
    }, []);

    const focarNoMapa = (lat, lng) => {
        if (!lat || !lng) return;
        setMapFocus({ center: [lat, lng], zoom: 14 });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Lógica de Contagem para os Cards
    const motoristasOnline = Object.keys(localizacoes).length;
    const emViagem = Object.values(localizacoes).filter(l => l.statusOp.toLowerCase().includes('viagem')).length;

    return (
        <div style={{ padding: '20px', backgroundColor: '#000', minHeight: '100vh' }}>
            {/* CABEÇALHO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ color: '#FFD700', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>CONTROLE DE FROTA REAL-TIME</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111', padding: '5px 15px', borderRadius: '20px', border: '1px solid #222' }}>
                    <Search size={16} color="#444" />
                    <input 
                        placeholder="Buscar no grid..." 
                        style={{ background: 'none', border: 'none', color: '#fff', outline: 'none', fontSize: '13px', width: '200px' }}
                        onChange={(e) => setFiltroGrid(e.target.value)}
                    />
                </div>
            </div>
            
            {/* CARDS DE RESUMO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: '#0a0a0a', padding: '15px', borderRadius: '10px', border: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
                    <div><small style={{color: '#666', fontSize: '10px'}}>CADASTRADOS</small><br/><b style={{fontSize: '20px', color: '#fff'}}>{motoristasCadastrados.length}</b></div>
                    <Users size={20} color="#FFD700" opacity={0.5}/>
                </div>
                <div style={{ backgroundColor: '#0a0a0a', padding: '15px', borderRadius: '10px', border: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
                    <div><small style={{color: '#666', fontSize: '10px'}}>GPS ATIVO</small><br/><b style={{fontSize: '20px', color: '#2ecc71'}}>{motoristasOnline}</b></div>
                    <MapPin size={20} color="#2ecc71" opacity={0.5}/>
                </div>
                <div style={{ backgroundColor: '#0a0a0a', padding: '15px', borderRadius: '10px', border: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
                    <div><small style={{color: '#666', fontSize: '10px'}}>EM VIAGEM</small><br/><b style={{fontSize: '20px', color: '#FFD700'}}>{emViagem}</b></div>
                    <Truck size={20} color="#FFD700" opacity={0.5}/>
                </div>
                <div style={{ backgroundColor: '#0a0a0a', padding: '15px', borderRadius: '10px', border: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
                    <div><small style={{color: '#666', fontSize: '10px'}}>CERCAS ATIVAS</small><br/><b style={{fontSize: '20px', color: '#fff'}}>{cercas.length}</b></div>
                    <AlertCircle size={20} color="#fff" opacity={0.5}/>
                </div>
            </div>

            {/* MAPA */}
            <div style={{ height: '400px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333', marginBottom: '20px' }}>
                <MapContainer center={mapFocus.center} zoom={mapFocus.zoom} style={{ height: '100%', width: '100%' }}>
                    <ChangeView center={mapFocus.center} zoom={mapFocus.zoom} />
                    <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
                    
                    {cercas.map(c => (
                        c.geofence?.tipo === 'circle' ? (
                            <Circle key={c.id} center={[c.geofence.centro.lat, c.geofence.centro.lng]} radius={c.geofence.raio} pathOptions={{ color: '#FFD700', fillOpacity: 0.1 }} />
                        ) : (
                            <Polygon key={c.id} positions={c.geofence?.coordenadas?.map(co => [co.lat, co.lng]) || []} pathOptions={{ color: '#FFD700', fillOpacity: 0.1 }} />
                        )
                    ))}

                    <MarkerClusterGroup>
                        {Object.keys(localizacoes).map((key) => {
                            const loc = localizacoes[key];
                            return (
                                <Marker key={key} position={[loc.lat, loc.lng]} icon={caminhaoIcon}>
                                    <Popup><strong>{key.toUpperCase()}</strong></Popup>
                                </Marker>
                            );
                        })}
                    </MarkerClusterGroup>
                </MapContainer>
            </div>

            {/* GRID ORGANIZADO - TODOS OS CADASTRADOS */}
            <div style={{ backgroundColor: '#0a0a0a', borderRadius: '12px', border: '1px solid #222', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #111', backgroundColor: '#0f0f0f' }}>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '10px', color: '#666' }}>AÇÕES</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '10px', color: '#666' }}>MOTORISTA</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '10px', color: '#666' }}>PLACA/CIDADE</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '10px', color: '#666' }}>GPS STATUS</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '10px', color: '#666' }}>OPERACIONAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {motoristasCadastrados
                            .filter(m => m.nome.toUpperCase().includes(filtroGrid.toUpperCase()))
                            .map((m) => {
                                // Cruza o motorista cadastrado com os dados de localização
                                const gps = localizacoes[m.email_app?.toLowerCase()] || localizacoes[m.nome?.toUpperCase()];
                                
                                return (
                                    <tr key={m.id} style={{ borderBottom: '1px solid #111' }}>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <Eye 
                                                    size={18} 
                                                    color={gps ? "#FFD700" : "#222"} 
                                                    style={{ cursor: gps ? 'pointer' : 'default' }} 
                                                    onClick={() => gps && focarNoMapa(gps.lat, gps.lng)} 
                                                />
                                                <MessageCircle 
                                                    size={18} 
                                                    color="#2ecc71" 
                                                    style={{ cursor: 'pointer' }} 
                                                    onClick={() => window.open(`https://wa.me/55${m.telefone?.replace(/\D/g,"")}`)} 
                                                />
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{m.nome.toUpperCase()}</div>
                                            <div style={{ fontSize: '10px', color: '#666' }}>{m.cpf}</div>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ fontSize: '12px' }}>{m.cnh_cat || '---'}</div>
                                            <div style={{ fontSize: '10px', color: '#444' }}>{m.cidade}</div>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ 
                                                    width: '8px', height: '8px', borderRadius: '50%', 
                                                    backgroundColor: gps ? '#2ecc71' : '#e74c3c',
                                                    boxShadow: gps ? '0 0 5px #2ecc71' : 'none'
                                                }} />
                                                <span style={{ fontSize: '11px', color: gps ? '#2ecc71' : '#666' }}>
                                                    {gps ? `ONLINE (${gps.ultima})` : 'OFFLINE'}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ fontSize: '11px', color: gps ? '#fff' : '#444' }}>
                                                {gps ? gps.statusOp.toUpperCase() : 'SEM SINAL'}
                                            </div>
                                            <div style={{ fontSize: '9px', color: '#FFD700' }}>
                                                {gps ? gps.statusJornada : ''}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DashboardGeral;