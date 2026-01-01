import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, Polygon, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { Navigation, Save, List, Trash2, Edit3, XCircle, Gauge } from 'lucide-react';

// Ajuste de Ícones do Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// COMPONENTE DE ROTEIRIZAÇÃO (CORRIGIDO)
const RoutingMachine = ({ waypoints, setDistancia }) => {
    const map = useMap();
    const routingControlRef = useRef(null);

    useEffect(() => {
        if (!map || waypoints.length < 2) return;

        // Limpa instância anterior se existir
        if (routingControlRef.current) {
            map.removeControl(routingControlRef.current);
        }

        // Cria a nova rota
        const control = L.Routing.control({
            waypoints: waypoints.map(p => L.latLng(p.lat, p.lng)),
            lineOptions: {
                styles: [{ color: '#FFD700', weight: 6, opacity: 0.8 }]
            },
            routeWhileDragging: false,
            addWaypoints: true,
            language: 'pt-BR',
            show: false,
        }).addTo(map);

        routingControlRef.current = control;

        control.on('routesfound', (e) => {
            const route = e.routes[0];
            const distKm = (route.summary.totalDistance / 1000).toFixed(2);
            setDistancia(distKm);
        });

        // Oculta o painel de instruções branco do Leaflet
        const container = control.getContainer();
        if (container) container.style.display = 'none';

        // Ajusta o zoom para caber a rota
        const group = new L.featureGroup(waypoints.map(p => L.marker([p.lat, p.lng])));
        map.fitBounds(group.getBounds().pad(0.2));

        return () => {
            if (routingControlRef.current && map) {
                map.removeControl(routingControlRef.current);
            }
        };
    }, [map, waypoints]); // Removido setDistancia para evitar loops

    return null;
};

