import React, { useState, useEffect, useRef } from 'react';
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { MapContainer, TileLayer, FeatureGroup, LayersControl, useMap, Polygon, Circle, Polyline, Popup } from 'react-leaflet';
import { EditControl } from "react-leaflet-draw";
import { LocateFixed, Save, Trash2, Edit3, Navigation, ExternalLink, Info, Copy, Check } from 'lucide-react';

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
    const [copied, setCopied] = useState(false);
    const featureGroupRef = useRef(); 
    
    const [formData, setFormData] = useState({ 
        cliente: '', 
        tipo: 'Cliente', 
        cidade: '', 
        linkGoogle: '', 
        lat: '',
        lng: '',
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

    const fetchAddress = async (lat, lon) => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await response.json();
            if (data.address) {
                const cidade = data.address.city || data.address.town || data.address.village || data.address.suburb || "";
                const uf = data.address.state_code || (data.address.state ? data.address.state.substring(0,2).toUpperCase() : "");
                setFormData(prev => ({ 
                    ...prev, 
                    cidade: `${cidade.toUpperCase()} / ${uf.toUpperCase()}`,
                    lat: lat.toString(),
                    lng: lon.toString()
                }));
            }
        } catch (error) { 
            console.error(error); 
            // Se não conseguir o endereço, pelo menos salva as coordenadas
            setFormData(prev => ({ 
                ...prev,
                lat: lat.toString(),
                lng: lon.toString()
            }));
        }
    };

    const extractCoordsFromLink = (url) => {
        if (!url) return null;
        
        // Tenta vários padrões de links do Google Maps
        const patterns = [
            /@(-?\d+\.\d+),(-?\d+\.\d+)/,  // Padrão: @-23.123,-46.456
            /q=(-?\d+\.\d+),(-?\d+\.\d+)/,  // Padrão: ?q=-23.123,-46.456
            /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // Padrão: !3d-23.123!4d-46.456
            /maps\/(?:place|search)\/[^@]+@(-?\d+\.\d+),(-?\d+\.\d+)/, // Padrão: maps/place/...@-23.123,-46.456
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                const lat = parseFloat(match[1]);
                const lng = parseFloat(match[2]);
                return { lat, lng };
            }
        }
        
        return null;
    };

    const handleExtractLink = async () => {
        const url = formData.linkGoogle.trim();
        if (!url) return alert("Insira o link do Google Maps.");
        
        const coords = extractCoordsFromLink(url);
        if (coords) {
            setMapCenter([coords.lat, coords.lng]);
            await fetchAddress(coords.lat, coords.lng);
        } else {
            alert("Não foi possível extrair coordenadas deste link. Certifique-se que é um link válido do Google Maps.");
        }
    };

    const copyCoordsToClipboard = () => {
        const coords = `${formData.lat}, ${formData.lng}`;
        navigator.clipboard.writeText(coords).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
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
            lat: item.lat || '',
            lng: item.lng || '',
            obs: item.obs || ''
        });
        setGeofence(item.geofence);
        setMapKey(Date.now());
        
        // Centraliza o mapa nas coordenadas ou no geofence
        if (item.lat && item.lng) {
            setMapCenter([parseFloat(item.lat), parseFloat(item.lng)]);
        } else if (item.geofence?.centro) {
            setMapCenter([item.geofence.centro.lat, item.geofence.centro.lng]);
        } else if (item.geofence?.coordenadas?.[0]) {
            setMapCenter([item.geofence.coordenadas[0].lat, item.geofence.coordenadas[0].lng]);
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!geofence) return alert("Desenhe o polígono ou rota no mapa!");
        if (!formData.lat || !formData.lng) return alert("Extraia as coordenadas do link primeiro!");
        
        setLoading(true);
        try {
            const dados = { 
                ...formData, 
                geofence, 
                lat: formData.lat,
                lng: formData.lng,
                atualizadoEm: serverTimestamp() 
            };
            
            if (editId) {
                await updateDoc(doc(db, "cadastro_clientes_pontos", editId), dados);
            } else {
                await addDoc(collection(db, "cadastro_clientes_pontos"), { 
                    ...dados, 
                    criadoEm: serverTimestamp() 
                });
            }
            
            setEditId(null);
            setFormData({ 
                cliente: '', 
                tipo: 'Cliente', 
                cidade: '', 
                linkGoogle: '', 
                lat: '',
                lng: '',
                obs: '' 
            });
            setGeofence(null);
            setMapKey(Date.now());
            alert("Salvo com sucesso! As coordenadas foram armazenadas para roteirização.");
        } catch (error) { 
            alert(error.message); 
        }
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
                            <input 
                                style={styles.input} 
                                value={formData.linkGoogle} 
                                onChange={(e) => setFormData({...formData, linkGoogle: e.target.value})} 
                                placeholder="Cole o link do Google Maps aqui..." 
                            />
                            <button 
                                onClick={handleExtractLink} 
                                type="button" 
                                style={styles.btnLink}
                                title="Extrair coordenadas do link"
                            >
                                <Navigation size={16} />
                            </button>
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>COORDENADAS (LAT, LNG)</label>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <div style={{ flex: 1, display: 'flex', gap: '5px' }}>
                                <input 
                                    style={{...styles.input, flex: 1}} 
                                    value={formData.lat} 
                                    placeholder="Latitude" 
                                    readOnly 
                                />
                                <input 
                                    style={{...styles.input, flex: 1}} 
                                    value={formData.lng} 
                                    placeholder="Longitude" 
                                    readOnly 
                                />
                            </div>
                            <button 
                                type="button" 
                                onClick={copyCoordsToClipboard}
                                style={{
                                    ...styles.btnLink,
                                    backgroundColor: copied ? '#2ecc71' : '#3498db'
                                }}
                                title="Copiar coordenadas"
                                disabled={!formData.lat || !formData.lng}
                            >
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                        <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                            {formData.lat && formData.lng 
                                ? `Coordenadas extraídas: ${formData.lat}, ${formData.lng}`
                                : 'Clique no botão de extrair para obter as coordenadas'
                            }
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>CIDADE / UF</label>
                        <input 
                            style={{...styles.input, color: '#FFD700'}} 
                            value={formData.cidade} 
                            readOnly 
                        />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>NOME DO LOCAL</label>
                        <input 
                            style={styles.input} 
                            value={formData.cliente} 
                            onChange={e => setFormData({...formData, cliente: e.target.value})} 
                            required 
                        />
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>TIPO</label>
                        <select 
                            style={styles.input} 
                            value={formData.tipo} 
                            onChange={e => setFormData({...formData, tipo: e.target.value})}
                        >
                            <option value="Cliente">🏢 Cliente</option>
                            <option value="Ponto de Apoio">🏠 Ponto de Apoio</option>
                            <option value="Abastecimento">⛽ Abastecimento</option>
                            <option value="Estacionamento">🅿️ Estacionamento</option>
                            <option value="Borracharia">🔧 Borracharia</option>
                            <option value="Restaurante">🍽️ Restaurante</option>
                            <option value="Oficina">🛠️ Oficina</option>
                        </select>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>OBSERVAÇÕES</label>
                        <textarea 
                            style={{...styles.input, height: '60px', resize: 'none'}} 
                            value={formData.obs} 
                            onChange={e => setFormData({...formData, obs: e.target.value})}
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading || !formData.lat || !formData.lng}
                        style={{
                            ...styles.btn, 
                            backgroundColor: (!formData.lat || !formData.lng) ? '#555' : '#FFD700',
                            cursor: (!formData.lat || !formData.lng) ? 'not-allowed' : 'pointer'
                        }}
                        title={(!formData.lat || !formData.lng) ? "Extraia as coordenadas primeiro" : "Salvar cadastro"}
                    >
                        <Save size={18} /> {loading ? 'SALVANDO...' : 'SALVAR CADASTRO'}
                    </button>
                    
                    <div style={styles.listaContainer}>
                        <div style={styles.listaHeader}>
                            CADASTRADOS ({clientesCadastrados.length})
                            <div style={{ fontSize: '9px', color: '#888', fontWeight: 'normal' }}>
                                {clientesCadastrados.filter(c => c.lat && c.lng).length} com coordenadas
                            </div>
                        </div>
                        <div style={styles.listaScroll}>
                            {clientesCadastrados.map((item) => (
                                <div key={item.id} style={styles.itemCliente}>
                                    <div style={{ flex: 1 }}>
                                        <div style={styles.itemLinhaTopo}>
                                            <span style={styles.itemNome}>{item.cliente}</span>
                                            <span style={{
                                                ...styles.badge, 
                                                backgroundColor: TIPO_CORES[item.tipo] + '33', 
                                                color: TIPO_CORES[item.tipo]
                                            }}>
                                                {item.tipo}
                                            </span>
                                        </div>
                                        
                                        <div style={styles.itemCidade}>{item.cidade}</div>
                                        
                                        {item.lat && item.lng && (
                                            <div style={styles.itemCoords}>
                                                📍 {item.lat}, {item.lng}
                                            </div>
                                        )}
                                        
                                        {item.obs && (
                                            <div style={styles.itemObs}>
                                                <Info size={10} style={{minWidth: '10px'}} /> {item.obs}
                                            </div>
                                        )}

                                        {item.linkGoogle && (
                                            <a href={item.linkGoogle} target="_blank" rel="noopener noreferrer" style={styles.linkMaps}>
                                                <ExternalLink size={10} /> Google Maps
                                            </a>
                                        )}
                                    </div>
                                    <div style={styles.itemActions}>
                                        <button 
                                            type="button" 
                                            onClick={() => handleEdit(item)} 
                                            style={styles.btnIconEdit}
                                            title="Editar"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => { 
                                                if(window.confirm("Excluir este cadastro?")) 
                                                    deleteDoc(doc(db, "cadastro_clientes_pontos", item.id)) 
                                            }} 
                                            style={styles.btnIconDelete}
                                            title="Excluir"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={styles.mapWrapper}>
                    <MapContainer 
                        center={mapCenter} 
                        zoom={15} 
                        style={{ height: '100%', width: '100%' }}
                    >
                        <ChangeView center={mapCenter} />
                        <LayersControl position="topright">
                            <BaseLayer checked name="Satélite">
                                <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
                            </BaseLayer>
                            <BaseLayer name="Mapa">
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            </BaseLayer>
                        </LayersControl>
                        
                        {clientesCadastrados.map(cliente => (
                            <RenderGeofence 
                                key={`saved-${cliente.id}`} 
                                data={cliente.geofence} 
                                tipo={cliente.tipo}
                                nomeCliente={cliente.cliente}
                            />
                        ))}

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

const styles = {
    container: { backgroundColor: '#0a0a0a', padding: '20px', minHeight: '100vh', fontFamily: 'sans-serif' },
    header: { marginBottom: '20px' },
    titulo: { color: '#FFD700', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' },
    formGrid: { display: 'grid', gridTemplateColumns: '400px 1fr', gap: '20px' },
    sidebar: { display: 'flex', flexDirection: 'column', gap: '12px', height: '85vh' },
    field: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { color: '#666', fontSize: '10px', fontWeight: 'bold' },
    input: { 
        backgroundColor: '#111', 
        border: '1px solid #333', 
        padding: '10px', 
        borderRadius: '6px', 
        color: '#FFF', 
        width: '100%', 
        boxSizing: 'border-box', 
        fontSize: '13px' 
    },
    btnLink: { 
        backgroundColor: '#3498db', 
        border: 'none', 
        borderRadius: '6px', 
        padding: '0 12px', 
        cursor: 'pointer', 
        color: '#FFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '40px'
    },
    btn: { 
        color: '#000', 
        padding: '14px', 
        borderRadius: '6px', 
        fontWeight: 'bold', 
        cursor: 'pointer', 
        border: 'none', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '8px' 
    },
    mapWrapper: { 
        height: '85vh', 
        borderRadius: '12px', 
        overflow: 'hidden', 
        border: '1px solid #222' 
    },
    
    listaContainer: { 
        marginTop: '10px', 
        borderTop: '1px solid #222', 
        paddingTop: '15px', 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: 0 
    },
    listaHeader: { 
        color: '#555', 
        fontSize: '11px', 
        fontWeight: 'bold', 
        marginBottom: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    listaScroll: { 
        overflowY: 'auto', 
        flex: 1 
    },
    
    itemCliente: { 
        backgroundColor: '#111', 
        padding: '12px', 
        marginBottom: '10px', 
        borderRadius: '8px', 
        border: '1px solid #222', 
        display: 'flex', 
        gap: '10px' 
    },
    itemLinhaTopo: { 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '4px' 
    },
    itemNome: { 
        fontSize: '13px', 
        fontWeight: 'bold', 
        color: '#FFF' 
    },
    badge: { 
        fontSize: '9px', 
        padding: '2px 6px', 
        borderRadius: '4px', 
        fontWeight: 'bold', 
        textTransform: 'uppercase' 
    },
    itemCidade: { 
        fontSize: '11px', 
        color: '#888', 
        marginBottom: '4px' 
    },
    itemCoords: {
        fontSize: '10px',
        color: '#FFD700',
        backgroundColor: '#1a1a1a',
        padding: '4px 8px',
        borderRadius: '4px',
        marginBottom: '6px',
        fontFamily: 'monospace'
    },
    itemObs: { 
        fontSize: '11px', 
        color: '#aaa', 
        backgroundColor: '#1a1a1a', 
        padding: '6px', 
        borderRadius: '4px', 
        marginBottom: '8px', 
        display: 'flex', 
        gap: '5px', 
        fontStyle: 'italic' 
    },
    linkMaps: { 
        color: '#3498db', 
        fontSize: '11px', 
        textDecoration: 'none', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '4px' 
    },
    
    itemActions: { 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '10px' 
    },
    btnIconEdit: { 
        background: 'none', 
        border: 'none', 
        color: '#3498db', 
        cursor: 'pointer', 
        padding: '4px' 
    },
    btnIconDelete: { 
        background: 'none', 
        border: 'none', 
        color: '#e74c3c', 
        cursor: 'pointer', 
        padding: '4px' 
    }
};

export default ClientesPontos;