import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { MapContainer, TileLayer, FeatureGroup, LayersControl, useMap, Polygon, Circle, Polyline, Popup } from 'react-leaflet';
import { EditControl } from "react-leaflet-draw";
import { LocateFixed, Save, Search, Trash2, MapPin, Edit3, Link2, Navigation, Tag, Route } from 'lucide-react';

import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

const { BaseLayer } = LayersControl;

const ChangeView = ({ center }) => {
    const map = useMap();
    useEffect(() => { 
        if (center) map.setView(center, 16); 
    }, [center, map]);
    return null;
};

const TIPO_CORES = {
    'Cliente': '#2ecc71',
    'Ponto de Apoio': '#3498db',
    'Abastecimento': '#f1c40f',
    'Estacionamento': '#9b59b6',
    'Borracharia': '#e67e22',
    'Restaurante': '#e74c3c',
    'Oficina': '#95a5a6'
};

const RenderGeofence = ({ data, tipo, nomeCliente = "" }) => {
    if (!data) return null;
    const color = TIPO_CORES[tipo] || '#FFD700';

    // Renderiza Círculo
    if (data.tipo === 'circle' && data.centro) {
        return (
            <Circle 
                center={[data.centro.lat, data.centro.lng]} 
                radius={data.raio} 
                pathOptions={{ color, fillColor: color, fillOpacity: 0.2 }}
            >
                {nomeCliente && <Popup><strong>{nomeCliente}</strong><br/>{tipo}</Popup>}
            </Circle>
        );
    }

    // Renderiza Linha (ROTA PERSONALIZADA)
    if (data.tipo === 'polyline' && data.coordenadas) {
        const positions = data.coordenadas.map(c => [c.lat, c.lng]);
        return (
            <Polyline 
                positions={positions} 
                pathOptions={{ color: '#FFD700', weight: 5, opacity: 0.8 }}
            >
                {nomeCliente && <Popup><strong>Rota: {nomeCliente}</strong></Popup>}
            </Polyline>
        );
    }

    // Renderiza Polígono ou Retângulo
    if ((data.tipo === 'polygon' || data.tipo === 'rectangle') && data.coordenadas) {
        const positions = data.coordenadas.map(c => [c.lat, c.lng]);
        return (
            <Polygon 
                positions={positions} 
                pathOptions={{ color, fillColor: color, fillOpacity: 0.2 }}
            >
                {nomeCliente && <Popup><strong>{nomeCliente}</strong><br/>{tipo}</Popup>}
            </Polygon>
        );
    }
    return null;
};

