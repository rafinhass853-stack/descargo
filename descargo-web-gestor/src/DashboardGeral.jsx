import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Circle } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { 
    Users, AlertCircle, Truck, Search, MapPin, Eye, MessageCircle, Container, Navigation
} from 'lucide-react';
import L from 'leaflet';
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const caminhaoIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -35],
});

const ChangeView = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (center && center[0] && center[1]) map.flyTo(center, zoom, { duration: 1.5 });
    }, [center, zoom, map]);
    return null;
};

const DashboardGeral = () => {
    const [motoristasCadastrados, setMotoristasCadastrados] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [carretas, setCarretas] = useState([]);
    const [localizacoes, setLocalizacoes] = useState({});
    const [cercas, setCercas] = useState([]);
    const [cargasAtivas, setCargasAtivas] = useState({}); // Novo estado para cargas
    const [mapFocus, setMapFocus] = useState({ center: [-21.78, -48.17], zoom: 6 });
    const [filtroGrid, setFiltroGrid] = useState("");

    useEffect(() => {
        const unsubMot = onSnapshot(query(collection(db, "cadastro_motoristas"), orderBy("nome", "asc")), (snapshot) => {
            const lista = [];
            snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
            setMotoristasCadastrados(lista);
        });

        const unsubCercas = onSnapshot(collection(db, "cadastro_clientes_pontos"), (snapshot) => {
            const lista = [];
            snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
            setCercas(lista);
        });

        const unsubVeiculos = onSnapshot(collection(db, "cadastro_veiculos"), (snapshot) => {
            const lista = [];
            snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
            setVeiculos(lista);
        });

        const unsubCarretas = onSnapshot(collection(db, "carretas"), (snapshot) => {
            const lista = [];
            snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
            setCarretas(lista);
        });

        // Monitorar Cargas Ativas (Status ACEITO)
        const unsubCargas = onSnapshot(query(collection(db, "ordens_servico"), where("status", "==", "ACEITO")), (snapshot) => {
            const mapping = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.motoristaId) {
                    mapping[data.motoristaId] = data;
                }
            });
            setCargasAtivas(mapping);
        });

        const unsubLoc = onSnapshot(collection(db, "localizacao_realtime"), (snapshot) => {
            const locs = {};
            snapshot.forEach(doc => {
                const d = doc.data();
                const docId = doc.id;
                const lat = d.latitude ? parseFloat(d.latitude) : null;
                const lng = d.longitude ? parseFloat(d.longitude) : null;

                if (lat && lng) {
                    const dadosLoc = {
                        lat,
                        lng,
                        statusOp: d.statusOperacional || 'Sem programação',
                        statusJornada: d.statusJornada || 'fora da jornada',
                        email: d.email?.toLowerCase().trim(),
                        ultima: d.ultimaAtualizacao?.toDate ? 
                                d.ultimaAtualizacao.toDate().toLocaleTimeString('pt-BR') : "---"
                    };
                    locs[docId] = dadosLoc;
                    if (d.email) locs[d.email.toLowerCase().trim()] = dadosLoc;
                }
            });
            setLocalizacoes(locs);
        });

        return () => { 
            unsubMot(); unsubCercas(); unsubLoc(); unsubVeiculos(); unsubCarretas(); unsubCargas();
        };
    }, []);

    const getPlacasMotorista = (mId) => {
        if (!mId) return { cavalo: null, carreta: null };
        const v = veiculos.find(v => v.motorista_id === mId);
        const c = carretas.find(c => c.motorista_id === mId);
        return { cavalo: v?.placa, carreta: c?.placa };
    };

    const getGPS = (m) => {
        return localizacoes[m.id] || localizacoes[m.email_app?.toLowerCase().trim()];
    };

    const getCarga = (mId) => {
        return cargasAtivas[mId] || null;
    };

    const focarNoMapa = (lat, lng) => {
        if (!lat || !lng) return;
        setMapFocus({ center: [lat, lng], zoom: 14 });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const motoristasComGPS = motoristasCadastrados.filter(m => getGPS(m));
    const emViagemCount = motoristasComGPS.filter(m => 
        getGPS(m).statusOp.toLowerCase().includes('viagem')
    ).length;

    return (
        <div style={{ padding: '20px', backgroundColor: '#000', minHeight: '100vh', fontFamily: 'Arial' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ color: '#FFD700', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>CONTROLE DE FROTA REAL-TIME</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#111', padding: '5px 15px', borderRadius: '20px', border: '1px solid #222' }}>
                    <Search size={16} color="#444" />
                    <input 
                        placeholder="Buscar motorista..." 
                        style={{ background: 'none', border: 'none', color: '#fff', outline: 'none', fontSize: '13px', width: '200px' }}
                        onChange={(e) => setFiltroGrid(e.target.value)}
                    />
                </div>
            </div>
            
            {/* Cards de Resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
                <div style={styles.card}>
                    <div><small style={styles.label}>CADASTRADOS</small><br/><b style={styles.val}>{motoristasCadastrados.length}</b></div>
                    <Users size={20} color="#FFD700" opacity={0.5}/>
                </div>
                <div style={styles.card}>
                    <div><small style={styles.label}>SINAL GPS ATIVO</small><br/><b style={{...styles.val, color: '#2ecc71'}}>{motoristasComGPS.length}</b></div>
                    <MapPin size={20} color="#2ecc71" opacity={0.5}/>
                </div>
                <div style={styles.card}>
                    <div><small style={styles.label}>EM VIAGEM</small><br/><b style={{...styles.val, color: '#FFD700'}}>{emViagemCount}</b></div>
                    <Truck size={20} color="#FFD700" opacity={0.5}/>
                </div>
                <div style={styles.card}>
                    <div><small style={styles.label}>CERCAS CLIENTES</small><br/><b style={styles.val}>{cercas.length}</b></div>
                    <AlertCircle size={20} color="#fff" opacity={0.5}/>
                </div>
            </div>

            {/* Mapa */}
            <div style={{ height: '450px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333', marginBottom: '20px' }}>
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
                        {motoristasCadastrados.map((m) => {
                            const gps = getGPS(m);
                            if (!gps) return null;
                            const placas = getPlacasMotorista(m.id);
                            const carga = getCarga(m.id);
                            return (
                                <Marker key={m.id} position={[gps.lat, gps.lng]} icon={caminhaoIcon}>
                                    <Popup>
                                        <div style={{color: '#000', fontSize: '12px'}}>
                                            <strong style={{fontSize: '14px'}}>{m.nome.toUpperCase()}</strong><br/>
                                            {placas.cavalo && <span>🚛 {placas.cavalo} / {placas.carreta}</span>}<br/>
                                            <hr/>
                                            <strong>Status:</strong> {gps.statusOp}<br/>
                                            {carga && (
                                                <div style={{marginTop: '5px', color: '#d35400'}}>
                                                    <strong>📍 Destino:</strong> {carga.destinoCidade || carga.cidade_destino}<br/>
                                                    <strong>📦 Carga:</strong> {carga.tipoViagem}
                                                </div>
                                            )}
                                            <small style={{color: '#888'}}>Visto em: {gps.ultima}</small>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MarkerClusterGroup>
                </MapContainer>
            </div>

            {/* Tabela de Monitoramento */}
            <div style={{ backgroundColor: '#0a0a0a', borderRadius: '12px', border: '1px solid #222', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#0f0f0f' }}>
                            <th style={styles.th}>AÇÕES</th>
                            <th style={styles.th}>MOTORISTA / PLACAS</th>
                            <th style={styles.th}>CARGA ATIVA</th>
                            <th style={styles.th}>GPS STATUS</th>
                            <th style={styles.th}>OPERACIONAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {motoristasCadastrados
                            .filter(m => m.nome.toUpperCase().includes(filtroGrid.toUpperCase()))
                            .map((m) => {
                                const gps = getGPS(m);
                                const placas = getPlacasMotorista(m.id);
                                const carga = getCarga(m.id);
                                return (
                                    <tr key={m.id} style={{ borderBottom: '1px solid #111' }}>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <Eye 
                                                    size={18} 
                                                    color={gps ? "#FFD700" : "#222"} 
                                                    style={{ cursor: gps ? 'pointer' : 'not-allowed' }} 
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
                                        <td style={styles.td}>
                                            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{m.nome.toUpperCase()}</div>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                {placas.cavalo && <span style={styles.badgeC}><Truck size={10} /> {placas.cavalo}</span>}
                                                {placas.carreta && <span style={styles.badgeCa}><Container size={10} /> {placas.carreta}</span>}
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            {carga ? (
                                                <div>
                                                    <div style={{ fontSize: '11px', color: '#FFD700', fontWeight: 'bold' }}>
                                                        <Navigation size={10} style={{display: 'inline', marginRight: '4px'}}/>
                                                        {carga.destinoCidade || carga.cidade_destino}
                                                    </div>
                                                    <div style={{ fontSize: '9px', color: '#888' }}>
                                                        {carga.destinoCliente || carga.cliente_destino}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span style={{color: '#333', fontSize: '10px'}}>DISPONÍVEL</span>
                                            )}
                                        </td>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: gps ? '#2ecc71' : '#e74c3c' }} />
                                                <span style={{ fontSize: '11px', color: gps ? '#2ecc71' : '#666' }}>
                                                    {gps ? `ONLINE (${gps.ultima})` : 'SEM SINAL'}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={{ fontSize: '11px', color: gps ? '#fff' : '#444' }}>
                                                {gps ? gps.statusOp.toUpperCase() : '---'}
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

const styles = {
    card: { backgroundColor: '#0a0a0a', padding: '15px', borderRadius: '10px', border: '1px solid #222', display: 'flex', justifyContent: 'space-between' },
    label: { color: '#666', fontSize: '10px' },
    val: { fontSize: '20px', color: '#fff' },
    th: { padding: '12px', textAlign: 'left', fontSize: '10px', color: '#666' },
    td: { padding: '10px 12px' },
    badgeC: { fontSize: '9px', color: '#FFD700', backgroundColor: '#222', padding: '2px 5px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' },
    badgeCa: { fontSize: '9px', color: '#3498db', backgroundColor: '#222', padding: '2px 5px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }
};

export default DashboardGeral;