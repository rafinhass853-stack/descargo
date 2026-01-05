import React, { useState, useEffect, useRef } from 'react';
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { MapContainer, TileLayer, FeatureGroup, LayersControl, useMap, Polygon, Circle, Polyline, Popup } from 'react-leaflet';
import { EditControl } from "react-leaflet-draw";
import { LocateFixed, Save, Trash2, Edit3, Navigation } from 'lucide-react';

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

    if (data.tipo === 'circle' && data.centro) {
        return (
            <Circle 
                center={[data.centro.lat, data.centro.lng]} 
                radius={data.raio} 
                pathOptions={{ color, fillColor: color, fillOpacity: 0.3 }}
            >
                {nomeCliente && <Popup><strong>{nomeCliente}</strong><br/>{tipo}</Popup>}
            </Circle>
        );
    }

    if (data.tipo === 'polyline' && data.coordenadas) {
        return (
            <Polyline 
                positions={data.coordenadas.map(c => [c.lat, c.lng])} 
                pathOptions={{ color: '#FFD700', weight: 5, opacity: 0.8 }}
            >
                {nomeCliente && <Popup><strong>Rota: {nomeCliente}</strong></Popup>}
            </Polyline>
        );
    }

    if ((data.tipo === 'polygon' || data.tipo === 'rectangle') && data.coordenadas) {
        return (
            <Polygon 
                positions={data.coordenadas.map(c => [c.lat, c.lng])} 
                pathOptions={{ color, fillColor: color, fillOpacity: 0.3 }}
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
    const featureGroupRef = useRef(); // Referência para gerenciar o desenho
    
    const [formData, setFormData] = useState({ 
        cliente: '', tipo: 'Cliente', cidade: '', linkGoogle: '', obs: '' 
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

    const fetchAddress = async (lat, lon) => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await response.json();
            if (data.address) {
                const cidade = data.address.city || data.address.town || data.address.village || data.address.suburb || "";
                const uf = data.address.state_code || (data.address.state ? data.address.state.substring(0,2).toUpperCase() : "");
                setFormData(prev => ({ ...prev, cidade: `${cidade.toUpperCase()} / ${uf.toUpperCase()}` }));
            }
        } catch (error) { console.error(error); }
    };

    const handleExtractLink = async () => {
        const url = formData.linkGoogle;
        if (!url) return alert("Insira o link.");
        const regexLong = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const match = url.match(regexLong);
        if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            setMapCenter([lat, lng]);
            await fetchAddress(lat, lng);
        } else {
            alert("Não foi possível extrair coordenadas deste link.");
        }
    };

    const onCreated = (e) => {
        const { layerType, layer } = e;
        let areaData = { tipo: layerType };
        
        if (layerType === 'circle') {
            areaData.centro = { lat: layer.getLatLng().lat, lng: layer.getLatLng().lng };
            areaData.raio = layer.getRadius();
        } else if (layerType === 'polyline') {
            areaData.coordenadas = layer.getLatLngs().map(c => ({ lat: c.lat, lng: c.lng }));
        } else {
            const latlngs = layer.getLatLngs();
            const coords = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
            areaData.coordenadas = coords.map(c => ({ lat: c.lat, lng: c.lng }));
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
        setMapKey(Date.now()); // Reseta o FeatureGroup para modo edição
        if (item.geofence?.centro) setMapCenter([item.geofence.centro.lat, item.geofence.centro.lng]);
        else if (item.geofence?.coordenadas?.[0]) setMapCenter([item.geofence.coordenadas[0].lat, item.geofence.coordenadas[0].lng]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!geofence) return alert("Desenhe o polígono ou rota no mapa!");
        setLoading(true);
        try {
            const dados = { ...formData, geofence, atualizadoEm: serverTimestamp() };
            if (editId) {
                await updateDoc(doc(db, "cadastro_clientes_pontos", editId), dados);
            } else {
                await addDoc(collection(db, "cadastro_clientes_pontos"), { ...dados, criadoEm: serverTimestamp() });
            }
            // Reset Total
            setEditId(null);
            setFormData({ cliente: '', tipo: 'Cliente', cidade: '', linkGoogle: '', obs: '' });
            setGeofence(null);
            setMapKey(Date.now()); // Isso limpa o desenho da tela
            alert("Salvo com sucesso!");
        } catch (error) { alert(error.message); }
        setLoading(false);
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h2 style={styles.titulo}><LocateFixed color="#FFD700" /> Cadastro de Áreas e Clientes</h2>
            </header>
            
            <form onSubmit={handleSubmit} style={styles.formGrid}>
                <div style={styles.sidebar}>
                    <div style={styles.field}>
                        <label style={styles.label}>LINK GOOGLE MAPS</label>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <input style={styles.input} value={formData.linkGoogle} onChange={(e) => setFormData({...formData, linkGoogle: e.target.value})} />
                            <button onClick={handleExtractLink} type="button" style={styles.btnLink}><Navigation size={16} /></button>
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>CIDADE / UF</label>
                        <input style={{...styles.input, color: '#FFD700'}} value={formData.cidade} readOnly />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>NOME DO LOCAL</label>
                        <input style={styles.input} value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})} required />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>TIPO</label>
                        <select style={styles.input} value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                            <option value="Cliente">🏢 Cliente</option>
                            <option value="Ponto de Apoio">🏠 Ponto de Apoio</option>
                            {/* ... outras opções ... */}
                        </select>
                    </div>

                    <button type="submit" disabled={loading} style={{...styles.btn, backgroundColor: '#FFD700'}}>
                        <Save size={18} /> {loading ? 'SALVANDO...' : 'SALVAR CADASTRO'}
                    </button>
                    
                    <div style={styles.listaContainer}>
                        <div style={styles.listaScroll}>
                            {clientesCadastrados.map((item) => (
                                <div key={item.id} style={styles.itemCliente}>
                                    <div style={{ flex: 1 }}>
                                        <div style={styles.itemNome}>{item.cliente}</div>
                                        <div style={styles.itemCidade}>{item.cidade}</div>
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
                            <BaseLayer checked name="Satélite"><TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" /></BaseLayer>
                            <BaseLayer name="Mapa"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></BaseLayer>
                        </LayersControl>
                        
                        {/* Renderiza todos os polígonos já salvos no Firebase */}
                        {clientesCadastrados.map(cliente => (
                            <RenderGeofence 
                                key={`saved-${cliente.id}`} 
                                data={cliente.geofence} 
                                tipo={cliente.tipo}
                                nomeCliente={cliente.cliente}
                            />
                        ))}

                        {/* FeatureGroup com KEY dinâmica para garantir que o desenho apareça/suma corretamente ao salvar */}
                        <FeatureGroup key={mapKey} ref={featureGroupRef}>
                            <EditControl 
                                position="topleft" 
                                onCreated={onCreated} 
                                draw={{ 
                                    polyline: { shapeOptions: { color: '#FFD700' } },
                                    polygon: { shapeOptions: { color: '#2ecc71', fillOpacity: 0.5 } },
                                    rectangle: { shapeOptions: { color: '#2ecc71' } },
                                    circle: { shapeOptions: { color: '#2ecc71' } },
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

// ... estilos permanecem iguais ao anterior ...
const styles = {
    container: { backgroundColor: '#0a0a0a', padding: '20px', minHeight: '100vh', fontFamily: 'sans-serif' },
    header: { marginBottom: '20px' },
    titulo: { color: '#FFD700', fontSize: '18px' },
    formGrid: { display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px' },
    sidebar: { display: 'flex', flexDirection: 'column', gap: '12px' },
    field: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { color: '#666', fontSize: '10px', fontWeight: 'bold' },
    input: { backgroundColor: '#111', border: '1px solid #333', padding: '10px', borderRadius: '6px', color: '#FFF', width: '100%', boxSizing: 'border-box' },
    btnLink: { backgroundColor: '#3498db', border: 'none', borderRadius: '6px', padding: '0 12px', cursor: 'pointer', color: '#FFF' },
    btn: { color: '#000', padding: '14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: 'none' },
    mapWrapper: { height: '85vh', borderRadius: '12px', overflow: 'hidden', border: '1px solid #222' },
    listaContainer: { marginTop: '10px', borderTop: '1px solid #222', paddingTop: '15px' },
    listaScroll: { maxHeight: '300px', overflowY: 'auto' },
    itemCliente: { backgroundColor: '#0d0d0d', padding: '10px', marginBottom: '8px', borderRadius: '6px', display: 'flex' },
    itemNome: { fontSize: '11px', fontWeight: 'bold', color: '#eee' },
    itemCidade: { fontSize: '9px', color: '#888' },
    itemActions: { display: 'flex', gap: '8px' },
    btnIconEdit: { background: 'none', border: 'none', color: '#3498db', cursor: 'pointer' },
    btnIconDelete: { background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }
};

export default ClientesPontos;