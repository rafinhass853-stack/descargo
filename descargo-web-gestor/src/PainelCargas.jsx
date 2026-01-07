import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, doc, deleteDoc, getDoc } from "firebase/firestore";
import { Plus, MapPin, Truck, UserPlus, Weight, Calendar, Trash2, Navigation, Settings as SettingsIcon, ClipboardList, Clock, Container, Route, AlertTriangle, Target, Shield, CheckCircle } from 'lucide-react';
import AcoesCargas from './AcoesCargas';

const PainelCargas = () => {
    const [state, setState] = useState({
        cargas: [], clientesCadastrados: [], veiculos: [], carretas: [], rotasPlanejadas: [],
        novaCarga: { dt: '', peso: '', perfilVeiculo: 'Trucado', observacao: '', origemCnpj: '', origemCliente: '', origemCidade: '', origemLink: '', origemData: '', destinoCnpj: '', destinoCliente: '', destinoCidade: '', destinoLink: '', destinoData: '', trajeto: [], trajetoComInstrucoes: [], cercaVirtual: { tipo: 'circle', raio: 100, centro: null, coordenadas: [], ativa: true }},
        tipoViagem: 'CARREGADO', modalAberto: false, cargaParaAtribuir: null, processandoRotograma: false, buscandoCoordenadas: false
    });

    const GOOGLE_MAPS_API_KEY = 'AIzaSyDT5OptLHwnCVPuevN5Ie8SFWxm4mRPAl4';

    useEffect(() => {
        const colecoes = [
            ["ordens_servico", "cargas"],
            ["rotas_planejadas", "rotasPlanejadas"],
            ["cadastro_clientes_pontos", "clientesCadastrados"],
            ["cadastro_veiculos", "veiculos"],
            ["carretas", "carretas"]
        ];

        const unsubs = colecoes.map(([colecao, campo]) => 
            onSnapshot(query(collection(db, colecao), orderBy(colecao === "cadastro_clientes_pontos" ? "cliente" : "criadoEm", "asc")), 
                (snapshot) => setState(prev => ({ 
                    ...prev, 
                    [campo]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) 
                }))
            )
        );

        return () => unsubs.forEach(unsub => unsub());
    }, []);

    const obterCoordenadasDoEndereco = async (endereco) => {
        if (!endereco) return null;
        try {
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco)}&key=${GOOGLE_MAPS_API_KEY}`);
            const data = await response.json();
            return data.status === 'OK' && data.results[0]?.geometry?.location ? { lat: data.results[0].geometry.location.lat, lng: data.results[0].geometry.location.lng } : null;
        } catch (error) { console.error("Erro ao buscar coordenadas:", error); return null; }
    };

    const configurarGeofenceAutomatica = async (destinoCliente, destinoCidade, destinoEndereco) => {
        if (!destinoCliente) return null;
        setState(prev => ({ ...prev, buscandoCoordenadas: true }));
        
        const cliente = state.clientesCadastrados.find(c => c.cliente?.toUpperCase() === destinoCliente.toUpperCase());
        let coordenadas = cliente?.geofence?.centro || await obterCoordenadasDoEndereco(destinoEndereco || `${destinoCliente}, ${destinoCidade}`);
        
        setState(prev => ({ ...prev, buscandoCoordenadas: false }));
        return coordenadas ? { tipo: 'circle', raio: 100, centro: coordenadas, coordenadas: [], ativa: true } : { tipo: 'circle', raio: 100, centro: null, coordenadas: [], ativa: true };
    };

    const gerarInstrucoesDeRota = async (trajetoCoords) => {
        if (!trajetoCoords?.length) return [];
        setState(prev => ({ ...prev, processandoRotograma: true }));
        
        try {
            const coordenadasStr = trajetoCoords.map(c => `${c.longitude},${c.latitude}`).join(';');
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordenadasStr}?overview=full&geometries=geojson&steps=true`);
            const data = await response.json();
            
            if (!data.routes?.length) return trajetoCoords.map((coord, idx) => ({
                ...coord, instrucao: idx === 0 ? "Inicie a viagem" : idx === trajetoCoords.length - 1 ? "Chegada ao destino" : "Siga em frente",
                tipo: idx === 0 ? "depart" : idx === trajetoCoords.length - 1 ? "arrive" : "continue", distanciaAteProximo: idx < trajetoCoords.length - 1 ? "500m" : "0m", duracao: "30s"
            }));
            
            const instrucoes = data.routes[0].legs.flatMap(leg => leg.steps.filter(step => step.geometry?.coordinates?.length).map(step => {
                const [lng, lat] = step.geometry.coordinates[Math.floor(step.geometry.coordinates.length / 2)];
                let instrucaoPt = step.maneuver.instruction;
                ['Turn left', 'Turn right', 'Continue'].forEach(txt => instrucaoPt = instrucaoPt.includes(txt) ? { 'Turn left': 'Vire à esquerda', 'Turn right': 'Vire à direita', 'Continue': 'Continue em frente' }[txt] : instrucaoPt);
                return { latitude: lat, longitude: lng, instrucao: instrucaoPt, distanciaAteProximo: `${Math.round(step.distance)}m`, duracao: `${Math.round(step.duration)}s`, tipo: step.maneuver.type, modo: step.maneuver.modifier || 'straight' };
            }));
            
            if (instrucoes.length) instrucoes.push({ latitude: trajetoCoords[trajetoCoords.length - 1].latitude, longitude: trajetoCoords[trajetoCoords.length - 1].longitude, instrucao: `Chegada ao destino: ${state.novaCarga.destinoCliente || 'Destino'}`, distanciaAteProximo: "0m", duracao: "0s", tipo: "arrive", modo: "arrive" });
            return instrucoes;
        } catch (error) { console.error("Erro ao gerar instruções:", error); return []; } 
        finally { setState(prev => ({ ...prev, processandoRotograma: false })); }
    };

    const selecionarRotograma = async (rotaId) => {
        const rota = state.rotasPlanejadas.find(r => r.id === rotaId);
        if (!rota) return;
        
        setState(prev => ({ ...prev, processandoRotograma: true }));
        const instrucoes = rota.trajeto?.length ? await gerarInstrucoesDeRota(rota.trajeto) : [];
        const geofenceConfig = rota.destino ? await configurarGeofenceAutomatica(rota.destino, '', rota.destino) : null;
        
        setState(prev => ({ ...prev, novaCarga: {
            ...prev.novaCarga,
            origemCliente: rota.origem || '', destinoCliente: rota.destino || '',
            trajeto: rota.trajeto || [], trajetoComInstrucoes: instrucoes, distanciaEstimada: rota.distancia || '',
            ...(geofenceConfig && { cercaVirtual: geofenceConfig })
        }, processandoRotograma: false }));
        
        handleAutoPreencher(rota.origem, 'origem');
        handleAutoPreencher(rota.destino, 'destino');
    };

    const getConjuntoPlacas = (motoristaId) => {
        if (!motoristaId) return null;
        const cavalo = state.veiculos.find(v => v.motorista_id === motoristaId);
        const carreta = state.carretas.find(c => c.motorista_id === motoristaId);
        return (cavalo || carreta) ? { cavalo: cavalo?.placa || '---', carreta: carreta?.placa || '---' } : null;
    };

    const handleAutoPreencher = async (valor, campo) => {
        if (!valor) return;
        const campoNome = campo === 'origem' ? 'origemCliente' : 'destinoCliente';
        const clienteEncontrado = state.clientesCadastrados.find(c => c.cliente.toUpperCase() === valor.toUpperCase());
        
        const updates = { [campoNome]: valor, ...(clienteEncontrado && {
            [campo === 'origem' ? 'origemCliente' : 'destinoCliente']: clienteEncontrado.cliente,
            [campo === 'origem' ? 'origemCnpj' : 'destinoCnpj']: clienteEncontrado.cnpj || '',
            [campo === 'origem' ? 'origemCidade' : 'destinoCidade']: clienteEncontrado.cidade || '',
            [campo === 'origem' ? 'origemLink' : 'destinoLink']: clienteEncontrado.linkGoogle || ''
        })};
        
        setState(prev => ({ ...prev, novaCarga: { ...prev.novaCarga, ...updates } }));
        
        if (campo === 'destino' && clienteEncontrado) {
            const geofenceConfig = await configurarGeofenceAutomatica(clienteEncontrado.cliente, clienteEncontrado.cidade || '', clienteEncontrado.linkGoogle || '');
            if (geofenceConfig) setState(prev => ({ ...prev, novaCarga: { ...prev.novaCarga, cercaVirtual: geofenceConfig } }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!state.novaCarga.destinoCliente) return alert("Por favor, informe o destino da viagem.");
        
        let geofenceFinal = state.novaCarga.cercaVirtual;
        if (!geofenceFinal?.centro) {
            geofenceFinal = await configurarGeofenceAutomatica(state.novaCarga.destinoCliente, state.novaCarga.destinoCidade || '', state.novaCarga.destinoLink || '') || { tipo: 'circle', raio: 100, centro: null, coordenadas: [], ativa: true };
        }
        
        const prefixo = { 'MANUTENÇÃO': 'MT', 'VAZIO': 'VZ' }[state.tipoViagem] || 'DT';
        const dtFinal = state.novaCarga.dt.trim() === '' ? `${prefixo}${Date.now().toString().slice(-6)}` : state.novaCarga.dt;
        let dadosParaSalvar = { ...state.novaCarga, cercaVirtual: geofenceFinal };
        
        if (['VAZIO', 'MANUTENÇÃO'].includes(state.tipoViagem)) {
            if (!dadosParaSalvar.origemCliente) dadosParaSalvar.origemCliente = state.tipoViagem === 'VAZIO' ? 'PÁTIO / DESLOCAMENTO' : 'SAÍDA PARA OFICINA';
            dadosParaSalvar.peso = '0'; 
            dadosParaSalvar.perfilVeiculo = state.tipoViagem;
        }

        try {
            await addDoc(collection(db, "ordens_servico"), {
                ...dadosParaSalvar, tipoViagem: state.tipoViagem, dt: dtFinal, status: 'AGUARDANDO PROGRAMAÇÃO', motoristaNome: '', motoristaId: '', instrucaoAtual: 0,
                chegouAoDestino: false, finalizada: false, confirmacaoPendente: false, dataChegada: null, dataFinalizacao: null, dataInicioViagem: null, criadoEm: serverTimestamp()
            });
            
            setState(prev => ({ ...prev, novaCarga: { dt: '', peso: '', perfilVeiculo: 'Trucado', observacao: '', origemCnpj: '', origemCliente: '', origemCidade: '', origemLink: '', origemData: '', destinoCnpj: '', destinoCliente: '', destinoCidade: '', destinoLink: '', destinoData: '', trajeto: [], trajetoComInstrucoes: [], cercaVirtual: { tipo: 'circle', raio: 100, centro: null, coordenadas: [], ativa: true }}}));
            alert(`✅ Ordem de ${state.tipoViagem} lançada com sucesso! Sistema de geofence ativado.`);
        } catch (error) { console.error("Erro ao salvar:", error); alert("Erro ao salvar ordem de serviço."); }
    };

    const forcarFinalizacao = async (cargaId) => {
        if (!window.confirm("Deseja forçar a finalização desta viagem?\n\nEsta ação é apenas para casos excepcionais.")) return;
        try {
            await updateDoc(doc(db, "ordens_servico", cargaId), {
                finalizada: true, chegouAoDestino: true, confirmacaoPendente: false, status: 'FINALIZADA MANUALMENTE',
                dataFinalizacao: serverTimestamp(), observacaoFinalizacao: `Finalizada manualmente pelo gestor em ${new Date().toLocaleString()}`
            });
            alert("✅ Viagem finalizada manualmente!");
        } catch (error) { console.error("Erro ao forçar finalização:", error); alert("Erro ao finalizar viagem."); }
    };

    const verificarStatusViagem = async (cargaId) => {
        try {
            const cargaSnap = await getDoc(doc(db, "ordens_servico", cargaId));
            if (cargaSnap.exists()) {
                const data = cargaSnap.data();
                let mensagem = `Status: ${data.status}\nMotorista: ${data.motoristaNome || 'Não atribuído'}\nChegou ao destino: ${data.chegouAoDestino ? 'SIM' : 'NÃO'}\nConfirmação pendente: ${data.confirmacaoPendente ? 'SIM' : 'NÃO'}\nFinalizada: ${data.finalizada ? 'SIM' : 'NÃO'}`;
                if (data.cercaVirtual?.centro) mensagem += `\n\nGeofence ativa: SIM\nCentro: ${data.cercaVirtual.centro.lat.toFixed(6)}, ${data.cercaVirtual.centro.lng.toFixed(6)}\nRaio: ${data.cercaVirtual.raio}m`;
                else mensagem += `\n\nGeofence: NÃO CONFIGURADA`;
                alert(mensagem);
            }
        } catch (error) { console.error("Erro ao verificar status:", error); }
    };

    const formatarData = (dataStr) => {
        if (!dataStr) return "";
        try {
            const data = dataStr.seconds ? new Date(dataStr.seconds * 1000) : new Date(dataStr);
            return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch (e) { return ""; }
    };

    const updateNovaCarga = (updates) => setState(prev => ({ ...prev, novaCarga: { ...prev.novaCarga, ...updates } }));
    const updateField = (field, value) => setState(prev => ({ ...prev, [field]: value }));
    const updateNestedField = (path, value) => setState(prev => ({ ...prev, novaCarga: { ...prev.novaCarga, [path]: value } }));

    const tiposViagem = ['CARREGADO', 'VAZIO', 'MANUTENÇÃO'];
    const icones = { 'CARREGADO': Truck, 'VAZIO': Navigation, 'MANUTENÇÃO': SettingsIcon };
    const cores = { 'CARREGADO': '#FFD700', 'VAZIO': '#3498db', 'MANUTENÇÃO': '#e74c3c' };
    const titulos = { 'CARREGADO': 'DESTINO FINAL', 'VAZIO': 'DESTINO (VAZIO)', 'MANUTENÇÃO': 'LOCAL DA MANUTENÇÃO' };

    return (
        <div style={styles.container}>
            <datalist id="lista-clientes">
                {state.clientesCadastrados.map(c => <option key={c.id} value={c.cliente} />)}
            </datalist>

            <header style={styles.header}>
                <h2 style={styles.titulo}>LOGÍSTICA OPERACIONAL</h2>
                <div style={styles.statsBadge}>{state.cargas.length} Registros • {state.cargas.filter(c => c.status === 'EM ANDAMENTO').length} Ativas</div>
            </header>

            <div style={styles.tipoViagemSelector}>
                {tiposViagem.map(tipo => {
                    const Icone = icones[tipo];
                    return (
                        <button key={tipo} onClick={() => {
                            updateField('tipoViagem', tipo);
                            updateNovaCarga({ destinoCliente: '', destinoCnpj: '', destinoCidade: '', peso: '', dt: '', trajeto: [], trajetoComInstrucoes: [], cercaVirtual: { tipo: 'circle', raio: 100, centro: null, coordenadas: [], ativa: true }, perfilVeiculo: tipo === 'CARREGADO' ? 'Trucado' : tipo });
                        }} style={{...styles.tipoBtn, backgroundColor: state.tipoViagem === tipo ? cores[tipo] : '#111', color: state.tipoViagem === tipo ? (tipo === 'MANUTENÇÃO' ? '#fff' : '#000') : '#888'}}>
                            <Icone size={14}/> {tipo}
                        </button>
                    );
                })}
            </div>

            <section style={styles.cardForm}>
                {state.modalAberto && <AcoesCargas cargaSelecionada={state.cargaParaAtribuir} onFechar={() => updateField('modalAberto', false)} onConfirmar={() => updateField('modalAberto', false)} />}
                <form onSubmit={handleSubmit} style={{ opacity: state.modalAberto ? 0.3 : 1, pointerEvents: state.modalAberto ? 'none' : 'auto' }}>
                    <div style={styles.rotogramaSelectorContainer}>
                        <label style={styles.labelRotograma}><Route size={14} color="#FFD700"/> IMPORTAR ROTOGRAMA PLANEJADO:</label>
                        <select style={styles.selectRotograma} onChange={(e) => selecionarRotograma(e.target.value)} value="" disabled={state.processandoRotograma}>
                            <option value="" disabled>Selecione o trecho planejado...</option>
                            {state.rotasPlanejadas.map(rota => <option key={rota.id} value={rota.id}>{rota.origem.toUpperCase()} x {rota.destino.toUpperCase()} — ({rota.distancia} km)</option>)}
                        </select>
                        {state.processandoRotograma && <div style={styles.processandoRotograma}>Gerando instruções de navegação...</div>}
                    </div>

                    {state.novaCarga.trajetoComInstrucoes.length > 0 && (
                        <div style={styles.instrucoesPreview}>
                            <div style={styles.instrucoesHeader}><Navigation size={14} color="#FFD700" /><span style={styles.instrucoesTitle}>{state.novaCarga.trajetoComInstrucoes.length} instruções de navegação geradas:</span></div>
                            <div style={styles.instrucoesList}>
                                {state.novaCarga.trajetoComInstrucoes.slice(0, 3).map((inst, idx) => (
                                    <div key={idx} style={styles.instrucaoItem}>
                                        <span style={styles.instrucaoIndex}>{idx + 1}</span>
                                        <span style={styles.instrucaoText}>{inst.instrucao}</span>
                                        <span style={styles.instrucaoDist}>{inst.distanciaAteProximo}</span>
                                    </div>
                                ))}
                                {state.novaCarga.trajetoComInstrucoes.length > 3 && <div style={styles.maisInstrucoes}>+ {state.novaCarga.trajetoComInstrucoes.length - 3} mais instruções...</div>}
                            </div>
                        </div>
                    )}

                    <div style={{...styles.gridForm, gridTemplateColumns: state.tipoViagem === 'CARREGADO' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'}}>
                        <div style={styles.formColumn}>
                            <h4 style={styles.columnTitle}><Weight size={14}/> INFORMAÇÕES</h4>
                            <input placeholder="Nº Documento (Opcional)" value={state.novaCarga.dt} onChange={e => updateNestedField('dt', e.target.value)} style={styles.input} />
                            {state.tipoViagem === 'CARREGADO' && (
                                <>
                                    <input placeholder="Peso (ex: 32 Ton)" value={state.novaCarga.peso} onChange={e => updateNestedField('peso', e.target.value)} style={styles.input} required />
                                    <select value={state.novaCarga.perfilVeiculo} onChange={e => updateNestedField('perfilVeiculo', e.target.value)} style={styles.input} required>
                                        {['Trucado', 'Toco', 'Truck'].map(op => <option key={op} value={op}>{op}</option>)}
                                    </select>
                                </>
                            )}
                        </div>

                        {(state.tipoViagem === 'CARREGADO' || state.novaCarga.trajeto.length > 0) && (
                            <div style={styles.formColumn}>
                                <h4 style={styles.columnTitle}><MapPin size={14} color="#FFD700"/> ORIGEM</h4>
                                <input list="lista-clientes" placeholder="Nome do Local" value={state.novaCarga.origemCliente} onChange={e => handleAutoPreencher(e.target.value, 'origem')} style={styles.inputDestaqueOrigem} required />
                                <input placeholder="CNPJ" value={state.novaCarga.origemCnpj} readOnly style={styles.inputReadOnly} />
                                <input placeholder="Cidade/UF" value={state.novaCarga.origemCidade} readOnly style={styles.inputReadOnly} />
                                <input type="datetime-local" value={state.novaCarga.origemData} onChange={e => updateNestedField('origemData', e.target.value)} style={styles.inputDate} required />
                            </div>
                        )}

                        <div style={styles.formColumn}>
                            <h4 style={styles.columnTitle}><MapPin size={14} color={cores[state.tipoViagem]}/> {titulos[state.tipoViagem]}</h4>
                            <input list="lista-clientes" placeholder={state.tipoViagem === 'MANUTENÇÃO' ? "Oficina / Pátio" : "Cliente / Destino"} value={state.novaCarga.destinoCliente} onChange={e => handleAutoPreencher(e.target.value, 'destino')} style={{...styles.input, borderColor: cores[state.tipoViagem]}} required />
                            <input placeholder="CNPJ" value={state.novaCarga.destinoCnpj} readOnly style={styles.inputReadOnly} />
                            <input placeholder="Cidade/UF" value={state.novaCarga.destinoCidade} readOnly style={styles.inputReadOnly} />
                            <input type="datetime-local" value={state.novaCarga.destinoData} onChange={e => updateNestedField('destinoData', e.target.value)} style={styles.inputDate} required />
                        </div>

                        <div style={styles.formColumn}>
                            <h4 style={styles.columnTitle}><Target size={14} color="#2ecc71"/> SISTEMA DE FINALIZAÇÃO</h4>
                            <div style={styles.geofenceSection}>
                                <label style={styles.geofenceLabel}>
                                    <input type="checkbox" checked={state.novaCarga.cercaVirtual?.ativa || true} onChange={e => updateNestedField('cercaVirtual', {...state.novaCarga.cercaVirtual, ativa: e.target.checked})} style={styles.checkbox} />
                                    <Shield size={12} color="#2ecc71" /> Ativar cerca virtual automática
                                </label>
                                {state.novaCarga.cercaVirtual?.ativa && (
                                    <>
                                        <div style={styles.geofenceInfo}><small><CheckCircle size={10} color="#2ecc71" /> A viagem será finalizada automaticamente quando o motorista:<br/>1. Entrar na área do destino<br/>2. Confirmar a chegada no app</small></div>
                                        <div style={styles.geofenceConfig}>
                                            <label style={styles.geofenceConfigLabel}>Raio da cerca (metros):</label>
                                            <input type="number" value={state.novaCarga.cercaVirtual.raio || 100} onChange={e => updateNestedField('cercaVirtual', {...state.novaCarga.cercaVirtual, raio: parseInt(e.target.value) || 100})} style={styles.geofenceInput} min="50" max="500" />
                                        </div>
                                        {state.buscandoCoordenadas && <div style={styles.buscandoCoordenadas}><small>Buscando coordenadas do destino...</small></div>}
                                        {state.novaCarga.cercaVirtual.centro && <div style={styles.coordenadasInfo}><small>📍 Coordenadas configuradas: <br/>{state.novaCarga.cercaVirtual.centro.lat?.toFixed(6)}, {state.novaCarga.cercaVirtual.centro.lng?.toFixed(6)}</small></div>}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {state.novaCarga.trajeto.length > 0 && (
                        <div style={styles.trajetoAviso}>
                            <Route size={12} /> Rotograma importado: {state.novaCarga.trajeto.length} pontos de rota.
                            {state.novaCarga.trajetoComInstrucoes.length > 0 && <span style={{color: '#2ecc71', marginLeft: '10px'}}>🔊 {state.novaCarga.trajetoComInstrucoes.length} instruções de áudio</span>}
                            {state.novaCarga.cercaVirtual?.ativa && <span style={{color: '#FFD700', marginLeft: '10px'}}>🛡️ Cerca virtual ativa ({state.novaCarga.cercaVirtual.raio}m)</span>}
                        </div>
                    )}

                    <textarea placeholder={state.tipoViagem === 'MANUTENÇÃO' ? "Descreva os problemas ou peças a serem trocadas..." : "Observações importantes da viagem..."} value={state.novaCarga.observacao} onChange={e => updateNestedField('observacao', e.target.value)} style={styles.textarea} />
                    <button type="submit" style={{...styles.btnSalvar, backgroundColor: cores[state.tipoViagem], color: state.tipoViagem === 'MANUTENÇÃO' ? '#fff' : '#000'}}>
                        {state.tipoViagem === 'MANUTENÇÃO' ? 'REGISTRAR MANUTENÇÃO' : state.tipoViagem === 'VAZIO' ? 'LANÇAR DESLOCAMENTO VAZIO' : 'LANÇAR CARREGAMENTO'}
                    </button>
                </form>
            </section>

            <section style={styles.cardLista}>
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                {['STATUS / DT', 'TIPO / INFO', 'LOGÍSTICA / LOCAL', 'RESPONSÁVEL', 'AÇÕES'].map((th, idx) => <th key={idx} style={styles.th}>{th}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {state.cargas.map(item => {
                                const placas = getConjuntoPlacas(item.motoristaId);
                                const temSolicitacao = item.solicitarRota && !item.trajeto?.length;
                                const temInstrucoes = item.trajetoComInstrucoes?.length > 0;
                                const temGeofence = item.cercaVirtual?.ativa;
                                const chegouDestino = item.chegouAoDestino;
                                const finalizada = item.finalizada;
                                const confirmacaoPendente = item.confirmacaoPendente;
                                
                                const statusConfig = finalizada ? { bg: '#0a0a0a', border: '#666', text: 'FINALIZADA', color: '#666' } :
                                                    confirmacaoPendente ? { bg: '#1a1a00', border: '#FFD700', text: 'AGUARDANDO CONFIRMAÇÃO', color: '#FFD700' } :
                                                    chegouDestino ? { bg: '#1a3a1a', border: '#2ecc71', text: 'CHEGOU AO DESTINO', color: '#2ecc71' } :
                                                    item.status === 'AGUARDANDO PROGRAMAÇÃO' ? { bg: '#3d2b1f', border: '#ff9f43', text: 'AGUARDANDO', color: '#ff9f43' } :
                                                    item.status === 'EM ANDAMENTO' ? { bg: '#1b3d2b', border: '#2ecc71', text: item.status, color: '#2ecc71' } :
                                                    { bg: '#222', border: '#333', text: item.status || 'PROGRAMADA', color: '#aaa' };
                                
                                return (
                                    <tr key={item.id} style={{...styles.tr, backgroundColor: chegouDestino ? '#0a1a0a' : confirmacaoPendente ? '#1a1a00' : finalizada ? '#0a0a0a' : 'transparent', borderLeft: `3px solid ${statusConfig.border}`}}>
                                        <td style={styles.td}>
                                            <div style={{...styles.statusBadge, backgroundColor: statusConfig.bg, color: statusConfig.color, border: `1px solid ${statusConfig.border}`}}>{statusConfig.text}</div>
                                            <div style={styles.dtLabel}>{item.dt}</div>
                                            {temGeofence && !finalizada && <div style={styles.geofenceBadge}><Target size={10} color="#2ecc71" /> Cerca ativa</div>}
                                            {temSolicitacao && <div style={styles.alertaRotaPendente}><AlertTriangle size={10} /> ROTA SOLICITADA</div>}
                                            {temInstrucoes && <div style={styles.instrucoesBadge}>🔊 {item.trajetoComInstrucoes.length} instruções</div>}
                                            {confirmacaoPendente && <div style={styles.confirmacaoPendenteBadge}><AlertTriangle size={10} color="#FFD700" /> AGUARDANDO CONFIRMAÇÃO DO MOTORISTA</div>}
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.infoCol}>
                                                <span style={{...styles.textIcon, color: cores[item.tipoViagem] || '#ccc'}}>
                                                    {React.createElement(icones[item.tipoViagem] || Weight, {size: 12})} 
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
                                                    <span style={styles.localName}><MapPin size={10} color={cores[item.tipoViagem]}/> {item.destinoCliente}</span>
                                                    <span style={styles.subDetail}>{item.destinoCidade}</span>
                                                    <span style={styles.dataDetail}><Clock size={10}/> {formatarData(item.destinoData)}</span>
                                                    {temGeofence && item.cercaVirtual?.centro && <span style={styles.geofenceDetail}><Target size={10} color="#2ecc71"/> Raio: {item.cercaVirtual.raio}m</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={styles.td}>
                                            {item.motoristaNome ? (
                                                <div style={styles.containerResponsavel}>
                                                    <div style={styles.motoristaAtribuido} title={item.motoristaNome}><UserPlus size={12}/> {item.motoristaNome.toUpperCase().split(' ')[0]}</div>
                                                    {placas && (
                                                        <div style={styles.infoPlacas}>
                                                            <span style={styles.placaItem} title="Placa do Cavalo"><Truck size={10} color="#FFD700"/> {placas.cavalo}</span>
                                                            <span style={styles.placaItem} title="Placa da Carreta"><Container size={10} color="#3498db"/> {placas.carreta}</span>
                                                        </div>
                                                    )}
                                                    {item.dataInicioViagem && <div style={styles.inicioViagem}><Clock size={10} color="#666"/> Início: {formatarData(item.dataInicioViagem)}</div>}
                                                    {finalizada && item.dataFinalizacao && <div style={styles.finalizacaoViagem}><CheckCircle size={10} color="#2ecc71"/> Finalizada: {formatarData(item.dataFinalizacao)}</div>}
                                                </div>
                                            ) : <span style={styles.semMotorista}>NÃO ATRIBUÍDO</span>}
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.actionGroup}>
                                                <button onClick={() => { updateField('cargaParaAtribuir', item); updateField('modalAberto', true); }} style={{...styles.circleBtn, backgroundColor: temSolicitacao ? '#FFD700' : '#333', color: temSolicitacao ? '#000' : '#fff'}} title="Atribuir Motorista / Editar"><UserPlus size={16} /></button>
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
    geofenceSection: { backgroundColor: '#000', padding: '15px', borderRadius: '6px', border: '1px solid #333', marginTop: '10px' },
    geofenceLabel: { color: '#2ecc71', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: 'bold' },
    checkbox: { width: '16px', height: '16px', accentColor: '#2ecc71' },
    geofenceInfo: { fontSize: '11px', color: '#888', marginTop: '8px', padding: '8px', backgroundColor: '#111', borderRadius: '4px', lineHeight: '1.4' },
    geofenceConfig: { marginTop: '10px' },
    geofenceConfigLabel: { fontSize: '11px', color: '#aaa', marginBottom: '5px', display: 'block' },
    geofenceInput: { backgroundColor: '#111', border: '1px solid #444', color: '#FFF', padding: '8px', borderRadius: '4px', fontSize: '13px', width: '100%' },
    buscandoCoordenadas: { fontSize: '11px', color: '#FFD700', marginTop: '10px', padding: '5px', backgroundColor: '#1a1a00', borderRadius: '4px', fontStyle: 'italic' },
    coordenadasInfo: { fontSize: '10px', color: '#2ecc71', marginTop: '10px', padding: '5px', backgroundColor: '#0a1a0a', borderRadius: '4px', fontFamily: 'monospace' }
};

export default PainelCargas;