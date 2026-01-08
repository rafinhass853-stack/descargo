import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Circle } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { 
    Users, AlertCircle, Truck, Search, MapPin, Eye, MessageCircle, Navigation, RefreshCcw, Send, X
} from 'lucide-react';
import L from 'leaflet';
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy, doc, setDoc, serverTimestamp } from "firebase/firestore";

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Ícone Personalizado do Caminhão
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
    const [mapFocus, setMapFocus] = useState({ center: [-21.78, -48.17], zoom: 6 });
    const [filtroGrid, setFiltroGrid] = useState("");
    const [loadingGPS, setLoadingGPS] = useState(null);

    const [modalViagem, setModalViagem] = useState(false);
    const [motSelecionado, setMotSelecionado] = useState(null);
    const [dadosViagem, setDadosViagem] = useState({
        dt: '',
        dataColeta: '',
        clienteColeta: '',
        cidadeColeta: '', // Novo campo automático
        linkColeta: '',
        destinoCidade: '', // Automático pelo cliente entrega
        clienteEntrega: '',
        dataEntrega: '',
        linkEntrega: '',
        observacao: '',
        filial: '1'
    });

    // LÓGICA DE AUTO-DADOS (LINK E CIDADE)
    const aoMudarCliente = (tipo, clienteNome) => {
        const clienteDados = cercas.find(c => c.cliente === clienteNome);
        let linkGerado = '';
        let cidadeCadastrada = clienteDados?.cidade || '';

        if (clienteDados && clienteDados.geofence) {
            let lat, lng;
            if (clienteDados.geofence.tipo === 'circle') {
                lat = clienteDados.geofence.centro.lat;
                lng = clienteDados.geofence.centro.lng;
            } else if (clienteDados.geofence.coordenadas && clienteDados.geofence.coordenadas.length > 0) {
                lat = clienteDados.geofence.coordenadas[0].lat;
                lng = clienteDados.geofence.coordenadas[0].lng;
            }

            if (lat && lng) {
                linkGerado = `https://www.google.com/maps?q=${lat},${lng}`;
            }
        }

        if (tipo === 'COLETA') {
            setDadosViagem(prev => ({ 
                ...prev, 
                clienteColeta: clienteNome, 
                linkColeta: linkGerado,
                cidadeColeta: cidadeCadastrada 
            }));
        } else {
            setDadosViagem(prev => ({ 
                ...prev, 
                clienteEntrega: clienteNome, 
                linkEntrega: linkGerado,
                destinoCidade: cidadeCadastrada 
            }));
        }
    };

    const getStatusVelocidade = (vel) => {
        const v = parseFloat(vel) || 0;
        if (v <= 0) return { label: 'PARADO', color: '#7f8c8d', bg: 'rgba(127, 140, 141, 0.1)' };
        if (v > 0 && v <= 80) return { label: 'MOVIMENTO', color: '#2ecc71', bg: 'rgba(46, 204, 113, 0.1)' };
        return { label: 'ALTA VELÔ', color: '#e74c3c', bg: 'rgba(231, 76, 60, 0.1)' };
    };

    const forcarGPS = async (motoristaId) => {
        setLoadingGPS(motoristaId);
        try {
            await setDoc(doc(db, "comandos_gps", motoristaId), {
                comando: "FORCE_REFRESH",
                timestamp: serverTimestamp()
            }, { merge: true });
            setTimeout(() => setLoadingGPS(null), 2000);
        } catch (e) { setLoadingGPS(null); }
    };

    const salvarViagem = async () => {
        if (!motSelecionado) return;
        if (!dadosViagem.clienteColeta || !dadosViagem.clienteEntrega) {
            alert("Selecione os clientes cadastrados para Coleta e Entrega.");
            return;
        }

        const placas = getPlacasMotorista(motSelecionado.id);
        try {
            const viagemRef = doc(db, "viagens_ativas", motSelecionado.id);
            await setDoc(viagemRef, {
                ...dadosViagem,
                motoristaNome: motSelecionado.nome,
                motoristaCpf: motSelecionado.cpf,
                cavalo: placas.cavalo || '',
                carreta: placas.carreta || '',
                statusOperacional: 'INICIANDO CICLO',
                criadoEm: serverTimestamp()
            });
            alert(`Roteiro enviado com sucesso para ${motSelecionado.nome}!`);
            setModalViagem(false);
        } catch (e) { alert("Erro ao salvar programação."); }
    };

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
        const unsubLoc = onSnapshot(collection(db, "localizacao_realtime"), (snapshot) => {
            const locs = {};
            snapshot.forEach(doc => {
                const d = doc.data();
                locs[doc.id] = {
                    lat: d.latitude ? parseFloat(d.latitude) : null,
                    lng: d.longitude ? parseFloat(d.longitude) : null,
                    velocidade: d.velocidade || 0,
                    ultima: d.ultimaAtualizacao?.toDate ? d.ultimaAtualizacao.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : "---"
                };
            });
            setLocalizacoes(locs);
        });
        return () => { unsubMot(); unsubCercas(); unsubLoc(); unsubVeiculos(); };
    }, []);

    const getPlacasMotorista = (mId) => {
        const v = veiculos.find(v => v.motorista_id === mId);
        const c = carretas.find(c => c.motorista_id === mId);
        return { cavalo: v?.placa, carreta: c?.placa };
    };

    const getGPS = (m) => localizacoes[m.id];

    const focarNoMapa = (lat, lng) => {
        if (!lat || !lng) return;
        setMapFocus({ center: [lat, lng], zoom: 14 });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#000', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h2 style={{ color: '#fff', margin: 0, fontSize: '20px', fontWeight: '800' }}>
                    LOGÍSTICA <span style={{ color: '#FFD700' }}>REAL-TIME</span>
                </h2>
                <div style={styles.searchContainer}>
                    <Search size={16} color="#FFD700" />
                    <input placeholder="Pesquisar motorista..." style={styles.searchInput} onChange={(e) => setFiltroGrid(e.target.value)} />
                </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '25px' }}>
                <div style={styles.cardHeader}>
                    <Users size={20} color="#FFD700" />
                    <div><b style={styles.val}>{motoristasCadastrados.length}</b><br/><small style={styles.label}>MOTORISTAS</small></div>
                </div>
                <div style={styles.cardHeader}>
                    <MapPin size={20} color="#2ecc71" />
                    <div><b style={{...styles.val, color: '#2ecc71'}}>{Object.keys(localizacoes).length}</b><br/><small style={styles.label}>ONLINE</small></div>
                </div>
                <div style={styles.cardHeader}>
                    <Truck size={20} color="#3498db" />
                    <div><b style={styles.val}>{veiculos.length}</b><br/><small style={styles.label}>FROTA</small></div>
                </div>
                <div style={styles.cardHeader}>
                    <AlertCircle size={20} color="#e67e22" />
                    <div><b style={styles.val}>{cercas.length}</b><br/><small style={styles.label}>PONTOS/CLIENTES</small></div>
                </div>
            </div>

            <div style={styles.mapWrapper}>
                <MapContainer center={mapFocus.center} zoom={mapFocus.zoom} style={{ height: '100%', width: '100%' }}>
                    <ChangeView center={mapFocus.center} zoom={mapFocus.zoom} />
                    <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
                    {cercas.map(c => (
                        c.geofence?.tipo === 'circle' ? (
                            <Circle key={c.id} center={[c.geofence.centro.lat, c.geofence.centro.lng]} radius={c.geofence.raio} pathOptions={{ color: c.categoria === 'FILIAL' ? '#3498db' : '#FFD700', weight: 1, fillOpacity: 0.1 }} />
                        ) : (
                            <Polygon key={c.id} positions={c.geofence?.coordenadas?.map(co => [co.lat, co.lng]) || []} pathOptions={{ color: c.categoria === 'FILIAL' ? '#3498db' : '#FFD700', weight: 1, fillOpacity: 0.1 }} />
                        )
                    ))}
                    <MarkerClusterGroup>
                        {motoristasCadastrados.map((m) => {
                            const gps = getGPS(m);
                            if (!gps) return null;
                            const placas = getPlacasMotorista(m.id);
                            return (
                                <Marker key={m.id} position={[gps.lat, gps.lng]} icon={caminhaoIcon}>
                                    <Popup>
                                        <div style={{color: '#000', fontSize: '12px'}}>
                                            <strong>{m.nome.toUpperCase()}</strong><br/>
                                            {placas.cavalo} / {placas.carreta}<br/>
                                            Visto em: {gps.ultima}
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MarkerClusterGroup>
                </MapContainer>
            </div>

            <div style={styles.tableWrapper}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #111' }}>
                            <th style={styles.th}>MOTORISTA</th>
                            <th style={styles.th}>EQUIPAMENTO</th>
                            <th style={styles.th}>GPS STATUS</th>
                            <th style={styles.th}>VELOCIDADE</th>
                            <th style={{...styles.th, textAlign: 'right'}}>AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {motoristasCadastrados
                            .filter(m => m.nome.toUpperCase().includes(filtroGrid.toUpperCase()))
                            .map((m) => {
                                const gps = getGPS(m);
                                const placas = getPlacasMotorista(m.id);
                                const vStatus = gps ? getStatusVelocidade(gps.velocidade) : null;
                                return (
                                    <tr key={m.id} style={styles.tr}>
                                        <td style={styles.td}>
                                            <div style={{ fontWeight: '700', fontSize: '13px', color: '#fff' }}>{m.nome.toUpperCase()}</div>
                                            <div style={{ fontSize: '10px', color: '#555' }}>{m.cpf}</div>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {placas.cavalo && <span style={styles.badgePlaca}>{placas.cavalo}</span>}
                                                {placas.carreta && <span style={{...styles.badgePlaca, color: '#3498db'}}>{placas.carreta}</span>}
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div>
                                                    <div style={{ fontSize: '11px', color: gps ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}>{gps ? 'ONLINE' : 'OFFLINE'}</div>
                                                    <div style={{ fontSize: '9px', color: '#444' }}>{gps?.ultima || '---'}</div>
                                                </div>
                                                <button onClick={() => forcarGPS(m.id)} style={styles.btnForce}><RefreshCcw size={12} className={loadingGPS === m.id ? 'spin' : ''} /></button>
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            {gps ? <span style={{ ...styles.badgeVel, color: vStatus.color, backgroundColor: vStatus.bg }}>{gps.velocidade} km/h</span> : '---'}
                                        </td>
                                        <td style={{...styles.td, textAlign: 'right'}}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button onClick={() => { setMotSelecionado(m); setModalViagem(true); }} style={{...styles.actionBtn, backgroundColor: '#3498db'}} title="Lançar Ciclo"><Navigation size={16} color="#fff" /></button>
                                                <button onClick={() => gps && focarNoMapa(gps.lat, gps.lng)} style={{...styles.actionBtn, backgroundColor: gps ? '#FFD700' : '#111'}} title="Ver no Mapa"><Eye size={16} color="#000" /></button>
                                                <button onClick={() => window.open(`https://wa.me/55${m.telefone?.replace(/\D/g,"")}`)} style={{...styles.actionBtn, backgroundColor: '#2ecc71'}} title="WhatsApp"><MessageCircle size={16} color="#000" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>

            {modalViagem && (
                <div style={styles.overlay}>
                    <div style={styles.modal}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                            <h3 style={{ color: '#FFD700', margin: 0 }}>LANÇAR CICLO: {motSelecionado?.nome.toUpperCase()}</h3>
                            <button onClick={() => setModalViagem(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X /></button>
                        </div>

                        <div style={styles.sectionHeader}>1. DADOS DA CARGA (COLETA)</div>
                        <div style={styles.formGrid}>
                            <div style={styles.inputGroup}>
                                <label style={styles.labelForm}>DT / VIAGEM</label>
                                <input style={styles.input} value={dadosViagem.dt} onChange={e => setDadosViagem({...dadosViagem, dt: e.target.value})} />
                            </div>
                            <div style={styles.inputGroup}>
                                <label style={styles.labelForm}>CLIENTE COLETA (CADASTRADOS)</label>
                                <select style={styles.input} value={dadosViagem.clienteColeta} onChange={e => aoMudarCliente('COLETA', e.target.value)}>
                                    <option value="">Selecione o Cliente...</option>
                                    {cercas.map(c => <option key={c.id} value={c.cliente}>{c.cliente} - {c.cidade}</option>)}
                                </select>
                            </div>
                            <div style={styles.inputGroup}>
                                <label style={styles.labelForm}>CIDADE COLETA (AUTO)</label>
                                <input style={{...styles.input, backgroundColor: '#050505', color: '#FFD700'}} value={dadosViagem.cidadeColeta} readOnly placeholder="Cidade automática..." />
                            </div>
                            <div style={styles.inputGroup}>
                                <label style={styles.labelForm}>DATA/HORA COLETA</label>
                                <input type="datetime-local" style={styles.input} onChange={e => setDadosViagem({...dadosViagem, dataColeta: e.target.value})} />
                            </div>
                            <div style={{...styles.inputGroup, gridColumn: 'span 2'}}>
                                <label style={styles.labelForm}>LINK GOOGLE MAPS COLETA (AUTO)</label>
                                <input style={{...styles.input, color: '#3498db', fontSize: '11px'}} value={dadosViagem.linkColeta} readOnly placeholder="Link automático..." />
                            </div>
                        </div>

                        <div style={{...styles.sectionHeader, marginTop: '20px'}}>2. DESTINO FINAL (ENTREGA)</div>
                        <div style={styles.formGrid}>
                            <div style={styles.inputGroup}>
                                <label style={styles.labelForm}>CLIENTE ENTREGA (CADASTRADOS)</label>
                                <select style={styles.input} value={dadosViagem.clienteEntrega} onChange={e => aoMudarCliente('ENTREGA', e.target.value)}>
                                    <option value="">Selecione o Cliente...</option>
                                    {cercas.map(c => <option key={c.id} value={c.cliente}>{c.cliente} - {c.cidade}</option>)}
                                </select>
                            </div>
                            <div style={styles.inputGroup}>
                                <label style={styles.labelForm}>CIDADE DESTINO (AUTO)</label>
                                <input style={{...styles.input, backgroundColor: '#050505', color: '#FFD700'}} value={dadosViagem.destinoCidade} readOnly placeholder="Cidade automática..." />
                            </div>
                            <div style={styles.inputGroup}>
                                <label style={styles.labelForm}>DATA/HORA ENTREGA</label>
                                <input type="datetime-local" style={styles.input} onChange={e => setDadosViagem({...dadosViagem, dataEntrega: e.target.value})} />
                            </div>
                            <div style={styles.inputGroup}>
                                <label style={styles.labelForm}>LINK GOOGLE MAPS ENTREGA (AUTO)</label>
                                <input style={{...styles.input, color: '#3498db', fontSize: '11px'}} value={dadosViagem.linkEntrega} readOnly placeholder="Link automático..." />
                            </div>
                            <div style={{...styles.inputGroup, gridColumn: 'span 2'}}>
                                <label style={styles.labelForm}>OBSERVAÇÃO (CONSIDERAR ENDEREÇO DA NF)</label>
                                <input style={styles.input} placeholder="Instruções adicionais" onChange={e => setDadosViagem({...dadosViagem, observacao: e.target.value})} />
                            </div>
                        </div>

                        <button onClick={salvarViagem} style={styles.btnSalvar}>
                            <Send size={18} /> ENVIAR ROTEIRO COMPLETO PARA O MOTORISTA
                        </button>
                    </div>
                </div>
            )}
            
            <style>{`.spin { animation: rotation 2s infinite linear; } @keyframes rotation { from { transform: rotate(0deg); } to { transform: rotate(359deg); } }`}</style>
        </div>
    );
};

const styles = {
    searchContainer: { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#0a0a0a', padding: '8px 15px', borderRadius: '12px', border: '1px solid #1a1a1a' },
    searchInput: { background: 'none', border: 'none', color: '#fff', outline: 'none', fontSize: '13px', width: '220px' },
    cardHeader: { backgroundColor: '#0a0a0a', padding: '15px', borderRadius: '12px', border: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: '15px' },
    label: { color: '#444', fontSize: '9px', fontWeight: 'bold' },
    val: { fontSize: '22px', fontWeight: '900', color: '#fff' },
    mapWrapper: { height: '380px', width: '100%', borderRadius: '15px', overflow: 'hidden', border: '1px solid #1a1a1a', marginBottom: '25px' },
    tableWrapper: { backgroundColor: '#0a0a0a', borderRadius: '15px', border: '1px solid #1a1a1a', padding: '10px' },
    th: { padding: '15px', textAlign: 'left', fontSize: '11px', color: '#444', fontWeight: '700' },
    td: { padding: '12px 15px' },
    tr: { borderBottom: '1px solid #111' },
    badgePlaca: { fontSize: '10px', color: '#FFD700', backgroundColor: '#1a1a1a', padding: '3px 7px', borderRadius: '5px', fontWeight: 'bold' },
    badgeVel: { fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '4px' },
    btnForce: { background: '#111', border: '1px solid #222', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#fff' },
    actionBtn: { border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 },
    modal: { backgroundColor: '#0a0a0a', padding: '25px', borderRadius: '20px', border: '1px solid #333', width: '95%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' },
    sectionHeader: { color: '#FFD700', fontSize: '12px', fontWeight: 'bold', borderLeft: '3px solid #FFD700', paddingLeft: '10px', marginBottom: '15px' },
    formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    labelForm: { fontSize: '10px', color: '#666', fontWeight: 'bold' },
    input: { backgroundColor: '#111', border: '1px solid #333', padding: '10px', borderRadius: '8px', color: '#fff', fontSize: '13px' },
    btnSalvar: { width: '100%', marginTop: '25px', padding: '15px', backgroundColor: '#FFD700', border: 'none', borderRadius: '10px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }
};

export default DashboardGeral;