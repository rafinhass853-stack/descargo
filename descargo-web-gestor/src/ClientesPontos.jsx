import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { MapContainer, TileLayer, FeatureGroup, LayersControl, useMap } from 'react-leaflet';
import { EditControl } from "react-leaflet-draw";
import { LocateFixed, Save, Search, Trash2, MapPin, Edit3, XCircle } from 'lucide-react';
import AsyncSelect from 'react-select/async'; // Importação do seletor inteligente

import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

const { BaseLayer } = LayersControl;

const ChangeView = ({ center }) => {
    const map = useMap();
    useEffect(() => { map.setView(center, 16); }, [center, map]);
    return null;
};

const ClientesPontos = () => {
    const [loading, setLoading] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({ cliente: '', cnpj: '', cidade: '', linkGoogle: '' });
    const [geofence, setGeofence] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [mapCenter, setMapCenter] = useState([-23.5505, -46.6333]);
    const [clientesCadastrados, setClientesCadastrados] = useState([]);

    useEffect(() => {
        const q = query(collection(db, "cadastro_clientes_pontos"), orderBy("criadoEm", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
            setClientesCadastrados(lista);
        });
        return () => unsubscribe();
    }, []);

    // FUNÇÃO QUE BUSCA CIDADES NO IBGE (AUTOCOMPLETE)
    const promiseOptions = async (inputValue) => {
        if (inputValue.length < 3) return [];
        try {
            const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${inputValue}`);
            const data = await response.json();
            return data.slice(0, 10).map(m => ({
                label: `${m.nome.toUpperCase()} - ${m.microrregiao.mesorregiao.UF.sigla}`,
                value: `${m.nome.toUpperCase()} / ${m.microrregiao.mesorregiao.UF.sigla}`
            }));
        } catch (e) { return []; }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery) return;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            const data = await response.json();
            if (data.length > 0) {
                setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
            } else { alert("Endereço não encontrado."); }
        } catch (error) { console.error("Erro na busca:", error); }
    };

    const onCreated = (e) => {
        const { layerType, layer } = e;
        let areaData = { tipo: layerType };
        if (layerType === 'circle') {
            areaData.centro = { lat: layer.getLatLng().lat, lng: layer.getLatLng().lng };
            areaData.raio = layer.getRadius();
        } else {
            const rawCoords = layer.getLatLngs()[0];
            areaData.coordenadas = rawCoords.map(c => ({ lat: c.lat, lng: c.lng }));
        }
        setGeofence(areaData);
    };

    const handleEdit = (item) => {
        setEditId(item.id);
        setFormData({
            cliente: item.cliente,
            cnpj: item.cnpj || '',
            cidade: item.cidade || '',
            linkGoogle: item.linkGoogle || ''
        });
        setGeofence(item.geofence);
        if (item.geofence?.centro) setMapCenter([item.geofence.centro.lat, item.geofence.centro.lng]);
        else if (item.geofence?.coordenadas) setMapCenter([item.geofence.coordenadas[0].lat, item.geofence.coordenadas[0].lng]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!geofence) return alert("Desenhe a cerca no mapa!");
        if (!formData.cidade) return alert("Selecione a cidade!");

        setLoading(true);
        try {
            const dados = { ...formData, geofence, atualizadoEm: serverTimestamp() };
            if (editId) await updateDoc(doc(db, "cadastro_clientes_pontos", editId), dados);
            else {
                const novoCodigo = `CLI-${Math.floor(1000 + Math.random() * 9000)}`;
                await addDoc(collection(db, "cadastro_clientes_pontos"), { ...dados, codigo: novoCodigo, criadoEm: serverTimestamp() });
            }
            setEditId(null);
            setFormData({ cliente: '', cnpj: '', cidade: '', linkGoogle: '' });
            setGeofence(null);
            alert("Sucesso!");
        } catch (error) { alert(error.message); }
        setLoading(false);
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h2 style={styles.titulo}><LocateFixed color="#FFD700" /> {editId ? 'Editando Ponto' : 'Cadastro de Clientes'}</h2>
                {editId && <button onClick={() => setEditId(null)} style={styles.btnCancelar}>CANCELAR</button>}
            </header>
            
            <form onSubmit={handleSubmit} style={styles.formGrid}>
                <div style={styles.sidebar}>
                    <div style={styles.field}>
                        <label style={styles.label}>1. BUSCAR LOCAL NO MAPA</label>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <input style={styles.inputSearch} placeholder="Rua, Número..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            <button onClick={handleSearch} type="button" style={styles.btnSearch}><Search size={16} /></button>
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>2. NOME DO CLIENTE</label>
                        <input style={styles.input} value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})} required />
                    </div>

                    {/* CAMPO CIDADE COM AUTOCOMPLETE DO GOOGLE/IBGE STYLE */}
                    <div style={styles.field}>
                        <label style={styles.label}>3. CIDADE / UF (DIGITE PARA BUSCAR)</label>
                        <AsyncSelect
                            cacheOptions
                            defaultOptions
                            loadOptions={promiseOptions}
                            onChange={(opt) => setFormData({...formData, cidade: opt.value})}
                            placeholder="Digite o nome da cidade..."
                            loadingMessage={() => "Buscando..."}
                            noOptionsMessage={() => "Nenhuma cidade encontrada"}
                            styles={customSelectStyles}
                            value={formData.cidade ? { label: formData.cidade, value: formData.cidade } : null}
                        />
                    </div>
                    
                    <div style={styles.field}>
                        <label style={styles.label}>4. CNPJ</label>
                        <input style={styles.input} value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
                    </div>

                    <button type="submit" disabled={loading} style={{...styles.btn, backgroundColor: editId ? '#2ecc71' : '#FFD700'}}>
                        <Save size={18} /> {loading ? 'SALVANDO...' : 'SALVAR PONTO'}
                    </button>
                    
                    <div style={styles.listaContainer}>
                        <h3 style={styles.listaTitulo}>PONTOS SALVOS</h3>
                        <div style={styles.listaScroll}>
                            {clientesCadastrados.map((item) => (
                                <div key={item.id} style={styles.itemCliente}>
                                    <div style={{ flex: 1 }}>
                                        <div style={styles.itemNome}>{item.cliente}</div>
                                        <div style={styles.itemCidade}><MapPin size={10}/> {item.cidade}</div>
                                    </div>
                                    <div style={styles.itemActions}>
                                        <button type="button" onClick={() => handleEdit(item)} style={styles.btnIconEdit}><Edit3 size={14} /></button>
                                        <button type="button" onClick={() => deleteDoc(doc(db, "cadastro_clientes_pontos", item.id))} style={styles.btnIconDelete}><Trash2 size={14} /></button>
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
                        </LayersControl>
                        <FeatureGroup>
                            <EditControl position="topleft" onCreated={onCreated} draw={{ polyline: false, marker: false, circlemarker: false }} />
                        </FeatureGroup>
                    </MapContainer>
                </div>
            </form>
        </div>
    );
};

// ESTILIZAÇÃO DO SELECT PARA FICAR IGUAL AO SEU DESIGN DARK
const customSelectStyles = {
    control: (base) => ({
        ...base,
        backgroundColor: '#111',
        borderColor: '#FFD700',
        color: '#FFF',
        minHeight: '45px',
    }),
    menu: (base) => ({ ...base, backgroundColor: '#111', zIndex: 9999 }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#FFD700' : '#111',
        color: state.isFocused ? '#000' : '#FFF',
        fontSize: '12px'
    }),
    singleValue: (base) => ({ ...base, color: '#FFF', fontSize: '13px' }),
    input: (base) => ({ ...base, color: '#FFF' }),
};

const styles = {
    container: { backgroundColor: '#0a0a0a', padding: '20px', borderRadius: '12px', border: '1px solid #222', minHeight: '100vh', fontFamily: 'sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    titulo: { color: '#FFD700', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px' },
    btnCancelar: { backgroundColor: '#331111', color: '#ff4444', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' },
    formGrid: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' },
    sidebar: { display: 'flex', flexDirection: 'column', gap: '12px' },
    field: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { color: '#555', fontSize: '9px', fontWeight: 'bold' },
    input: { backgroundColor: '#111', border: '1px solid #222', padding: '10px', borderRadius: '6px', color: '#FFF', outline: 'none' },
    inputSearch: { flex: 1, backgroundColor: '#000', border: '1px solid #444', padding: '10px', borderRadius: '6px', color: '#FFF' },
    btnSearch: { backgroundColor: '#FFD700', border: 'none', borderRadius: '6px', padding: '0 12px', cursor: 'pointer' },
    btn: { color: '#000', padding: '14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
    statusOk: { color: '#2ecc71', fontSize: '11px', textAlign: 'center', fontWeight: 'bold' },
    mapWrapper: { height: '750px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #222' },
    listaContainer: { marginTop: '10px', borderTop: '1px solid #222', paddingTop: '15px' },
    listaTitulo: { color: '#444', fontSize: '10px', fontWeight: 'bold', marginBottom: '10px' },
    listaScroll: { maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' },
    itemCliente: { backgroundColor: '#0d0d0d', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1a1a1a' },
    itemNome: { fontSize: '11px', fontWeight: 'bold', color: '#eee' },
    itemCidade: { fontSize: '10px', color: '#FFD700', display: 'flex', alignItems: 'center', gap: '3px' },
    itemActions: { display: 'flex', gap: '8px' },
    btnIconEdit: { background: '#111', border: 'none', color: '#3498db', cursor: 'pointer', padding: '5px' },
    btnIconDelete: { background: '#111', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '5px' }
};

export default ClientesPontos;