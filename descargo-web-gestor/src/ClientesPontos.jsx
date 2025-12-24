import React, { useState } from 'react';
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { MapContainer, TileLayer, FeatureGroup, LayersControl } from 'react-leaflet';
import { EditControl } from "react-leaflet-draw";
import { LocateFixed, Save, Building2, Hash, Link } from 'lucide-react';

// Importação obrigatória do CSS
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

const { BaseLayer } = LayersControl;

const ClientesPontos = () => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ cliente: '', cnpj: '', linkGoogle: '' });
    const [geofence, setGeofence] = useState(null);

    const onCreated = (e) => {
        const { layerType, layer } = e;
        let areaData = { tipo: layerType };

        if (layerType === 'circle') {
            areaData.centro = layer.getLatLng();
            areaData.raio = layer.getRadius();
        } else {
            areaData.coordenadas = layer.getLatLngs();
        }
        setGeofence(areaData);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!geofence) return alert("Por favor, desenhe a cerca no mapa!");

        setLoading(true);
        try {
            const novoCodigo = `CLI-${Math.floor(1000 + Math.random() * 9000)}`;
            // Conforme sua instrução de sempre fornecer o código completo [cite: 2025-12-18]
            await addDoc(collection(db, "cadastro_clientes_pontos"), {
                ...formData,
                codigo: novoCodigo,
                geofence: geofence,
                criadoEm: serverTimestamp()
            });
            
            alert(`Ponto ${novoCodigo} salvo com sucesso!`);
            setFormData({ cliente: '', cnpj: '', linkGoogle: '' });
            setGeofence(null);
            window.location.reload(); 
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar.");
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
                    <div style={styles.field}>
                        <label style={styles.label}><Building2 size={12}/> CLIENTE</label>
                        <input style={styles.input} value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})} required />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}><Hash size={12}/> CNPJ</label>
                        <input style={styles.input} value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}><Link size={12}/> LINK GOOGLE MAPS</label>
                        <input style={styles.input} value={formData.linkGoogle} onChange={e => setFormData({...formData, linkGoogle: e.target.value})} />
                    </div>
                    <button type="submit" disabled={loading} style={styles.btn}>
                        <Save size={18} /> {loading ? 'SALVANDO...' : 'SALVAR PONTO'}
                    </button>
                    {geofence && <p style={{color: '#2ecc71', fontSize: '12px', textAlign: 'center'}}>✓ Cerca desenhada!</p>}
                </div>

                <div style={styles.mapWrapper}>
                    <MapContainer center={[-23.5505, -46.6333]} zoom={15} style={{ height: '100%', width: '100%' }}>
                        <LayersControl position="topright">
                            {/* OPÇÃO HÍBRIDA REAL (SATÉLITE + RUAS) */}
                            <BaseLayer checked name="Visão Híbrida">
                                <TileLayer
                                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                                    attribution='&copy; Google Maps'
                                />
                            </BaseLayer>

                            {/* APENAS SATÉLITE LIMPO */}
                            <BaseLayer name="Satélite Puro">
                                <TileLayer
                                    url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                                    attribution='&copy; Google Maps'
                                />
                            </BaseLayer>
                            
                            {/* APENAS MAPA DE RUAS */}
                            <BaseLayer name="Mapa de Ruas">
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; OpenStreetMap'
                                />
                            </BaseLayer>
                        </LayersControl>

                        <FeatureGroup>
                            <EditControl
                                position="topleft"
                                onCreated={onCreated}
                                draw={{
                                    rectangle: { shapeOptions: { color: '#FFD700' } },
                                    circle: { shapeOptions: { color: '#FFD700' } },
                                    polygon: {
                                        allowIntersection: false,
                                        shapeOptions: { color: '#FFD700', fillOpacity: 0.4 }
                                    },
                                    polyline: false,
                                    circlemarker: false,
                                    marker: false,
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
    titulo: { color: '#FFD700', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', fontSize: '20px' },
    formGrid: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' },
    sidebar: { display: 'flex', flexDirection: 'column', gap: '15px' },
    field: { display: 'flex', flexDirection: 'column', gap: '5px' },
    label: { color: '#888', fontSize: '10px', fontWeight: 'bold' },
    input: { backgroundColor: '#111', border: '1px solid #333', padding: '12px', borderRadius: '8px', color: '#FFF', outline: 'none' },
    btn: { backgroundColor: '#FFD700', color: '#000', padding: '15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' },
    mapWrapper: { height: '580px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #333' }
};

export default ClientesPontos;