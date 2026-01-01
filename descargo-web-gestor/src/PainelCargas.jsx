import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, doc, deleteDoc, getDoc } from "firebase/firestore";
import { Plus, MapPin, Truck, UserPlus, Weight, Calendar, Trash2, Navigation, Settings as SettingsIcon, ClipboardList, Clock, Container, Route, AlertTriangle, Target, Shield, CheckCircle } from 'lucide-react';

import AcoesCargas from './AcoesCargas';

const PainelCargas = () => {
    const [cargas, setCargas] = useState([]);
    const [clientesCadastrados, setClientesCadastrados] = useState([]);
    const [veiculos, setVeiculos] = useState([]); 
    const [carretas, setCarretas] = useState([]); 
    const [rotasPlanejadas, setRotasPlanejadas] = useState([]);
    const [tipoViagem, setTipoViagem] = useState('CARREGADO');
    
    const [novaCarga, setNovaCarga] = useState({
        dt: '', peso: '', perfilVeiculo: 'Trucado', observacao: '',
        origemCnpj: '', origemCliente: '', origemCidade: '', origemLink: '', origemData: '',
        destinoCnpj: '', destinoCliente: '', destinoCidade: '', destinoLink: '', destinoData: '',
        trajeto: [],
        trajetoComInstrucoes: [],
        // NOVOS CAMPOS PARA CERCAS VIRTUAIS
        cercaVirtual: {
            tipo: 'circle',
            raio: 100,
            centro: null,
            coordenadas: [],
            ativa: true
        }
    });

    const [modalAberto, setModalAberto] = useState(false);
    const [cargaParaAtribuir, setCargaParaAtribuir] = useState(null);
    const [processandoRotograma, setProcessandoRotograma] = useState(false);
    const [buscandoCoordenadas, setBuscandoCoordenadas] = useState(false);

    // Chave da API do Google Maps (use sua chave real)
    const GOOGLE_MAPS_API_KEY = 'AIzaSyDT5OptLHwnCVPuevN5Ie8SFWxm4mRPAl4';

    useEffect(() => {
        const qCargas = query(collection(db, "ordens_servico"), orderBy("criadoEm", "desc"));
        const unsubCargas = onSnapshot(qCargas, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
            setCargas(lista);
        });

        const qRotas = query(collection(db, "rotas_planejadas"), orderBy("criadoEm", "desc"));
        const unsubRotas = onSnapshot(qRotas, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
            setRotasPlanejadas(lista);
        });

        const qClientes = query(collection(db, "cadastro_clientes_pontos"), orderBy("cliente", "asc"));
        const unsubClientes = onSnapshot(qClientes, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
            setClientesCadastrados(lista);
        });

        const unsubVeiculos = onSnapshot(collection(db, "cadastro_veiculos"), (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
            setVeiculos(lista);
        });

        const unsubCarretas = onSnapshot(collection(db, "carretas"), (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
            setCarretas(lista);
        });

        return () => { 
            unsubCargas(); unsubRotas(); unsubClientes(); unsubVeiculos(); unsubCarretas();
        };
    }, []);

    // Função para obter coordenadas do endereço usando Google Maps
    const obterCoordenadasDoEndereco = async (endereco) => {
        if (!endereco) return null;
        
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco)}&key=${GOOGLE_MAPS_API_KEY}`
            );
            
            const data = await response.json();
            
            if (data.status === 'OK' && data.results.length > 0) {
                const location = data.results[0].geometry.location;
                return {
                    lat: location.lat,
                    lng: location.lng
                };
            }
        } catch (error) {
            console.error("Erro ao buscar coordenadas:", error);
        }
        
        return null;
    };

    // Função para configurar geofence automática
    const configurarGeofenceAutomatica = async (destinoCliente, destinoCidade, destinoEndereco) => {
        if (!destinoCliente) return null;
        
        setBuscandoCoordenadas(true);
        
        try {
            // Primeiro tenta encontrar coordenadas no cliente cadastrado
            const cliente = clientesCadastrados.find(c => 
                c.cliente?.toUpperCase() === destinoCliente.toUpperCase()
            );
            
            let coordenadas = null;
            
            if (cliente?.geofence?.centro) {
                // Usa coordenadas do cliente cadastrado
                coordenadas = cliente.geofence.centro;
            } else {
                // Busca coordenadas pelo endereço usando Google Maps
                const enderecoBusca = destinoEndereco || `${destinoCliente}, ${destinoCidade}`;
                coordenadas = await obterCoordenadasDoEndereco(enderecoBusca);
            }
            
            if (coordenadas) {
                return {
                    tipo: 'circle',
                    raio: 100, // metros
                    centro: coordenadas,
                    coordenadas: [],
                    ativa: true
                };
            }
            
            return {
                tipo: 'circle',
                raio: 100,
                centro: null,
                coordenadas: [],
                ativa: true
            };
            
        } catch (error) {
            console.error("Erro ao configurar geofence:", error);
            return null;
        } finally {
            setBuscandoCoordenadas(false);
        }
    };

    const gerarInstrucoesDeRota = async (trajetoCoords) => {
        if (!trajetoCoords || trajetoCoords.length === 0) return [];
        
        setProcessandoRotograma(true);
        try {
            const coordenadasStr = trajetoCoords.map(c => `${c.longitude},${c.latitude}`).join(';');
            
            const response = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${coordenadasStr}?overview=full&geometries=geojson&steps=true`
            );
            
            const data = await response.json();
            
            if (!data.routes || data.routes.length === 0) {
                return trajetoCoords.map((coord, index) => ({
                    ...coord,
                    instrucao: index === 0 ? "Inicie a viagem" : 
                              index === trajetoCoords.length - 1 ? "Chegada ao destino" : 
                              "Siga em frente",
                    tipo: index === 0 ? "depart" : 
                          index === trajetoCoords.length - 1 ? "arrive" : 
                          "continue",
                    distanciaAteProximo: index < trajetoCoords.length - 1 ? "500m" : "0m",
                    duracao: "30s"
                }));
            }
            
            const legs = data.routes[0].legs;
            const instrucoes = [];
            
            legs.forEach(leg => {
                leg.steps.forEach(step => {
                    if (step.geometry && step.geometry.coordinates.length > 0) {
                        const [lng, lat] = step.geometry.coordinates[Math.floor(step.geometry.coordinates.length / 2)];
                        
                        let instrucaoPt = step.maneuver.instruction;
                        if (instrucaoPt.includes('Turn left')) instrucaoPt = 'Vire à esquerda';
                        if (instrucaoPt.includes('Turn right')) instrucaoPt = 'Vire à direita';
                        if (instrucaoPt.includes('Continue')) instrucaoPt = 'Continue em frente';
                        if (instrucaoPt.includes('arrive')) instrucaoPt = 'Chegada ao destino';
                        
                        instrucoes.push({
                            latitude: lat,
                            longitude: lng,
                            instrucao: instrucaoPt,
                            distanciaAteProximo: `${Math.round(step.distance)}m`,
                            duracao: `${Math.round(step.duration)}s`,
                            tipo: step.maneuver.type,
                            modo: step.maneuver.modifier || 'straight'
                        });
                    }
                });
            });
            
            if (instrucoes.length > 0) {
                instrucoes.push({
                    latitude: trajetoCoords[trajetoCoords.length - 1].latitude,
                    longitude: trajetoCoords[trajetoCoords.length - 1].longitude,
                    instrucao: `Chegada ao destino: ${novaCarga.destinoCliente || 'Destino'}`,
                    distanciaAteProximo: "0m",
                    duracao: "0s",
                    tipo: "arrive",
                    modo: "arrive"
                });
            }
            
            return instrucoes;
            
        } catch (error) {
            console.error("Erro ao gerar instruções:", error);
            return [];
        } finally {
            setProcessandoRotograma(false);
        }
    };

    const selecionarRotograma = async (rotaId) => {
        const rota = rotasPlanejadas.find(r => r.id === rotaId);
        if (rota) {
            setProcessandoRotograma(true);
            
            let instrucoes = [];
            if (rota.trajeto && rota.trajeto.length > 0) {
                instrucoes = await gerarInstrucoesDeRota(rota.trajeto);
            }
            
            setNovaCarga(prev => ({
                ...prev,
                origemCliente: rota.origem || '',
                destinoCliente: rota.destino || '',
                trajeto: rota.trajeto || [],
                trajetoComInstrucoes: instrucoes,
                distanciaEstimada: rota.distancia || ''
            }));
            
            handleAutoPreencher(rota.origem, 'origem');
            handleAutoPreencher(rota.destino, 'destino');
            
            // Configurar geofence para o destino
            if (rota.destino) {
                const geofenceConfig = await configurarGeofenceAutomatica(
                    rota.destino,
                    '',
                    rota.destino
                );
                
                if (geofenceConfig) {
                    setNovaCarga(prev => ({
                        ...prev,
                        cercaVirtual: geofenceConfig
                    }));
                }
            }
            
            setProcessandoRotograma(false);
        }
    };

    const getConjuntoPlacas = (motoristaId) => {
        if (!motoristaId) return null;
        const cavalo = veiculos.find(v => v.motorista_id === motoristaId);
        const carreta = carretas.find(c => c.motorista_id === motoristaId);
        if (!cavalo && !carreta) return null;
        return {
            cavalo: cavalo ? cavalo.placa : '---',
            carreta: carreta ? carreta.placa : '---'
        };
    };

    const handleAutoPreencher = async (valor, campo) => {
        if (!valor) return;
        
        const campoNome = campo === 'origem' ? 'origemCliente' : 'destinoCliente';
        setNovaCarga(prev => ({ ...prev, [campoNome]: valor }));
        
        const clienteEncontrado = clientesCadastrados.find(c => c.cliente.toUpperCase() === valor.toUpperCase());
        
        if (clienteEncontrado) {
            const updates = {
                [campo === 'origem' ? 'origemCliente' : 'destinoCliente']: clienteEncontrado.cliente,
                [campo === 'origem' ? 'origemCnpj' : 'destinoCnpj']: clienteEncontrado.cnpj || '',
                [campo === 'origem' ? 'origemCidade' : 'destinoCidade']: clienteEncontrado.cidade || '',
                [campo === 'origem' ? 'origemLink' : 'destinoLink']: clienteEncontrado.linkGoogle || ''
            };
            
            setNovaCarga(prev => ({
                ...prev,
                ...updates
            }));
            
            // Se for destino, configurar geofence automática
            if (campo === 'destino') {
                const geofenceConfig = await configurarGeofenceAutomatica(
                    clienteEncontrado.cliente,
                    clienteEncontrado.cidade || '',
                    clienteEncontrado.linkGoogle || ''
                );
                
                if (geofenceConfig) {
                    setNovaCarga(prev => ({
                        ...prev,
                        cercaVirtual: geofenceConfig
                    }));
                }
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validar campos obrigatórios
        if (!novaCarga.destinoCliente) {
            alert("Por favor, informe o destino da viagem.");
            return;
        }
        
        // Configurar geofence se não estiver configurada
        let geofenceFinal = novaCarga.cercaVirtual;
        if (!geofenceFinal || !geofenceFinal.centro) {
            const geofenceConfig = await configurarGeofenceAutomatica(
                novaCarga.destinoCliente,
                novaCarga.destinoCidade || '',
                novaCarga.destinoLink || ''
            );
            
            if (geofenceConfig) {
                geofenceFinal = geofenceConfig;
            } else {
                // Cria uma geofence básica
                geofenceFinal = {
                    tipo: 'circle',
                    raio: 100,
                    centro: null,
                    coordenadas: [],
                    ativa: true
                };
            }
        }
        
        let prefixo = tipoViagem === 'MANUTENÇÃO' ? 'MT' : tipoViagem === 'VAZIO' ? 'VZ' : 'DT';
        const dtFinal = novaCarga.dt.trim() === '' ? `${prefixo}${Date.now().toString().slice(-6)}` : novaCarga.dt;
        
        let dadosParaSalvar = { ...novaCarga, cercaVirtual: geofenceFinal };
        
        if (tipoViagem === 'VAZIO' || tipoViagem === 'MANUTENÇÃO') {
            if (!dadosParaSalvar.origemCliente) {
                dadosParaSalvar.origemCliente = tipoViagem === 'VAZIO' ? 'PÁTIO / DESLOCAMENTO' : 'SAÍDA PARA OFICINA';
            }
            dadosParaSalvar.peso = '0'; 
            dadosParaSalvar.perfilVeiculo = tipoViagem;
        }

        try {
            await addDoc(collection(db, "ordens_servico"), {
                ...dadosParaSalvar,
                tipoViagem: tipoViagem,
                dt: dtFinal,
                status: 'AGUARDANDO PROGRAMAÇÃO',
                motoristaNome: '',
                motoristaId: '',
                instrucaoAtual: 0,
                // NOVOS CAMPOS PARA FLUXO DE FINALIZAÇÃO
                chegouAoDestino: false,
                finalizada: false,
                confirmacaoPendente: false,
                dataChegada: null,
                dataFinalizacao: null,
                dataInicioViagem: null,
                criadoEm: serverTimestamp()
            });
            
            // Resetar formulário
            setNovaCarga({
                dt: '', peso: '', perfilVeiculo: 'Trucado', observacao: '',
                origemCnpj: '', origemCliente: '', origemCidade: '', origemLink: '', origemData: '',
                destinoCnpj: '', destinoCliente: '', destinoCidade: '', destinoLink: '', destinoData: '',
                trajeto: [],
                trajetoComInstrucoes: [],
                cercaVirtual: {
                    tipo: 'circle',
                    raio: 100,
                    centro: null,
                    coordenadas: [],
                    ativa: true
                }
            });
            
            alert(`✅ Ordem de ${tipoViagem} lançada com sucesso! Sistema de geofence ativado.`);
            
        } catch (error) { 
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar ordem de serviço.");
        }
    };

    // Função para forçar finalização manual (apenas para admin/gestor)
    const forcarFinalizacao = async (cargaId) => {
        if (!window.confirm("Deseja forçar a finalização desta viagem?\n\nEsta ação é apenas para casos excepcionais.")) {
            return;
        }
        
        try {
            const cargaRef = doc(db, "ordens_servico", cargaId);
            await updateDoc(cargaRef, {
                finalizada: true,
                chegouAoDestino: true,
                confirmacaoPendente: false,
                status: 'FINALIZADA MANUALMENTE',
                dataFinalizacao: serverTimestamp(),
                observacaoFinalizacao: `Finalizada manualmente pelo gestor em ${new Date().toLocaleString()}`
            });
            
            alert("✅ Viagem finalizada manualmente!");
        } catch (error) {
            console.error("Erro ao forçar finalização:", error);
            alert("Erro ao finalizar viagem.");
        }
    };

    // Função para verificar status da viagem
    const verificarStatusViagem = async (cargaId) => {
        try {
            const cargaRef = doc(db, "ordens_servico", cargaId);
            const cargaSnap = await getDoc(cargaRef);
            
            if (cargaSnap.exists()) {
                const data = cargaSnap.data();
                
                let mensagem = `Status: ${data.status}\n`;
                mensagem += `Motorista: ${data.motoristaNome || 'Não atribuído'}\n`;
                mensagem += `Chegou ao destino: ${data.chegouAoDestino ? 'SIM' : 'NÃO'}\n`;
                mensagem += `Confirmação pendente: ${data.confirmacaoPendente ? 'SIM' : 'NÃO'}\n`;
                mensagem += `Finalizada: ${data.finalizada ? 'SIM' : 'NÃO'}`;
                
                if (data.cercaVirtual?.centro) {
                    mensagem += `\n\nGeofence ativa: SIM`;
                    mensagem += `\nCentro: ${data.cercaVirtual.centro.lat.toFixed(6)}, ${data.cercaVirtual.centro.lng.toFixed(6)}`;
                    mensagem += `\nRaio: ${data.cercaVirtual.raio}m`;
                } else {
                    mensagem += `\n\nGeofence: NÃO CONFIGURADA`;
                }
                
                alert(mensagem);
            }
        } catch (error) {
            console.error("Erro ao verificar status:", error);
        }
    };

    const formatarData = (dataStr) => {
        if (!dataStr) return "";
        try {
            if (dataStr.seconds) {
                return new Date(dataStr.seconds * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            }
            const data = new Date(dataStr);
            return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch (e) { return ""; }
    };

    return (
        <div style={styles.container}>
            <datalist id="lista-clientes">
                {clientesCadastrados.map(c => (
                    <option key={c.id} value={c.cliente} />
                ))}
            </datalist>

            <header style={styles.header}>
                <h2 style={styles.titulo}>LOGÍSTICA OPERACIONAL</h2>
                <div style={styles.statsBadge}>
                    {cargas.length} Registros • {cargas.filter(c => c.status === 'EM ANDAMENTO').length} Ativas
                </div>
            </header>

            <div style={styles.tipoViagemSelector}>
                {['CARREGADO', 'VAZIO', 'MANUTENÇÃO'].map(tipo => (
                    <button key={tipo}
                        onClick={() => {
                            setTipoViagem(tipo);
                            setNovaCarga(prev => ({
                                ...prev, 
                                destinoCliente: '', 
                                destinoCnpj: '', 
                                destinoCidade: '', 
                                peso: '', 
                                dt: '', 
                                trajeto: [],
                                trajetoComInstrucoes: [],
                                cercaVirtual: {
                                    tipo: 'circle',
                                    raio: 100,
                                    centro: null,
                                    coordenadas: [],
                                    ativa: true
                                },
                                perfilVeiculo: tipo === 'CARREGADO' ? 'Trucado' : tipo
                            }));
                        }}
                        style={{...styles.tipoBtn, 
                            backgroundColor: tipoViagem === tipo ? (tipo === 'MANUTENÇÃO' ? '#e74c3c' : '#FFD700') : '#111', 
                            color: tipoViagem === tipo ? (tipo === 'MANUTENÇÃO' ? '#fff' : '#000') : '#888'}}
                    >
                        {tipo === 'CARREGADO' ? <Truck size={14}/> : tipo === 'VAZIO' ? <Navigation size={14}/> : <SettingsIcon size={14}/>}
                        {tipo}
                    </button>
                ))}
            </div>

            <section style={styles.cardForm}>
                {modalAberto && (
                    <AcoesCargas 
                        cargaSelecionada={cargaParaAtribuir} 
                        onFechar={() => setModalAberto(false)} 
                        onConfirmar={() => setModalAberto(false)} 
                    />
                )}

                <form onSubmit={handleSubmit} style={{ opacity: modalAberto ? 0.3 : 1, pointerEvents: modalAberto ? 'none' : 'auto' }}>
                    <div style={styles.rotogramaSelectorContainer}>
                        <label style={styles.labelRotograma}>
                            <Route size={14} color="#FFD700"/> IMPORTAR ROTOGRAMA PLANEJADO:
                        </label>
                        <select 
                            style={styles.selectRotograma}
                            onChange={(e) => selecionarRotograma(e.target.value)}
                            value=""
                            disabled={processandoRotograma}
                        >
                            <option value="" disabled>Selecione o trecho planejado...</option>
                            {rotasPlanejadas.map(rota => (
                                <option key={rota.id} value={rota.id}>
                                    {rota.origem.toUpperCase()} x {rota.destino.toUpperCase()} — ({rota.distancia} km)
                                </option>
                            ))}
                        </select>
                        {processandoRotograma && (
                            <div style={styles.processandoRotograma}>
                                Gerando instruções de navegação...
                            </div>
                        )}
                    </div>

                    {novaCarga.trajetoComInstrucoes.length > 0 && (
                        <div style={styles.instrucoesPreview}>
                            <div style={styles.instrucoesHeader}>
                                <Navigation size={14} color="#FFD700" />
                                <span style={styles.instrucoesTitle}>
                                    {novaCarga.trajetoComInstrucoes.length} instruções de navegação geradas:
                                </span>
                            </div>
                            <div style={styles.instrucoesList}>
                                {novaCarga.trajetoComInstrucoes.slice(0, 3).map((inst, idx) => (
                                    <div key={idx} style={styles.instrucaoItem}>
                                        <span style={styles.instrucaoIndex}>{idx + 1}</span>
                                        <span style={styles.instrucaoText}>{inst.instrucao}</span>
                                        <span style={styles.instrucaoDist}>{inst.distanciaAteProximo}</span>
                                    </div>
                                ))}
                                {novaCarga.trajetoComInstrucoes.length > 3 && (
                                    <div style={styles.maisInstrucoes}>
                                        + {novaCarga.trajetoComInstrucoes.length - 3} mais instruções...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div style={{
                        ...styles.gridForm, 
                        gridTemplateColumns: tipoViagem === 'CARREGADO' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' 
                    }}>
                        <div style={styles.formColumn}>
                            <h4 style={styles.columnTitle}><Weight size={14}/> INFORMAÇÕES</h4>
                            <input placeholder="Nº Documento (Opcional)" value={novaCarga.dt} onChange={e => setNovaCarga({...novaCarga, dt: e.target.value})} style={styles.input} />
                            
                            {tipoViagem === 'CARREGADO' && (
                                <>
                                    <input placeholder="Peso (ex: 32 Ton)" value={novaCarga.peso} onChange={e => setNovaCarga({...novaCarga, peso: e.target.value})} style={styles.input} required />
                                    <select 
                                        value={novaCarga.perfilVeiculo} 
                                        onChange={e => setNovaCarga({...novaCarga, perfilVeiculo: e.target.value})} 
                                        style={styles.input}
                                        required
                                    >
                                        <option value="Trucado">Trucado</option>
                                        <option value="Toco">Toco</option>
                                        <option value="Truck">Truck</option>
                                    </select>
                                </>
                            )}
                        </div>

                        {(tipoViagem === 'CARREGADO' || novaCarga.trajeto.length > 0) && (
                            <div style={styles.formColumn}>
                                <h4 style={styles.columnTitle}><MapPin size={14} color="#FFD700"/> ORIGEM</h4>
                                <input list="lista-clientes" placeholder="Nome do Local" value={novaCarga.origemCliente} onChange={e => handleAutoPreencher(e.target.value, 'origem')} style={styles.inputDestaqueOrigem} required />
                                <input placeholder="CNPJ" value={novaCarga.origemCnpj} readOnly style={styles.inputReadOnly} />
                                <input placeholder="Cidade/UF" value={novaCarga.origemCidade} readOnly style={styles.inputReadOnly} />
                                <input type="datetime-local" value={novaCarga.origemData} onChange={e => setNovaCarga({...novaCarga, origemData: e.target.value})} style={styles.inputDate} required />
                            </div>
                        )}

                        <div style={styles.formColumn}>
                            <h4 style={styles.columnTitle}>
                                <MapPin size={14} color={tipoViagem === 'MANUTENÇÃO' ? '#e74c3c' : '#3498db'}/> 
                                {tipoViagem === 'CARREGADO' ? 'DESTINO FINAL' : tipoViagem === 'VAZIO' ? 'DESTINO (VAZIO)' : 'LOCAL DA MANUTENÇÃO'}
                            </h4>
                            <input list="lista-clientes" placeholder={tipoViagem === 'MANUTENÇÃO' ? "Oficina / Pátio" : "Cliente / Destino"} value={novaCarga.destinoCliente} onChange={e => handleAutoPreencher(e.target.value, 'destino')} style={tipoViagem === 'MANUTENÇÃO' ? styles.inputDestaqueManutencao : styles.inputDestaqueDestino} required />
                            <input placeholder="CNPJ" value={novaCarga.destinoCnpj} readOnly style={styles.inputReadOnly} />
                            <input placeholder="Cidade/UF" value={novaCarga.destinoCidade} readOnly style={styles.inputReadOnly} />
                            <input type="datetime-local" value={novaCarga.destinoData} onChange={e => setNovaCarga({...novaCarga, destinoData: e.target.value})} style={styles.inputDate} required />
                        </div>

                        {/* NOVA COLUNA PARA CERCAS VIRTUAIS */}
                        <div style={styles.formColumn}>
                            <h4 style={styles.columnTitle}>
                                <Target size={14} color="#2ecc71"/> SISTEMA DE FINALIZAÇÃO
                            </h4>
                            
                            <div style={styles.geofenceSection}>
                                <label style={styles.geofenceLabel}>
                                    <input 
                                        type="checkbox" 
                                        checked={novaCarga.cercaVirtual?.ativa || true}
                                        onChange={e => setNovaCarga({
                                            ...novaCarga, 
                                            cercaVirtual: {
                                                ...novaCarga.cercaVirtual,
                                                ativa: e.target.checked
                                            }
                                        })}
                                        style={styles.checkbox}
                                    />
                                    <Shield size={12} color="#2ecc71" />
                                    Ativar cerca virtual automática
                                </label>
                                
                                {novaCarga.cercaVirtual?.ativa && (
                                    <>
                                        <div style={styles.geofenceInfo}>
                                            <small>
                                                <CheckCircle size={10} color="#2ecc71" /> 
                                                A viagem será finalizada automaticamente quando o motorista:
                                                <br/>1. Entrar na área do destino
                                                <br/>2. Confirmar a chegada no app
                                            </small>
                                        </div>
                                        
                                        <div style={styles.geofenceConfig}>
                                            <label style={styles.geofenceConfigLabel}>
                                                Raio da cerca (metros):
                                            </label>
                                            <input 
                                                type="number"
                                                value={novaCarga.cercaVirtual.raio || 100}
                                                onChange={e => setNovaCarga({
                                                    ...novaCarga,
                                                    cercaVirtual: {
                                                        ...novaCarga.cercaVirtual,
                                                        raio: parseInt(e.target.value) || 100
                                                    }
                                                })}
                                                style={styles.geofenceInput}
                                                min="50"
                                                max="500"
                                            />
                                        </div>
                                        
                                        {buscandoCoordenadas && (
                                            <div style={styles.buscandoCoordenadas}>
                                                <small>Buscando coordenadas do destino...</small>
                                            </div>
                                        )}
                                        
                                        {novaCarga.cercaVirtual.centro && (
                                            <div style={styles.coordenadasInfo}>
                                                <small>
                                                    📍 Coordenadas configuradas: 
                                                    <br/>{novaCarga.cercaVirtual.centro.lat?.toFixed(6)}, {novaCarga.cercaVirtual.centro.lng?.toFixed(6)}
                                                </small>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {novaCarga.trajeto.length > 0 && (
                        <div style={styles.trajetoAviso}>
                            <Route size={12} /> Rotograma importado: {novaCarga.trajeto.length} pontos de rota.
                            {novaCarga.trajetoComInstrucoes.length > 0 && (
                                <span style={{color: '#2ecc71', marginLeft: '10px'}}>
                                    🔊 {novaCarga.trajetoComInstrucoes.length} instruções de áudio
                                </span>
                            )}
                            {novaCarga.cercaVirtual?.ativa && (
                                <span style={{color: '#FFD700', marginLeft: '10px'}}>
                                    🛡️ Cerca virtual ativa ({novaCarga.cercaVirtual.raio}m)
                                </span>
                            )}
                        </div>
                    )}

                    <textarea 
                        placeholder={tipoViagem === 'MANUTENÇÃO' ? "Descreva os problemas ou peças a serem trocadas..." : "Observações importantes da viagem..."} 
                        value={novaCarga.observacao} 
                        onChange={e => setNovaCarga({...novaCarga, observacao: e.target.value})} 
                        style={styles.textarea} 
                    />

                    <button type="submit" style={{...styles.btnSalvar, backgroundColor: tipoViagem === 'MANUTENÇÃO' ? '#e74c3c' : '#FFD700', color: tipoViagem === 'MANUTENÇÃO' ? '#fff' : '#000'}}>
                        {tipoViagem === 'MANUTENÇÃO' ? 'REGISTRAR MANUTENÇÃO' : tipoViagem === 'VAZIO' ? 'LANÇAR DESLOCAMENTO VAZIO' : 'LANÇAR CARREGAMENTO'}
                    </button>
                </form>
            </section>

            <section style={styles.cardLista}>
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>STATUS / DT</th>
                                <th style={styles.th}>TIPO / INFO</th>
                                <th style={styles.th}>LOGÍSTICA / LOCAL</th>
                                <th style={styles.th}>RESPONSÁVEL</th>
                                <th style={styles.th}>AÇÕES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cargas.map(item => {
                                const placas = getConjuntoPlacas(item.motoristaId);
                                const temSolicitacao = item.solicitarRota && (!item.trajeto || item.trajeto.length === 0);
                                const temInstrucoes = item.trajetoComInstrucoes && item.trajetoComInstrucoes.length > 0;
                                const temGeofence = item.cercaVirtual?.ativa;
                                const chegouDestino = item.chegouAoDestino;
                                const finalizada = item.finalizada;
                                const confirmacaoPendente = item.confirmacaoPendente;
                                
                                return (
                                    <tr key={item.id} style={{
                                        ...styles.tr,
                                        backgroundColor: chegouDestino ? '#0a1a0a' : 
                                                       confirmacaoPendente ? '#1a1a00' : 
                                                       finalizada ? '#0a0a0a' : 'transparent',
                                        borderLeft: chegouDestino ? '3px solid #2ecc71' : 
                                                   confirmacaoPendente ? '3px solid #FFD700' : 
                                                   finalizada ? '3px solid #666' : 'none'
                                    }}>
                                        <td style={styles.td}>
                                            <div style={{...styles.statusBadge, 
                                                backgroundColor: finalizada ? '#1a1a1a' : 
                                                              chegouDestino ? '#1a3a1a' : 
                                                              confirmacaoPendente ? '#3d3d00' :
                                                              item.status === 'AGUARDANDO PROGRAMAÇÃO' ? '#3d2b1f' : 
                                                              item.status === 'EM ANDAMENTO' ? '#1b3d2b' : '#222',
                                                color: finalizada ? '#666' : 
                                                     chegouDestino ? '#2ecc71' : 
                                                     confirmacaoPendente ? '#FFD700' :
                                                     item.status === 'AGUARDANDO PROGRAMAÇÃO' ? '#ff9f43' : 
                                                     item.status === 'EM ANDAMENTO' ? '#2ecc71' : '#aaa',
                                                border: `1px solid ${finalizada ? '#666' : 
                                                       chegouDestino ? '#2ecc71' : 
                                                       confirmacaoPendente ? '#FFD700' :
                                                       item.status === 'AGUARDANDO PROGRAMAÇÃO' ? '#ff9f43' : 
                                                       item.status === 'EM ANDAMENTO' ? '#2ecc71' : '#333'}`
                                            }}>
                                                {finalizada ? 'FINALIZADA' : 
                                                 confirmacaoPendente ? 'AGUARDANDO CONFIRMAÇÃO' :
                                                 chegouDestino ? 'CHEGOU AO DESTINO' : 
                                                 item.status === 'AGUARDANDO PROGRAMAÇÃO' ? 'AGUARDANDO' : 
                                                 (item.status || 'PROGRAMADA')}
                                            </div>
                                            <div style={styles.dtLabel}>{item.dt}</div>
                                            
                                            {temGeofence && !finalizada && (
                                                <div style={styles.geofenceBadge}>
                                                    <Target size={10} color="#2ecc71" /> Cerca ativa
                                                </div>
                                            )}
                                            
                                            {temSolicitacao && (
                                                <div style={styles.alertaRotaPendente}>
                                                    <AlertTriangle size={10} /> ROTA SOLICITADA
                                                </div>
                                            )}
                                            {temInstrucoes && (
                                                <div style={styles.instrucoesBadge}>
                                                    🔊 {item.trajetoComInstrucoes.length} instruções
                                                </div>
                                            )}
                                            
                                            {confirmacaoPendente && (
                                                <div style={styles.confirmacaoPendenteBadge}>
                                                    <AlertTriangle size={10} color="#FFD700" /> AGUARDANDO CONFIRMAÇÃO DO MOTORISTA
                                                </div>
                                            )}
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.infoCol}>
                                                <span style={{...styles.textIcon, color: item.tipoViagem === 'MANUTENÇÃO' ? '#e74c3c' : item.tipoViagem === 'VAZIO' ? '#3498db' : '#ccc'}}>
                                                    {item.tipoViagem === 'MANUTENÇÃO' ? <SettingsIcon size={12}/> : item.tipoViagem === 'VAZIO' ? <Navigation size={12}/> : <Weight size={12}/>} 
                                                    {item.tipoViagem === 'CARREGADO' ? item.peso : item.tipoViagem}
                                                    {item.trajeto?.length > 0 && <Route size={12} color="#2ecc71" title="Possui Rotograma"/>}
                                                    {temGeofence && <Target size={12} color="#2ecc71" title="Cerca virtual ativa"/>}
                                                </span>
                                                <span style={styles.textIcon}><Truck size={12}/> {item.perfilVeiculo}</span>
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.logisticaContainer}>
                                                {(item.tipoViagem === 'CARREGADO' || item.origemCliente) && (
                                                    <>
                                                        <div style={styles.pontoInfo}>
                                                            <span style={styles.localName}><MapPin size={10} color="#FFD700"/> {item.origemCliente}</span>
                                                            <span style={styles.subDetail}>{item.origemCidade}</span>
                                                        </div>
                                                        <div style={styles.seta}>➔</div>
                                                    </>
                                                )}
                                                <div style={styles.pontoInfo}>
                                                    <span style={styles.localName}>
                                                        <MapPin size={10} color={item.tipoViagem === 'MANUTENÇÃO' ? '#e74c3c' : '#3498db'}/> 
                                                        {item.destinoCliente}
                                                    </span>
                                                    <span style={styles.subDetail}>{item.destinoCidade}</span>
                                                    <span style={styles.dataDetail}><Clock size={10}/> {formatarData(item.destinoData)}</span>
                                                    
                                                    {temGeofence && item.cercaVirtual?.centro && (
                                                        <span style={styles.geofenceDetail}>
                                                            <Target size={10} color="#2ecc71"/> 
                                                            Raio: {item.cercaVirtual.raio}m
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            {item.motoristaNome ? (
                                                <div style={styles.containerResponsavel}>
                                                    <div style={styles.motoristaAtribuido} title={item.motoristaNome}>
                                                        <UserPlus size={12}/> {item.motoristaNome.toUpperCase().split(' ')[0]}
                                                    </div>
                                                    {placas && (
                                                        <div style={styles.infoPlacas}>
                                                            <span style={styles.placaItem} title="Placa do Cavalo"><Truck size={10} color="#FFD700"/> {placas.cavalo}</span>
                                                            <span style={styles.placaItem} title="Placa da Carreta"><Container size={10} color="#3498db"/> {placas.carreta}</span>
                                                        </div>
                                                    )}
                                                    {item.dataInicioViagem && (
                                                        <div style={styles.inicioViagem}>
                                                            <Clock size={10} color="#666"/> Início: {formatarData(item.dataInicioViagem)}
                                                        </div>
                                                    )}
                                                    {finalizada && item.dataFinalizacao && (
                                                        <div style={styles.finalizacaoViagem}>
                                                            <CheckCircle size={10} color="#2ecc71"/> Finalizada: {formatarData(item.dataFinalizacao)}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : <span style={styles.semMotorista}>NÃO ATRIBUÍDO</span>}
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.actionGroup}>
                                                <button onClick={() => { setCargaParaAtribuir(item); setModalAberto(true); }} style={{...styles.circleBtn, backgroundColor: temSolicitacao ? '#FFD700' : '#333', color: temSolicitacao ? '#000' : '#fff'}} title="Atribuir Motorista / Editar"><UserPlus size={16} /></button>
                                                
                                                {!finalizada && (
                                                    <>
                                                        <button onClick={() => verificarStatusViagem(item.id)} style={{...styles.circleBtn, backgroundColor: '#1a73e8', color: '#fff'}} title="Verificar Status"><ClipboardList size={16} /></button>
                                                        <button onClick={() => forcarFinalizacao(item.id)} style={{...styles.circleBtn, backgroundColor: '#e74c3c', color: '#fff'}} title="Forçar Finalização"><SettingsIcon size={16} /></button>
                                                    </>
                                                )}
                                                
                                                <button onClick={() => { if(window.confirm("Deseja realmente excluir esta ordem?")) deleteDoc(doc(db, "ordens_servico", item.id)) }} style={styles.deleteBtn} title="Excluir"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

const styles = {
    container: { padding: '20px', color: '#FFF', backgroundColor: '#050505', minHeight: '100vh', fontFamily: 'sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' },
    titulo: { color: '#FFD700', fontSize: '18px', fontWeight: 'bold' },
    statsBadge: { color: '#888', fontSize: '12px', backgroundColor: '#111', padding: '5px 12px', borderRadius: '4px', border: '1px solid #222' },
    tipoViagemSelector: { display: 'flex', gap: '10px', marginBottom: '15px' },
    tipoBtn: { flex: 1, padding: '12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.2s' },
    cardForm: { position: 'relative', backgroundColor: '#111', padding: '20px', borderRadius: '8px', border: '1px solid #222', marginBottom: '20px', minHeight: '320px' },
    rotogramaSelectorContainer: { marginBottom: '20px', padding: '15px', backgroundColor: '#000', borderRadius: '6px', border: '1px dashed #444' },
    labelRotograma: { fontSize: '11px', color: '#FFD700', marginBottom: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' },
    selectRotograma: { width: '100%', backgroundColor: '#0a0a0a', color: '#FFD700', border: '1px solid #333', padding: '12px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' },
    processandoRotograma: { fontSize: '11px', color: '#FFD700', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: '#1a1a00', borderRadius: '4px', fontStyle: 'italic' },
    instrucoesPreview: { backgroundColor: '#0a0a0a', borderRadius: '6px', padding: '15px', marginBottom: '15px', border: '1px solid #333' },
    instrucoesHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' },
    instrucoesTitle: { fontSize: '12px', color: '#FFD700', fontWeight: 'bold' },
    instrucoesList: { display: 'flex', flexDirection: 'column', gap: '8px' },
    instrucaoItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', backgroundColor: '#111', borderRadius: '4px', borderLeft: '3px solid #FFD700' },
    instrucaoIndex: { backgroundColor: '#FFD700', color: '#000', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' },
    instrucaoText: { flex: 1, fontSize: '11px', color: '#ccc' },
    instrucaoDist: { fontSize: '10px', color: '#666', fontWeight: 'bold' },
    maisInstrucoes: { fontSize: '10px', color: '#666', textAlign: 'center', padding: '5px', fontStyle: 'italic' },
    trajetoAviso: { fontSize: '11px', color: '#2ecc71', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: '#0a1a0a', borderRadius: '4px', border: '1px solid #1a3a1a' },
    gridForm: { display: 'grid', gap: '20px' },
    formColumn: { display: 'flex', flexDirection: 'column', gap: '8px' },
    columnTitle: { fontSize: '11px', color: '#FFD700', borderBottom: '1px solid #222', paddingBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' },
    input: { backgroundColor: '#000', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '4px', fontSize: '13px' },
    inputDestaqueOrigem: { backgroundColor: '#000', border: '1px solid #FFD700', color: '#FFF', padding: '10px', borderRadius: '4px', fontSize: '13px' },
    inputDestaqueDestino: { backgroundColor: '#000', border: '1px solid #3498db', color: '#FFF', padding: '10px', borderRadius: '4px', fontSize: '13px' },
    inputDestaqueManutencao: { backgroundColor: '#000', border: '1px solid #e74c3c', color: '#FFF', padding: '10px', borderRadius: '4px', fontSize: '13px' },
    inputReadOnly: { backgroundColor: '#080808', border: '1px solid #222', color: '#777', padding: '10px', borderRadius: '4px', fontSize: '12px' },
    inputDate: { backgroundColor: '#000', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '4px', fontSize: '13px', colorScheme: 'dark' },
    textarea: { width: '100%', backgroundColor: '#000', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '4px', marginTop: '10px', minHeight: '60px', resize: 'vertical' },
    btnSalvar: { width: '100%', border: 'none', padding: '15px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px', marginTop: '10px', transition: '0.3s' },
    cardLista: { backgroundColor: '#111', borderRadius: '8px', border: '1px solid #222', overflow: 'hidden' },
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '15px', fontSize: '10px', color: '#555', borderBottom: '2px solid #222', textAlign: 'left', textTransform: 'uppercase' },
    td: { padding: '15px', borderBottom: '1px solid #1a1a1a', verticalAlign: 'middle' },
    tr: { transition: '0.2s' },
    dtLabel: { fontSize: '11px', fontWeight: 'bold', marginTop: '5px', color: '#aaa' },
    statusBadge: { padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', width: 'fit-content', marginBottom: '5px' },
    infoCol: { display: 'flex', flexDirection: 'column', gap: '4px' },
    textIcon: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#ccc' },
    logisticaContainer: { display: 'flex', alignItems: 'center', gap: '15px' },
    pontoInfo: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '150px' },
    localName: { fontSize: '13px', fontWeight: 'bold', color: '#fff' },
    subDetail: { fontSize: '10px', color: '#666' },
    dataDetail: { fontSize: '11px', color: '#FFD700', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' },
    geofenceDetail: { fontSize: '10px', color: '#2ecc71', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' },
    seta: { color: '#333', fontWeight: 'bold' },
    semMotorista: { color: '#444', fontSize: '11px' },
    actionGroup: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    circleBtn: { border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' },
    deleteBtn: { backgroundColor: '#221111', color: '#ff4444', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' },
    containerResponsavel: { display: 'flex', flexDirection: 'column', gap: '5px' },
    motoristaAtribuido: { color: '#2ecc71', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' },
    infoPlacas: { display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '17px' },
    placaItem: { fontSize: '10px', color: '#999', display: 'flex', alignItems: 'center', gap: '4px' },
    inicioViagem: { fontSize: '9px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' },
    finalizacaoViagem: { fontSize: '9px', color: '#2ecc71', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontWeight: 'bold' },
    alertaRotaPendente: { color: '#FFD700', fontSize: '9px', fontWeight: 'bold', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '3px' },
    instrucoesBadge: { color: '#3498db', fontSize: '9px', fontWeight: 'bold', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '3px' },
    geofenceBadge: { color: '#2ecc71', fontSize: '9px', fontWeight: 'bold', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '3px' },
    confirmacaoPendenteBadge: { color: '#FFD700', fontSize: '8px', fontWeight: 'bold', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: '#1a1a00', padding: '3px 5px', borderRadius: '3px' },
    
    // NOVOS ESTILOS PARA CERCAS VIRTUAIS
    geofenceSection: {
        backgroundColor: '#000',
        padding: '15px',
        borderRadius: '6px',
        border: '1px solid #333',
        marginTop: '10px'
    },
    geofenceLabel: {
        color: '#2ecc71',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '10px',
        fontWeight: 'bold'
    },
    checkbox: {
        width: '16px',
        height: '16px',
        accentColor: '#2ecc71'
    },
    geofenceInfo: {
        fontSize: '11px',
        color: '#888',
        marginTop: '8px',
        padding: '8px',
        backgroundColor: '#111',
        borderRadius: '4px',
        lineHeight: '1.4'
    },
    geofenceConfig: {
        marginTop: '10px'
    },
    geofenceConfigLabel: {
        fontSize: '11px',
        color: '#aaa',
        marginBottom: '5px',
        display: 'block'
    },
    geofenceInput: {
        backgroundColor: '#111',
        border: '1px solid #444',
        color: '#FFF',
        padding: '8px',
        borderRadius: '4px',
        fontSize: '13px',
        width: '100%'
    },
    buscandoCoordenadas: {
        fontSize: '11px',
        color: '#FFD700',
        marginTop: '10px',
        padding: '5px',
        backgroundColor: '#1a1a00',
        borderRadius: '4px',
        fontStyle: 'italic'
    },
    coordenadasInfo: {
        fontSize: '10px',
        color: '#2ecc71',
        marginTop: '10px',
        padding: '5px',
        backgroundColor: '#0a1a0a',
        borderRadius: '4px',
        fontFamily: 'monospace'
    }
};

export default PainelCargas;