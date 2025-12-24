import React, { useState } from 'react';
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { MapContainer, TileLayer, FeatureGroup, LayersControl, useMap } from 'react-leaflet';
import { EditControl } from "react-leaflet-draw";
import { LocateFixed, Save, Building2, Hash, Link, Search } from 'lucide-react';

// CSS necessário para o Leaflet funcionar corretamente
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

const { BaseLayer } = LayersControl;

// Componente para mover a câmera do mapa após a busca
const ChangeView = ({ center }) => {
    const map = useMap();
    map.setView(center, 16);
    return null;
};

const ClientesPontos = () => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ cliente: '', cnpj: '', linkGoogle: '' });
    const [geofence, setGeofence] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [mapCenter, setMapCenter] = useState([-23.5505, -46.6333]);

    // FUNÇÃO PARA BUSCAR ENDEREÇO
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery) return;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            const data = await response.json();
            if (data.length > 0) {
                setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
            } else {
                alert("Endereço não encontrado.");
            }
        } catch (error) {
            console.error("Erro na busca:", error);
        }
    };

    // LIMPEZA DE DADOS PARA O FIREBASE (Evita erro de salvamento)
    const onCreated = (e) => {
        const { layerType, layer } = e;
        let areaData = { tipo: layerType };

        if (layerType === 'circle') {
            areaData.centro = { lat: layer.getLatLng().lat, lng: layer.getLatLng().lng };
            areaData.raio = layer.getRadius();
        } else {
            // Converte as coordenadas do Leaflet em objetos simples que o Firebase aceita
            const rawCoords = layer.getLatLngs()[0];
            areaData.coordenadas = rawCoords.map(c => ({ lat: c.lat, lng: c.lng }));
        }
        setGeofence(areaData);
    };

    // SALVAMENTO NO FIREBASE
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!geofence) return alert("Por favor, desenhe a cerca no mapa antes de salvar!");

        setLoading(true);
        try {
            const novoCodigo = `CLI-${Math.floor(1000 + Math.random() * 9000)}`;
            
            await addDoc(collection(db, "cadastro_clientes_pontos"), {
                cliente: formData.cliente,
                cnpj: formData.cnpj,
                linkGoogle: formData.linkGoogle,
                codigo: novoCodigo,
                geofence: geofence, // Dados limpos aqui
                criadoEm: serverTimestamp()
            });
            
            alert(`Sucesso! Ponto ${novoCodigo} cadastrado.`);
            setFormData({ cliente: '', cnpj: '', linkGoogle: '' });
            setGeofence(null);
            setSearchQuery("");
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro crítico ao salvar: " + error.message);
        }
        setLoading(false);
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.titulo}>
                <LocateFixed color="#FFD700" /> Cadastro de Clientes e Pontos
            </h2>
            
            <form onSubmit={handleSubmit} style={styles.formGrid}>
                <div style={styles.sidebar}>
                    {/* CAMPO DE BUSCA NO MAPA */}
                    <div style={styles.field}>
                        <label style={styles.label}>LOCALIZAR ENDEREÇO</label>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <input 
                                style={styles.inputSearch} 
                                placeholder="Rua, Cidade..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <button onClick={handleSearch} type="button" style={styles.btnSearch}>
                                <Search size={16} />
                            </button>
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>NOME DO CLIENTE</label>
                        <input style={styles.input} value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})} required />
                    </div>
                    
                    <div style={styles.field}>
                        <label style={styles.label}>CNPJ</label>
                        <input style={styles.input} value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
                    </div>

                    <button type="submit" disabled={loading} style={styles.btn}>
                        <Save size={18} /> {loading ? 'PROCESSANDO...' : 'SALVAR PONTO'}
                    </button>
                    
                    {geofence && <p style={styles.statusOk}>✓ Cerca pronta para salvar</p>}
                </div>

                <div style={styles.mapWrapper}>
                    <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
                        <ChangeView center={mapCenter} />
                        <LayersControl position="topright">
                            <BaseLayer checked name="Visão Híbrida">
                                <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
                            </BaseLayer>
                            <BaseLayer name="Satélite Puro">
                                <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" />
                            </BaseLayer>
                        </LayersControl>

                        <FeatureGroup>
                            <EditControl
                                position="topleft"
                                onCreated={onCreated}
                                draw={{
                                    rectangle: { shapeOptions: { color: '#FFD700' } },
                                    circle: { shapeOptions: { color: '#FFD700' } },
                                    polygon: { shapeOptions: { color: '#FFD700', fillOpacity: 0.4 } },
                                    polyline: false, marker: false, circlemarker: false
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
    container: { backgroundColor: '#0a0a0a', padding: '20px', borderRadius: '12px', border: '1px solid #222' },
    titulo: { color: '#FFD700', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' },
    formGrid: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' },
    sidebar: { display: 'flex', flexDirection: 'column', gap: '15px' },
    field: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { color: '#888', fontSize: '10px', fontWeight: 'bold' },
    input: { backgroundColor: '#111', border: '1px solid #333', padding: '12px', borderRadius: '8px', color: '#FFF', outline: 'none' },
    inputSearch: { flex: 1, backgroundColor: '#000', border: '1px solid #FFD700', padding: '10px', borderRadius: '8px', color: '#FFF', outline: 'none' },
    btnSearch: { backgroundColor: '#FFD700', border: 'none', borderRadius: '8px', padding: '0 15px', cursor: 'pointer' },
    btn: { backgroundColor: '#FFD700', color: '#000', padding: '15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '10px' },
    statusOk: { color: '#2ecc71', fontSize: '12px', textAlign: 'center', fontWeight: 'bold', marginTop: '5px' },
    mapWrapper: { height: '600px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #333' }
};

export default ClientesPontos;