const Roteirizacao = () => {
    const [clientes, setClientes] = useState([]);
    const [rotasSalvas, setRotasSalvas] = useState([]);
    const [pontoA, setPontoA] = useState(null);
    const [pontoB, setPontoB] = useState(null);
    const [rotaAtiva, setRotaAtiva] = useState([]);
    const [editandoId, setEditandoId] = useState(null);
    const [salvando, setSalvando] = useState(false);
    const [distanciaAtual, setDistanciaAtual] = useState(0);

    // Carregar dados do Firebase
    useEffect(() => {
        const unsubClientes = onSnapshot(collection(db, "cadastro_clientes_pontos"), (snapshot) => {
            setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const q = query(collection(db, "rotas_planejadas"), orderBy("criadoEm", "desc"));
        const unsubRotas = onSnapshot(q, (snapshot) => {
            setRotasSalvas(snapshot.docs.map(doc => ({ 
                id: doc.id, 
                codigo: `ROT-${doc.id.slice(-4).toUpperCase()}`,
                ...doc.data() 
            })));
        });

        return () => { unsubClientes(); unsubRotas(); };
    }, []);

    const gerarRota = () => {
        if (pontoA?.geofence?.coordenadas?.[0] && pontoB?.geofence?.coordenadas?.[0]) {
            const start = pontoA.geofence.coordenadas[0];
            const end = pontoB.geofence.coordenadas[0];
            setRotaAtiva([
                { lat: start.lat || start[0], lng: start.lng || start[1] },
                { lat: end.lat || end[0], lng: end.lng || end[1] }
            ]);
        } else {
            alert("Selecione pontos que possuem cercas geográficas válidas.");
        }
    };

    const salvarOuAtualizarRota = async () => {
        if (rotaAtiva.length < 2) return;
        
        setSalvando(true);
        try {
            const dadosRota = {
                origem: pontoA?.cliente || "Ponto Manual",
                destino: pontoB?.cliente || "Destino Manual",
                trajeto: rotaAtiva, // Salva os waypoints atuais
                distancia: distanciaAtual,
                atualizadoEm: serverTimestamp(),
                status: 'planejado'
            };

            if (editandoId) {
                await updateDoc(doc(db, "rotas_planejadas", editandoId), dadosRota);
            } else {
                await addDoc(collection(db, "rotas_planejadas"), { ...dadosRota, criadoEm: serverTimestamp() });
            }
            limparFormulario();
            alert("Rota salva com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar rota.");
        } finally {
            setSalvando(false);
        }
    };

    const prepararEdicao = (rota) => {
        setEditandoId(rota.id);
        setRotaAtiva(rota.trajeto);
        setPontoA(clientes.find(c => c.cliente === rota.origem));
        setPontoB(clientes.find(c => c.cliente === rota.destino));
    };

    const limparFormulario = () => {
        setEditandoId(null);
        setRotaAtiva([]);
        setPontoA(null);
        setPontoB(null);
        setDistanciaAtual(0);
    };

    return (
        <div style={localStyles.container}>
            <header style={localStyles.header}>
                <h2 style={localStyles.titulo}>Controle de Quilometragem</h2>
                <div style={localStyles.botoesAcao}>
                    {editandoId && (
                        <button onClick={limparFormulario} style={localStyles.btnCancelar}>
                            <XCircle size={18} /> Cancelar
                        </button>
                    )}
                    <button onClick={salvarOuAtualizarRota} style={localStyles.btnSecundario} disabled={salvando || rotaAtiva.length === 0}>
                        <Save size={18} /> {editandoId ? 'Atualizar' : 'Salvar Rota'}
                    </button>
                    {!editandoId && (
                        <button onClick={gerarRota} style={localStyles.btnPrimario}>
                            <Navigation size={18} /> Gerar Trajeto
                        </button>
                    )}
                </div>
            </header>

            <div style={localStyles.layoutGrid}>
                <div style={localStyles.painelLateral}>
                    <div style={localStyles.cardKm}>
                        <span style={localStyles.labelKm}><Gauge size={16}/> DISTÂNCIA ESTIMADA</span>
                        <h1 style={localStyles.valorKm}>{distanciaAtual} <small>KM</small></h1>
                    </div>

                    <section style={{marginBottom: '20px'}}>
                        <h3 style={localStyles.subtitulo}>Configuração</h3>
                        <select style={localStyles.select} value={pontoA?.id || ""} onChange={(e) => setPontoA(clientes.find(c => c.id === e.target.value))}>
                            <option value="">Origem (Ponto A)...</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.cliente}</option>)}
                        </select>
                        <select style={{...localStyles.select, marginTop: '10px'}} value={pontoB?.id || ""} onChange={(e) => setPontoB(clientes.find(c => c.id === e.target.value))}>
                            <option value="">Destino (Ponto B)...</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.cliente}</option>)}
                        </select>
                    </section>

                    <section style={{flex: 1, overflowY: 'auto'}}>
                        <h3 style={localStyles.subtitulo}><List size={14} style={{marginRight: 8}}/> Rotas Salvas</h3>
                        <div style={localStyles.listaRotas}>
                            {rotasSalvas.map(rota => (
                                <div key={rota.id} style={{...localStyles.cardRota, borderLeft: editandoId === rota.id ? '4px solid #FFD700' : '4px solid #333'}} onClick={() => setRotaAtiva(rota.trajeto)}>
                                    <div style={localStyles.rotaHeader}>
                                        <span style={localStyles.codigoBadge}>{rota.codigo}</span>
                                        <div style={{display: 'flex', gap: '10px'}}>
                                            <Edit3 size={14} color="#FFD700" onClick={(e) => { e.stopPropagation(); prepararEdicao(rota); }} style={{cursor:'pointer'}}/>
                                            <Trash2 size={14} color="#ff4d4d" onClick={(e) => { e.stopPropagation(); if(window.confirm("Excluir rota?")) deleteDoc(doc(db, "rotas_planejadas", rota.id)); }} style={{cursor:'pointer'}}/>
                                        </div>
                                    </div>
                                    <p style={localStyles.rotaCaminho}><b>{rota.origem}</b> ➔ <b>{rota.destino}</b></p>
                                    <div style={localStyles.rotaFooter}>
                                        <span style={{color: '#FFD700'}}>{rota.distancia} KM</span>
                                        <span>{rota.criadoEm?.toDate().toLocaleDateString('pt-BR')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div style={localStyles.painelPrincipal}>
                    <style>{`.leaflet-routing-container { display: none !important; }`}</style>
                    <MapContainer center={[-23.5, -46.6]} zoom={6} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" subdomains={['mt0', 'mt1', 'mt2', 'mt3']} />
                        
                        {/* Desenha as Cercas dos Clientes no Mapa */}
                        {clientes.map(cliente => cliente.geofence && (
                            <Polygon 
                                key={cliente.id}
                                positions={cliente.geofence.coordenadas}
                                pathOptions={{ 
                                    color: (pontoA?.id === cliente.id || pontoB?.id === cliente.id) ? '#FFD700' : '#444', 
                                    weight: 2,
                                    fillOpacity: 0.2
                                }}
                            >
                                <Popup>{cliente.cliente}</Popup>
                            </Polygon>
                        ))}

                        {/* Motor de Rota */}
                        {rotaAtiva.length > 0 && (
                            <RoutingMachine 
                                key={JSON.stringify(rotaAtiva)} 
                                waypoints={rotaAtiva} 
                                setDistancia={setDistanciaAtual} 
                            />
                        )}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};

const localStyles = {
    container: { display: 'flex', flexDirection: 'column', gap: '15px', height: '100vh', padding: '15px', backgroundColor: '#000', color: '#FFF' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    titulo: { color: '#FFD700', fontSize: '20px', margin: 0, fontWeight: 'bold' },
    botoesAcao: { display: 'flex', gap: '8px' },
    btnPrimario: { backgroundColor: '#FFD700', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' },
    btnSecundario: { backgroundColor: '#1a1a1a', color: '#FFF', border: '1px solid #333', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' },
    btnCancelar: { backgroundColor: '#3d1010', color: '#ff8888', border: '1px solid #632525', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' },
    layoutGrid: { display: 'grid', gridTemplateColumns: '350px 1fr', gap: '15px', flex: 1, overflow: 'hidden' },
    painelLateral: { backgroundColor: '#0a0a0a', borderRadius: '8px', padding: '15px', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' },
    painelPrincipal: { borderRadius: '8px', overflow: 'hidden', border: '1px solid #1a1a1a' },
    cardKm: { backgroundColor: '#111', padding: '20px', borderRadius: '8px', border: '1px solid #333', marginBottom: '20px', textAlign: 'center' },
    labelKm: { fontSize: '10px', color: '#888', letterSpacing: '1px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' },
    valorKm: { margin: '10px 0 0 0', color: '#FFD700', fontSize: '32px' },
    select: { width: '100%', padding: '10px', backgroundColor: '#111', color: '#FFF', border: '1px solid #222', borderRadius: '4px' },
    subtitulo: { fontSize: '11px', color: '#666', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '1px' },
    listaRotas: { display: 'flex', flexDirection: 'column', gap: '10px' },
    cardRota: { backgroundColor: '#0f0f0f', padding: '12px', borderRadius: '6px', cursor: 'pointer' },
    rotaHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
    codigoBadge: { backgroundColor: '#222', color: '#FFD700', padding: '2px 6px', borderRadius: '3px', fontSize: '10px' },
    rotaCaminho: { fontSize: '12px', margin: 0, color: '#CCC' },
    rotaFooter: { display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px' }
};

export default Roteirizacao;