const ClientesPontos = () => {
    const [loading, setLoading] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({ 
        cliente: '', 
        tipo: 'Cliente', 
        cidade: '', 
        linkGoogle: '',
        obs: '' 
    });
    const [geofence, setGeofence] = useState(null);
    const [mapCenter, setMapCenter] = useState([-23.5505, -46.6333]);
    const [clientesCadastrados, setClientesCadastrados] = useState([]);
    const [mapKey, setMapKey] = useState(Date.now());

    useEffect(() => {
        const q = query(collection(db, "cadastro_clientes_pontos"), orderBy("criadoEm", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() });
            });
            setClientesCadastrados(lista);
        });
        return () => unsubscribe();
    }, []);

    const handleExtractLink = async () => {
        const url = formData.linkGoogle;
        if (!url) return alert("Insira um link do Google Maps primeiro.");
        try {
            const regexLong = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
            const matchLong = url.match(regexLong);
            if (matchLong) {
                setMapCenter([parseFloat(matchLong[1]), parseFloat(matchLong[2])]);
            } else {
                alert("Não foi possível extrair coordenadas automáticas. Use a busca manual.");
            }
        } catch (error) { console.error(error); }
    };

    const onCreated = (e) => {
        const { layerType, layer } = e;
        let areaData = { tipo: layerType };
        
        if (layerType === 'circle') {
            areaData.centro = { lat: layer.getLatLng().lat, lng: layer.getLatLng().lng };
            areaData.raio = layer.getRadius();
        } else if (layerType === 'polyline') {
            // Captura os pontos da linha (ROTA)
            areaData.coordenadas = layer.getLatLngs().map(c => ({ lat: c.lat, lng: c.lng }));
        } else {
            // Polígonos e Retângulos
            const latlngs = layer.getLatLngs();
            areaData.coordenadas = (Array.isArray(latlngs[0]) ? latlngs[0] : latlngs).map(c => ({ lat: c.lat, lng: c.lng }));
        }
        setGeofence(areaData);
    };

    const handleEdit = (item) => {
        setEditId(item.id);
        setFormData({
            cliente: item.cliente,
            tipo: item.tipo || 'Cliente',
            cidade: item.cidade || '',
            linkGoogle: item.linkGoogle || '',
            obs: item.obs || ''
        });
        setGeofence(item.geofence);
        if (item.geofence?.centro) setMapCenter([item.geofence.centro.lat, item.geofence.centro.lng]);
        else if (item.geofence?.coordenadas?.[0]) setMapCenter([item.geofence.coordenadas[0].lat, item.geofence.coordenadas[0].lng]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!geofence) return alert("Desenhe a rota ou cerca no mapa!");
        setLoading(true);
        try {
            const dados = { ...formData, geofence, atualizadoEm: serverTimestamp() };
            if (editId) {
                await updateDoc(doc(db, "cadastro_clientes_pontos", editId), dados);
            } else {
                const novoCodigo = `PT-${Math.floor(1000 + Math.random() * 9000)}`;
                await addDoc(collection(db, "cadastro_clientes_pontos"), { ...dados, codigo: novoCodigo, criadoEm: serverTimestamp() });
            }
            setEditId(null);
            setFormData({ cliente: '', tipo: 'Cliente', cidade: '', linkGoogle: '', obs: '' });
            setGeofence(null);
            setMapKey(Date.now());
            alert("Ponto e Rota salvos com sucesso!");
        } catch (error) { alert(error.message); }
        setLoading(false);
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h2 style={styles.titulo}><LocateFixed color="#FFD700" /> {editId ? 'Editando Ponto/Rota' : 'Cadastro de Pontos e Rotas'}</h2>
                {editId && <button onClick={() => { setEditId(null); setGeofence(null); setMapKey(Date.now()); setFormData({ cliente: '', tipo: 'Cliente', cidade: '', linkGoogle: '', obs: '' }); }} style={styles.btnCancelar}>CANCELAR EDIÇÃO</button>}
            </header>
            
            <form onSubmit={handleSubmit} style={styles.formGrid}>
                <div style={styles.sidebar}>
                    <div style={styles.field}>
                        <label style={styles.label}>TIPO DE PONTO</label>
                        <select 
                            style={styles.input} 
                            value={formData.tipo} 
                            onChange={e => setFormData({...formData, tipo: e.target.value})}
                        >
                            <option value="Cliente">🏢 Cliente (Destino)</option>
                            <option value="Ponto de Apoio">🏠 Ponto de Apoio</option>
                            <option value="Abastecimento">⛽ Posto de Combustível</option>
                            <option value="Estacionamento">🅿️ Estacionamento</option>
                            <option value="Borracharia">🛠️ Borracharia</option>
                            <option value="Restaurante">🍽️ Restaurante / Parada</option>
                            <option value="Oficina">⚙️ Oficina</option>
                        </select>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>NOME DO LOCAL (IGUAL À CARGA)</label>
                        <input style={styles.input} value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})} required />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>CIDADE / UF</label>
                        <input style={styles.input} placeholder="Ex: SÃO PAULO / SP" value={formData.cidade} onChange={e => setFormData({...formData, cidade: e.target.value.toUpperCase()})} required />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>LINK GOOGLE MAPS</label>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <input style={styles.input} placeholder="Cole o link..." value={formData.linkGoogle} onChange={(e) => setFormData({...formData, linkGoogle: e.target.value})} />
                            <button onClick={handleExtractLink} type="button" style={styles.btnLink}><Navigation size={16} /></button>
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>OBSERVAÇÕES</label>
                        <textarea style={{...styles.input, height: '60px'}} value={formData.obs} onChange={e => setFormData({...formData, obs: e.target.value})} />
                    </div>

                    <button type="submit" disabled={loading} style={{...styles.btn, backgroundColor: editId ? '#2ecc71' : '#FFD700'}}>
                        <Save size={18} /> {loading ? 'SALVANDO...' : 'SALVAR PONTO E ROTA'}
                    </button>
                    
                    <div style={styles.listaContainer}>
                        <h3 style={styles.listaTitulo}>PONTOS SALVOS ({clientesCadastrados.length})</h3>
                        <div style={styles.listaScroll}>
                            {clientesCadastrados.map((item) => (
                                <div key={item.id} style={{...styles.itemCliente, borderLeft: `4px solid ${TIPO_CORES[item.tipo]}`}}>
                                    <div style={{ flex: 1 }}>
                                        <div style={styles.itemNome}>{item.cliente}</div>
                                        <div style={styles.itemCidade}>{item.tipo} • {item.cidade}</div>
                                    </div>
                                    <div style={styles.itemActions}>
                                        <button type="button" onClick={() => handleEdit(item)} style={styles.btnIconEdit}><Edit3 size={14} /></button>
                                        <button type="button" onClick={() => { if(window.confirm("Excluir?")) deleteDoc(doc(db, "cadastro_clientes_pontos", item.id)) }} style={styles.btnIconDelete}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={styles.mapWrapper}>
                    <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
                        <ChangeView center={mapCenter} />
                        <LayersControl position="topright">
                            <BaseLayer checked name="Híbrido"><TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" /></BaseLayer>
                            <BaseLayer name="Padrão"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></BaseLayer>
                        </LayersControl>
                        
                        {clientesCadastrados.map(cliente => (
                            <RenderGeofence 
                                key={`saved-${cliente.id}`} 
                                data={cliente.geofence} 
                                tipo={cliente.tipo}
                                nomeCliente={cliente.cliente}
                            />
                        ))}

                        <FeatureGroup key={mapKey}>
                            <EditControl 
                                position="topleft" 
                                onCreated={onCreated} 
                                draw={{ 
                                    polyline: { shapeOptions: { color: '#FFD700', weight: 4 } }, // PARA DESENHAR O TRAJETO
                                    polygon: { shapeOptions: { color: '#00BFFF' } }, // PARA ÁREA DE CHEGADA
                                    rectangle: { shapeOptions: { color: '#00BFFF' } },
                                    circle: { shapeOptions: { color: '#00BFFF' } },
                                    marker: false, 
                                    circlemarker: false
                                }} 
                            />
                        </FeatureGroup>
                    </MapContainer>
                </div>
            </form>
        </div>
    );
};

const styles = {
    container: { backgroundColor: '#0a0a0a', padding: '20px', borderRadius: '12px', border: '1px solid #222', minHeight: '100vh', fontFamily: 'sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    titulo: { color: '#FFD700', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px' },
    btnCancelar: { backgroundColor: '#331111', color: '#ff4444', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
    formGrid: { display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px' },
    sidebar: { display: 'flex', flexDirection: 'column', gap: '12px' },
    field: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { color: '#555', fontSize: '9px', fontWeight: 'bold' },
    input: { backgroundColor: '#111', border: '1px solid #222', padding: '10px', borderRadius: '6px', color: '#FFF', outline: 'none', width: '100%', boxSizing: 'border-box' },
    btnLink: { backgroundColor: '#3498db', border: 'none', borderRadius: '6px', padding: '0 12px', cursor: 'pointer', color: '#FFF' },
    btn: { color: '#000', padding: '14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    mapWrapper: { height: '85vh', borderRadius: '12px', overflow: 'hidden', border: '1px solid #222' },
    listaContainer: { marginTop: '10px', borderTop: '1px solid #222', paddingTop: '15px' },
    listaTitulo: { color: '#444', fontSize: '10px', fontWeight: 'bold', marginBottom: '10px' },
    listaScroll: { maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' },
    itemCliente: { backgroundColor: '#0d0d0d', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    itemNome: { fontSize: '11px', fontWeight: 'bold', color: '#eee' },
    itemCidade: { fontSize: '9px', color: '#888' },
    itemActions: { display: 'flex', gap: '8px' },
    btnIconEdit: { background: 'none', border: 'none', color: '#3498db', cursor: 'pointer' },
    btnIconDelete: { background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }
};

export default ClientesPontos;