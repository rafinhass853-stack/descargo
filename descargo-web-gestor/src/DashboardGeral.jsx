import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Circle } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import { 
    Users, AlertCircle, Truck, Search, MapPin, Eye, MessageCircle, Navigation, RefreshCcw, Send, X
} from 'lucide-react';
import L from 'leaflet';
import { db } from "./firebase";
import { 
    collection, onSnapshot, query, orderBy, doc, setDoc, 
    serverTimestamp, updateDoc, where, getDocs 
} from "firebase/firestore";

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const caminhaoIcon = new L.Icon({
    // Substitua pelo caminho local da sua imagem ou uma URL direta
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png', 
    iconSize: [40, 40],     // Tamanho ajustado para ser mais visível
    iconAnchor: [20, 20],   // Ponto de ancoragem no centro do ícone
    popupAnchor: [0, -20],  // Onde o balão de informações (popup) vai aparecer
    // Geralmente ícones de veículos não usam a sombra padrão de "gota"
    shadowUrl: null 
});

const ChangeView = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (center && center[0] && center[1]) {
            map.flyTo(center, zoom, { duration: 1.5 });
        }
    }, [center, zoom, map]);
    return null;
};

const DashboardGeral = () => {
    const [motoristasCadastrados, setMotoristasCadastrados] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [localizacoes, setLocalizacoes] = useState({});
    const [cercas, setCercas] = useState([]);
    const [mapFocus, setMapFocus] = useState({ center: [-21.78, -48.17], zoom: 6 });
    const [filtroGrid, setFiltroGrid] = useState("");
    const [loadingGPS, setLoadingGPS] = useState(null);
    const [modalViagem, setModalViagem] = useState(false);
    const [motSelecionado, setMotSelecionado] = useState(null);
    const [dadosViagem, setDadosViagem] = useState({
        dt: '', dataColeta: '', clienteColeta: '', cidadeColeta: '',
        linkColeta: '', destinoCidade: '', clienteEntrega: '',
        dataEntrega: '', linkEntrega: '', observacao: '', filial: '1',
        tipoViagem: 'CARREGADO', destinoCliente: '', origemCidade: '', codigoDestino: '001'
    });

    // BUSCAR DADOS DO MOTORISTA COMPLETO - CORRIGIDO
    const buscarDadosMotorista = async (motoristaId) => {
        try {
            console.log("🔍 Buscando motorista ID:", motoristaId);
            
            // TENTATIVA 1: Buscar pelo campo "uid" 
            const q = query(
                collection(db, "cadastro_motoristas"), 
                where("uid", "==", motoristaId)
            );
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                console.log("✅ Motorista encontrado pelo UID");
                return snapshot.docs[0].data();
            }
            
            // TENTATIVA 2: Buscar pelo ID do documento
            const q2 = query(collection(db, "cadastro_motoristas"));
            const snapshot2 = await getDocs(q2);
            
            for (const doc of snapshot2.docs) {
                if (doc.id === motoristaId) {
                    console.log("✅ Motorista encontrado pelo ID do documento");
                    return doc.data();
                }
            }
            
            console.log("❌ Motorista não encontrado");
            return null;
            
        } catch (error) {
            console.error("Erro buscar motorista:", error);
            return null;
        }
    };

    const alterarStatusEscala = async (motoristaId, novoStatus) => {
        try {
            const motRef = doc(db, "cadastro_motoristas", motoristaId);
            await updateDoc(motRef, { statusEscala: novoStatus });
        } catch (e) { console.error(e); }
    };

    const aoMudarCliente = (tipo, clienteNome) => {
        const clienteDados = cercas.find(c => c.cliente === clienteNome);
        let linkGerado = '';
        let cidadeCadastrada = clienteDados?.cidade || '';
        let codigoDestino = clienteDados?.codigo || '001';

        if (clienteDados && clienteDados.geofence) {
            let lat, lng;
            if (clienteDados.geofence.tipo === 'circle') {
                lat = clienteDados.geofence.centro.lat;
                lng = clienteDados.geofence.centro.lng;
            } else if (clienteDados.geofence.coordenadas?.length > 0) {
                lat = clienteDados.geofence.coordenadas[0].lat;
                lng = clienteDados.geofence.coordenadas[0].lng;
            }
            if (lat && lng) linkGerado = `https://www.google.com/maps?q=${lat},${lng}`;
        }

        if (tipo === 'COLETA') {
            setDadosViagem(prev => ({ 
                ...prev, 
                clienteColeta: clienteNome, 
                linkColeta: linkGerado, 
                cidadeColeta: cidadeCadastrada,
                origemCidade: cidadeCadastrada
            }));
        } else {
            setDadosViagem(prev => ({ 
                ...prev, 
                clienteEntrega: clienteNome, 
                destinoCliente: clienteNome,
                linkEntrega: linkGerado, 
                destinoCidade: cidadeCadastrada,
                codigoDestino: codigoDestino
            }));
        }
    };

    const getStatusVelocidade = (vel) => {
        const v = parseFloat(vel) || 0;
        if (v <= 0) return { label: 'PARADO', color: '#7f8c8d', bg: 'rgba(127, 140, 141, 0.1)' };
        if (v <= 80) return { label: 'MOVIMENTO', color: '#2ecc71', bg: 'rgba(46, 204, 113, 0.1)' };
        return { label: 'ALTA VELÔ', color: '#e74c3c', bg: 'rgba(231, 76, 60, 0.1)' };
    };

    const forcarGPS = async (motoristaId) => {
        setLoadingGPS(motoristaId);
        try {
            await setDoc(doc(db, "comandos_gps", motoristaId), {
                comando: "FORCE_REFRESH",
                timestamp: serverTimestamp(),
                origem: "DASHBOARD_GESTOR"
            }, { merge: true });
            setTimeout(() => setLoadingGPS(null), 3000);
        } catch (e) { setLoadingGPS(null); }
    };

    const salvarViagem = async () => {
        if (!motSelecionado) return;
        
        console.log("=== DASHBOARD: SALVANDO VIAGEM ===");
        console.log("Motorista selecionado:", motSelecionado);
        
        // Buscar dados completos do motorista
        const motoristaData = await buscarDadosMotorista(motSelecionado.id);
        
        if (!motoristaData) {
            alert("Erro: Motorista não encontrado no sistema!");
            return;
        }
        
        console.log("Dados do motorista encontrados:", motoristaData);
        console.log("UID do motorista:", motoristaData.uid);

        const placas = getPlacasMotorista(motSelecionado.id);
        
        // IMPORTANTE: Gerar ID único para a viagem
        const viagemId = `${motSelecionado.id}_${Date.now()}`;
        console.log("ID da viagem gerado:", viagemId);
        
        // Preparar dados para o APP - COMPATÍVEL COM O APP.JS
        const viagemData = {
            // IDENTIFICAÇÃO DA VIAGEM
            id: viagemId, // ID único da viagem
            viagemId: viagemId, // Duplicado para compatibilidade
            
            // IDENTIFICAÇÃO DO MOTORISTA (CRÍTICO PARA O APP)
            motoristaId: motSelecionado.id,
            motoristaUid: motoristaData.uid, // UID do Firebase Auth - ESSENCIAL!
            motoristaiUid: motoristaData.uid, // Campo alternativo (com "i") para compatibilidade
            motoristaNome: motSelecionado.nome,
            motoristaCpf: motSelecionado.cpf,
            motoristaEmail: motoristaData.email || motSelecionado.email || '',
            motoristaTelefone: motoristaData.telefone || '',
            
            // VEÍCULO
            cavalo: placas.cavalo || 'S/ PLACA',
            carreta: placas.carreta || '',
            
            // STATUS (COMPATÍVEL COM O APP)
            status: 'PROGRAMADO',
            statusOperacional: 'PROGRAMADO',
            viagemIniciada: false,
            finalizada: false,
            chegouAoDestino: false,
            confirmacaoPendente: false,
            
            // DATAS
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp(),
            dataColeta: dadosViagem.dataColeta || '',
            dataEntrega: dadosViagem.dataEntrega || '',
            
            // COLETA
            dt: dadosViagem.dt,
            clienteColeta: dadosViagem.clienteColeta,
            origemCidade: dadosViagem.cidadeColeta,
            linkColeta: dadosViagem.linkColeta || '',
            
            // ENTREGA (CRÍTICO - O APP USA ESTES CAMPOS)
            clienteEntrega: dadosViagem.clienteEntrega,
            destinoCliente: dadosViagem.destinoCliente || dadosViagem.clienteEntrega,
            destinoCidade: dadosViagem.destinoCidade,
            destinoCodigo: dadosViagem.codigoDestino || '001',
            linkEntrega: dadosViagem.linkEntrega || '',
            
            // CONFIGURAÇÕES
            tipoViagem: dadosViagem.tipoViagem || 'CARREGADO',
            observacao: dadosViagem.observacao || '',
            filial: dadosViagem.filial || '1',
            empresa: motoristaData.empresa || 'Transportadora',
            
            // FLAGS PARA CONTROLE
            temDesenhoRota: false,
            distanciaEstimada: 0,
            tempoEstimado: 0,
            
            // CAMPOS PARA O SISTEMA DE CANHOTOS
            urlCanhoto: null,
            dataFinalizacao: null
        };

        try {
            console.log("📤 Salvando viagem no Firestore...");
            
            // 1. SALVAR NA COLEÇÃO PRINCIPAL QUE O APP USA (ordens_servico)
            await setDoc(doc(db, "ordens_servico", viagemId), viagemData);
            console.log("✅ Salvo em ordens_servico");

            
            // 3. ENVIAR COMANDO PARA O APP
            await setDoc(doc(db, "comandos_roteiro", motSelecionado.id), {
                viagemData: viagemData,
                viagemId: viagemId,
                timestamp: serverTimestamp(),
                tipo: "NOVA_VIAGEM",
                acao: "ATUALIZAR_ROTEIRO",
                origem: "PAINEL_GESTOR",
                mensagem: "Nova viagem programada para você!"
            });
            console.log("✅ Comando enviado para o app");

            // 4. ATUALIZAR STATUS DO MOTORISTA
            await alterarStatusEscala(motSelecionado.id, 'PROGRAMADO');
            console.log("✅ Status do motorista atualizado");
            
            // 5. LIMPAR FORMULÁRIO
            setDadosViagem({
                dt: '', dataColeta: '', clienteColeta: '', cidadeColeta: '',
                linkColeta: '', destinoCidade: '', clienteEntrega: '',
                dataEntrega: '', linkEntrega: '', observacao: '', filial: '1',
                tipoViagem: 'CARREGADO', destinoCliente: '', origemCidade: '', codigoDestino: '001'
            });
            
            console.log("✅ Roteiro salvo com sucesso!");
            alert("✅ Roteiro enviado com sucesso para o motorista!");
            setModalViagem(false);
            
        } catch (error) {
            console.error("❌ Erro ao salvar viagem:", error);
            alert(`❌ Erro ao salvar: ${error.message}`);
        }
    };

    // EFEITOS PARA CARREGAR DADOS
    useEffect(() => {
        // Motoristas
        const unsubMotoristas = onSnapshot(
            query(collection(db, "cadastro_motoristas"), orderBy("nome", "asc")), 
            (snap) => {
                const motoristas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                console.log("📊 Motoristas carregados:", motoristas.length);
                setMotoristasCadastrados(motoristas);
            }
        );

        // Clientes/Pontos
        const unsubCercas = onSnapshot(
            query(collection(db, "cadastro_clientes_pontos")),
            (snap) => setCercas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        // Veículos
        const unsubVeiculos = onSnapshot(
            collection(db, "cadastro_veiculos"),
            (snap) => setVeiculos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        // Localizações em tempo real
        const unsubLocalizacoes = onSnapshot(
            collection(db, "localizacao_realtime"),
            (snap) => {
                const locs = {};
                snap.forEach(doc => {
                    const d = doc.data();
                    const lat = parseFloat(String(d.latitude).replace(',', '.'));
                    const lng = parseFloat(String(d.longitude).replace(',', '.'));
                    
                    if (!isNaN(lat) && !isNaN(lng)) {
                        locs[doc.id] = {
                            lat, lng,
                            velocidade: d.velocidade || 0,
                            ultimaFull: d.ultimaAtualizacao?.toDate?.()?.toLocaleString('pt-BR') || "---",
                            statusOperacional: d.statusOperacional || "---"
                        };
                    }
                });
                setLocalizacoes(locs);
            }
        );

        return () => {
            unsubMotoristas();
            unsubCercas();
            unsubVeiculos();
            unsubLocalizacoes();
        };
    }, []);

    const getPlacasMotorista = (mId) => {
        const v = veiculos.find(v => v.motorista_id === mId);
        return { 
            cavalo: v?.placa || 'S/ PLACA',
            carreta: v?.carreta || ''
        };
    };

    const getGPS = (motorista) => {
        if (!motorista) return null;
        
        // Tentar por UID primeiro
        if (motorista.uid) {
            return localizacoes[motorista.uid] || null;
        }
        
        // Tentar por ID do documento
        if (localizacoes[motorista.id]) {
            return localizacoes[motorista.id];
        }
        
        // Tentar por CPF
        const cpfLimpo = motorista.cpf?.replace(/\D/g, "");
        if (cpfLimpo && localizacoes[cpfLimpo]) {
            return localizacoes[cpfLimpo];
        }
        
        return null;
    };

    const focarNoMapa = (lat, lng) => {
        if (!lat || !lng) return;
        setMapFocus({ center: [lat, lng], zoom: 14 });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const abrirModalViagem = (motorista) => {
        console.log("🔄 Abrindo modal para motorista:", motorista);
        console.log("ID:", motorista.id);
        console.log("UID:", motorista.uid);
        console.log("Nome:", motorista.nome);
        setMotSelecionado(motorista);
        setModalViagem(true);
    };

    return (
        <div style={styles.container}>
            {/* HEADER */}
            <div style={styles.header}>
                <h2 style={styles.title}>
                    LOGÍSTICA <span style={styles.highlight}>REAL-TIME</span>
                </h2>
                <div style={styles.searchContainer}>
                    <Search size={16} color="#FFD700" />
                    <input 
                        placeholder="Pesquisar motorista..." 
                        style={styles.searchInput} 
                        value={filtroGrid}
                        onChange={(e) => setFiltroGrid(e.target.value)} 
                    />
                </div>
            </div>
            
            {/* CARDS RESUMO */}
            <div style={styles.cardsGrid}>
                <div style={styles.card}>
                    <Users size={20} color="#FFD700" />
                    <div>
                        <b style={styles.cardValue}>{motoristasCadastrados.length}</b>
                        <br/>
                        <small style={styles.cardLabel}>MOTORISTAS</small>
                    </div>
                </div>
                <div style={styles.card}>
                    <MapPin size={20} color="#2ecc71" />
                    <div>
                        <b style={{...styles.cardValue, color: '#2ecc71'}}>{Object.keys(localizacoes).length}</b>
                        <br/>
                        <small style={styles.cardLabel}>COM GPS ATIVO</small>
                    </div>
                </div>
                <div style={styles.card}>
                    <Truck size={20} color="#3498db" />
                    <div>
                        <b style={styles.cardValue}>{veiculos.length}</b>
                        <br/>
                        <small style={styles.cardLabel}>FROTA</small>
                    </div>
                </div>
                <div style={styles.card}>
                    <AlertCircle size={20} color="#e67e22" />
                    <div>
                        <b style={styles.cardValue}>{cercas.length}</b>
                        <br/>
                        <small style={styles.cardLabel}>PONTOS/CLIENTES</small>
                    </div>
                </div>
            </div>

            {/* MAPA */}
            <div style={styles.mapContainer}>
                <MapContainer center={mapFocus.center} zoom={mapFocus.zoom} style={{ height: '100%', width: '100%' }}>
                    <ChangeView center={mapFocus.center} zoom={mapFocus.zoom} />
                    <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" />
                    
                    {/* DESENHAR CERCAS */}
                    {cercas.map(c => {
                        if (!c.geofence) return null;
                        
                        if (c.geofence.tipo === 'circle') {
                            return (
                                <Circle 
                                    key={c.id}
                                    center={[c.geofence.centro.lat, c.geofence.centro.lng]}
                                    radius={c.geofence.raio}
                                    pathOptions={{ color: '#FFD700', weight: 1, fillOpacity: 0.1 }}
                                />
                            );
                        } else {
                            return (
                                <Polygon 
                                    key={c.id}
                                    positions={c.geofence.coordenadas?.map(co => [co.lat, co.lng]) || []}
                                    pathOptions={{ color: '#FFD700', weight: 1, fillOpacity: 0.1 }}
                                />
                            );
                        }
                    })}

                    {/* MARCADORES DOS MOTORISTAS */}
                    <MarkerClusterGroup>
                        {motoristasCadastrados.map((motorista) => {
                            const gps = getGPS(motorista);
                            if (!gps) return null;
                            
                            return (
                                <Marker key={motorista.id} position={[gps.lat, gps.lng]} icon={caminhaoIcon}>
                                    <Popup>
                                        <div style={{color: '#000'}}>
                                            <strong>{motorista.nome.toUpperCase()}</strong>
                                            <br/>
                                            Velocidade: {gps.velocidade} km/h
                                            <br/>
                                            Status: {gps.statusOperacional}
                                            <br/>
                                            Última atualização: {gps.ultimaFull}
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MarkerClusterGroup>
                </MapContainer>
            </div>

            {/* TABELA DE MOTORISTAS */}
            <div style={styles.tableContainer}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>MOTORISTA</th>
                            <th style={styles.th}>EQUIPAMENTO</th>
                            <th style={styles.th}>STATUS ESCALA</th>
                            <th style={styles.th}>GPS / ÚLTIMA POSIÇÃO</th>
                            <th style={styles.th}>VELOCIDADE</th>
                            <th style={{...styles.th, textAlign: 'right'}}>AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {motoristasCadastrados
                            .filter(m => 
                                m.nome?.toUpperCase().includes(filtroGrid.toUpperCase()) ||
                                m.cpf?.includes(filtroGrid)
                            )
                            .map((motorista) => {
                                const gps = getGPS(motorista);
                                const placas = getPlacasMotorista(motorista.id);
                                const vStatus = gps ? getStatusVelocidade(gps.velocidade) : null;
                                
                                return (
                                    <tr key={motorista.id} style={styles.tr}>
                                        <td style={styles.td}>
                                            <div style={{ fontWeight: '700', fontSize: '13px', color: '#fff' }}>
                                                {motorista.nome?.toUpperCase() || 'NÃO INFORMADO'}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#555' }}>
                                                {motorista.cpf || 'Sem CPF'}
                                            </div>
                                            <div style={{ fontSize: '9px', color: '#FFD700', marginTop: '2px' }}>
                                                UID: {motorista.uid?.substring(0, 20) || 'Não cadastrado'}...
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            <span style={styles.placaBadge}>
                                                {placas.cavalo}
                                            </span>
                                        </td>
                                        <td style={styles.td}>
                                            <select 
                                                value={motorista.statusEscala || "SEM PROGRAMAÇÃO"}
                                                onChange={(e) => alterarStatusEscala(motorista.id, e.target.value)}
                                                style={{
                                                    ...styles.statusSelect,
                                                    color: motorista.statusEscala === 'PROGRAMADO' ? '#2ecc71' : 
                                                           motorista.statusEscala === 'EM ROTA' ? '#3498db' :
                                                           motorista.statusEscala === 'FOLGA' ? '#e74c3c' : '#FFD700'
                                                }}
                                            >
                                                <option value="SEM PROGRAMAÇÃO">SEM PROGRAMAÇÃO</option>
                                                <option value="PROGRAMADO">PROGRAMADO</option>
                                                <option value="EM ROTA">EM ROTA</option>
                                                <option value="FOLGA">FOLGA / MANUT.</option>
                                            </select>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div>
                                                    <div style={{ 
                                                        fontSize: '11px', 
                                                        color: gps ? '#2ecc71' : '#e74c3c', 
                                                        fontWeight: 'bold' 
                                                    }}>
                                                        {gps ? 'ONLINE' : 'OFFLINE'}
                                                    </div>
                                                    <div style={{ fontSize: '9px', color: '#888' }}>
                                                        {gps ? gps.ultimaFull : 'Sem sinal'}
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => forcarGPS(motorista.id)}
                                                    style={styles.gpsButton}
                                                    disabled={loadingGPS === motorista.id}
                                                    title="Forçar atualização GPS"
                                                >
                                                    <RefreshCcw size={12} className={loadingGPS === motorista.id ? 'spin' : ''} />
                                                </button>
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            {gps ? (
                                                <span style={{
                                                    ...styles.velocidadeBadge,
                                                    color: vStatus.color,
                                                    backgroundColor: vStatus.bg
                                                }}>
                                                    {gps.velocidade} km/h
                                                </span>
                                            ) : (
                                                <span style={{ color: '#666', fontSize: '11px' }}>---</span>
                                            )}
                                        </td>
                                        <td style={{...styles.td, textAlign: 'right'}}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button 
                                                    onClick={() => abrirModalViagem(motorista)}
                                                    style={{...styles.actionButton, backgroundColor: '#3498db'}}
                                                    title="Enviar roteiro"
                                                >
                                                    <Navigation size={16} color="#fff" />
                                                </button>
                                                <button 
                                                    onClick={() => gps && focarNoMapa(gps.lat, gps.lng)}
                                                    style={{
                                                        ...styles.actionButton, 
                                                        backgroundColor: gps ? '#FFD700' : '#111'
                                                    }}
                                                    disabled={!gps}
                                                    title="Focar no mapa"
                                                >
                                                    <Eye size={16} color={gps ? "#000" : "#666"} />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        const tel = motorista.telefone?.replace(/\D/g, "");
                                                        if (tel) window.open(`https://wa.me/55${tel}`);
                                                    }}
                                                    style={{...styles.actionButton, backgroundColor: '#2ecc71'}}
                                                    title="Enviar WhatsApp"
                                                >
                                                    <MessageCircle size={16} color="#000" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>

            {/* MODAL DE NOVA VIAGEM */}
            {modalViagem && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <div style={styles.modalHeader}>
                            <h3 style={styles.modalTitle}>
                                📋 LANÇAR CICLO: {motSelecionado?.nome?.toUpperCase()}
                            </h3>
                            <button 
                                onClick={() => {
                                    setModalViagem(false);
                                    setMotSelecionado(null);
                                }}
                                style={styles.modalCloseButton}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* FORMULÁRIO */}
                        
                        {/* SEÇÃO 1: DADOS DA CARGA (COLETA) */}
                        <div style={styles.formSection}>
                            <div style={styles.sectionHeader}>
                                1. DADOS DA CARGA (COLETA)
                            </div>
                            <div style={styles.formGrid}>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>DT / VIAGEM</label>
                                    <input 
                                        style={styles.input}
                                        value={dadosViagem.dt}
                                        onChange={e => setDadosViagem({...dadosViagem, dt: e.target.value})}
                                        placeholder="Número da DT"
                                    />
                                </div>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>CLIENTE COLETA (CADASTRADOS)</label>
                                    <select 
                                        style={styles.input}
                                        value={dadosViagem.clienteColeta}
                                        onChange={e => aoMudarCliente('COLETA', e.target.value)}
                                    >
                                        <option value="">Selecione o Cliente...</option>
                                        {cercas.map(c => (
                                            <option key={c.id} value={c.cliente}>{c.cliente}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>CIDADE COLETA (AUTO)</label>
                                    <input 
                                        style={{...styles.input, backgroundColor: '#050505', color: '#FFD700'}}
                                        value={dadosViagem.cidadeColeta}
                                        readOnly
                                        placeholder="Cidade automática..."
                                    />
                                </div>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>DATA/HORA COLETA</label>
                                    <input 
                                        type="datetime-local"
                                        style={styles.input}
                                        value={dadosViagem.dataColeta}
                                        onChange={e => setDadosViagem({...dadosViagem, dataColeta: e.target.value})}
                                        placeholder="dd/mm/aaaa --:--"
                                    />
                                </div>
                                <div style={{...styles.inputGroup, gridColumn: 'span 2'}}>
                                    <label style={styles.label}>LINK GOOGLE MAPS COLETA (AUTO)</label>
                                    <input 
                                        style={{...styles.input, backgroundColor: '#050505', color: '#FFD700'}}
                                        value={dadosViagem.linkColeta}
                                        readOnly
                                        placeholder="Link automático..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SEÇÃO 2: DESTINO FINAL (ENTREGA) */}
                        <div style={styles.formSection}>
                            <div style={styles.sectionHeader}>
                                2. DESTINO FINAL (ENTREGA)
                            </div>
                            <div style={styles.formGrid}>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>CLIENTE ENTREGA (CADASTRADOS)</label>
                                    <select 
                                        style={styles.input}
                                        value={dadosViagem.clienteEntrega}
                                        onChange={e => aoMudarCliente('ENTREGA', e.target.value)}
                                    >
                                        <option value="">Selecione o Cliente...</option>
                                        {cercas.map(c => (
                                            <option key={c.id} value={c.cliente}>{c.cliente}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>CIDADE DESTINO (AUTO)</label>
                                    <input 
                                        style={{...styles.input, backgroundColor: '#050505', color: '#FFD700'}}
                                        value={dadosViagem.destinoCidade}
                                        readOnly
                                        placeholder="Cidade automática..."
                                    />
                                </div>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>DATA/HORA ENTREGA</label>
                                    <input 
                                        type="datetime-local"
                                        style={styles.input}
                                        value={dadosViagem.dataEntrega}
                                        onChange={e => setDadosViagem({...dadosViagem, dataEntrega: e.target.value})}
                                        placeholder="dd/mm/aaaa --:--"
                                    />
                                </div>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>LINK GOOGLE MAPS ENTREGA (AUTO)</label>
                                    <input 
                                        style={{...styles.input, backgroundColor: '#050505', color: '#FFD700'}}
                                        value={dadosViagem.linkEntrega}
                                        readOnly
                                        placeholder="Link automático..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SEÇÃO 3: OBSERVAÇÃO */}
                        <div style={styles.formSection}>
                            <div style={styles.sectionHeader}>
                                OBSERVAÇÃO (CONSIDERAR ENDEREÇO DA MP)
                            </div>
                            <div style={styles.formGrid}>
                                <div style={{...styles.inputGroup, gridColumn: 'span 2'}}>
                                    <textarea 
                                        style={{...styles.input, minHeight: '80px'}}
                                        value={dadosViagem.observacao}
                                        onChange={e => setDadosViagem({...dadosViagem, observacao: e.target.value})}
                                        placeholder="Instruções adicionais"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* BOTÃO ENVIAR */}
                        <div style={styles.formSection}>
                            <div style={styles.formGrid}>
                                <div style={{...styles.inputGroup, gridColumn: 'span 2'}}>
                                    <button onClick={salvarViagem} style={styles.saveButton}>
                                        <Send size={18} /> ENVIAR ROTEIRO COMPLETO PARA O MOTORISTA
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* DEBUG INFO (apenas durante desenvolvimento) */}
                        <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#111', borderRadius: '8px', fontSize: '11px', color: '#888'}}>
                            <div><strong>Informações de Debug:</strong></div>
                            <div>Motorista ID: {motSelecionado?.id}</div>
                            <div>Motorista UID: {motSelecionado?.uid}</div>
                            <div>Viagem será salva em: ordens_servico e viagens_ativas</div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .spin { animation: rotation 2s infinite linear; }
                @keyframes rotation {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(359deg); }
                }
            `}</style>
        </div>
    );
};

const styles = {
    container: {
        padding: '20px',
        backgroundColor: '#000',
        minHeight: '100vh',
        fontFamily: "'Inter', 'Segoe UI', sans-serif"
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '25px',
        flexWrap: 'wrap',
        gap: '15px'
    },
    title: {
        color: '#fff',
        margin: 0,
        fontSize: '20px',
        fontWeight: '800'
    },
    highlight: {
        color: '#FFD700'
    },
    searchContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        backgroundColor: '#0a0a0a',
        padding: '8px 15px',
        borderRadius: '12px',
        border: '1px solid #1a1a1a'
    },
    searchInput: {
        background: 'none',
        border: 'none',
        color: '#fff',
        outline: 'none',
        fontSize: '13px',
        width: '220px'
    },
    cardsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '15px',
        marginBottom: '25px'
    },
    card: {
        backgroundColor: '#0a0a0a',
        padding: '15px',
        borderRadius: '12px',
        border: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        transition: 'transform 0.2s',
        cursor: 'pointer'
    },
    cardValue: {
        fontSize: '22px',
        fontWeight: '900',
        color: '#fff',
        display: 'block',
        lineHeight: '1.2'
    },
    cardLabel: {
        color: '#444',
        fontSize: '9px',
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },
    mapContainer: {
        height: '380px',
        width: '100%',
        borderRadius: '15px',
        overflow: 'hidden',
        border: '1px solid #1a1a1a',
        marginBottom: '25px'
    },
    tableContainer: {
        backgroundColor: '#0a0a0a',
        borderRadius: '15px',
        border: '1px solid #1a1a1a',
        padding: '10px',
        overflowX: 'auto'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        minWidth: '1000px'
    },
    th: {
        padding: '15px',
        textAlign: 'left',
        fontSize: '11px',
        color: '#444',
        fontWeight: '700',
        borderBottom: '2px solid #111'
    },
    tr: {
        borderBottom: '1px solid #111'
    },
    td: {
        padding: '12px 15px',
        verticalAlign: 'middle'
    },
    placaBadge: {
        fontSize: '10px',
        color: '#FFD700',
        backgroundColor: '#1a1a1a',
        padding: '3px 7px',
        borderRadius: '5px',
        fontWeight: 'bold',
        display: 'inline-block'
    },
    statusSelect: {
        padding: '6px 10px',
        borderRadius: '8px',
        fontSize: '11px',
        fontWeight: 'bold',
        border: '1px solid #333',
        backgroundColor: '#000',
        width: '145px',
        cursor: 'pointer',
        outline: 'none'
    },
    gpsButton: {
        background: '#111',
        border: '1px solid #222',
        padding: '6px',
        borderRadius: '6px',
        cursor: 'pointer',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.2s'
    },
    velocidadeBadge: {
        fontSize: '10px',
        fontWeight: '800',
        padding: '4px 8px',
        borderRadius: '4px',
        display: 'inline-block'
    },
    actionButton: {
        border: 'none',
        padding: '8px',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 0.2s'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.9)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        padding: '20px'
    },
    modal: {
        backgroundColor: '#0a0a0a',
        padding: '25px',
        borderRadius: '20px',
        border: '1px solid #333',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflowY: 'auto'
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '25px',
        borderBottom: '1px solid #222',
        paddingBottom: '15px'
    },
    modalTitle: {
        color: '#FFD700',
        margin: 0,
        fontSize: '18px'
    },
    modalCloseButton: {
        background: 'none',
        border: 'none',
        color: '#fff',
        cursor: 'pointer',
        padding: '5px'
    },
    formSection: {
        marginBottom: '25px'
    },
    sectionHeader: {
        color: '#FFD700',
        fontSize: '12px',
        fontWeight: 'bold',
        borderLeft: '3px solid #FFD700',
        paddingLeft: '10px',
        marginBottom: '15px',
        textTransform: 'uppercase'
    },
    formGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '15px'
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    label: {
        fontSize: '10px',
        color: '#666',
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },
    input: {
        backgroundColor: '#111',
        border: '1px solid #333',
        padding: '12px',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '13px',
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'border 0.2s'
    },
    saveButton: {
        width: '100%',
        marginTop: '25px',
        padding: '15px',
        backgroundColor: '#FFD700',
        border: 'none',
        borderRadius: '10px',
        fontWeight: '900',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        color: '#000',
        fontSize: '14px',
        textTransform: 'uppercase',
        transition: 'background 0.2s'
    }
};

export default DashboardGeral;