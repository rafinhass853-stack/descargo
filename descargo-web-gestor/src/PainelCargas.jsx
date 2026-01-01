import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { Plus, MapPin, Truck, UserPlus, Weight, Calendar, Trash2, Navigation, Settings as SettingsIcon, ClipboardList, Clock, Container, Route, AlertTriangle } from 'lucide-react';

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
        trajeto: [] 
    });

    const [modalAberto, setModalAberto] = useState(false);
    const [cargaParaAtribuir, setCargaParaAtribuir] = useState(null);

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

    const selecionarRotograma = (rotaId) => {
        const rota = rotasPlanejadas.find(r => r.id === rotaId);
        if (rota) {
            setNovaCarga(prev => ({
                ...prev,
                origemCliente: rota.origem || '',
                destinoCliente: rota.destino || '',
                trajeto: rota.trajeto || [],
                distanciaEstimada: rota.distancia || ''
            }));
            handleAutoPreencher(rota.origem, 'origem');
            handleAutoPreencher(rota.destino, 'destino');
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

    const handleAutoPreencher = (valor, campo) => {
        if (!valor) return;
        const campoNome = campo === 'origem' ? 'origemCliente' : 'destinoCliente';
        setNovaCarga(prev => ({ ...prev, [campoNome]: valor }));
        const clienteEncontrado = clientesCadastrados.find(c => c.cliente.toUpperCase() === valor.toUpperCase());
        if (clienteEncontrado) {
            if (campo === 'origem') {
                setNovaCarga(prev => ({
                    ...prev,
                    origemCliente: clienteEncontrado.cliente,
                    origemCnpj: clienteEncontrado.cnpj || '',
                    origemCidade: clienteEncontrado.cidade || '',
                    origemLink: clienteEncontrado.linkGoogle || ''
                }));
            } else {
                setNovaCarga(prev => ({
                    ...prev,
                    destinoCliente: clienteEncontrado.cliente,
                    destinoCnpj: clienteEncontrado.cnpj || '',
                    destinoCidade: clienteEncontrado.cidade || '',
                    destinoLink: clienteEncontrado.linkGoogle || ''
                }));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        let prefixo = tipoViagem === 'MANUTENÇÃO' ? 'MT' : tipoViagem === 'VAZIO' ? 'VZ' : 'DT';
        const dtFinal = novaCarga.dt.trim() === '' ? `${prefixo}${Date.now().toString().slice(-6)}` : novaCarga.dt;
        
        let dadosParaSalvar = { ...novaCarga };
        
        // Ajuste automático de perfil conforme sua solicitação
        if (tipoViagem === 'VAZIO' || tipoViagem === 'MANUTENÇÃO') {
            if (!dadosParaSalvar.origemCliente) {
                dadosParaSalvar.origemCliente = tipoViagem === 'VAZIO' ? 'PÁTIO / DESLOCAMENTO' : 'SAÍDA PARA OFICINA';
            }
            dadosParaSalvar.peso = '0'; 
            dadosParaSalvar.perfilVeiculo = tipoViagem; // Salva como VAZIO ou MANUTENÇÃO no banco
        }

        try {
            await addDoc(collection(db, "ordens_servico"), {
                ...dadosParaSalvar,
                tipoViagem: tipoViagem,
                dt: dtFinal,
                status: 'AGUARDANDO PROGRAMAÇÃO',
                motoristaNome: '',
                motoristaId: '',
                criadoEm: serverTimestamp()
            });
            setNovaCarga({
                dt: '', peso: '', perfilVeiculo: 'Trucado', observacao: '',
                origemCnpj: '', origemCliente: '', origemCidade: '', origemLink: '', origemData: '',
                destinoCnpj: '', destinoCliente: '', destinoCidade: '', destinoLink: '', destinoData: '',
                trajeto: []
            });
            alert(`Ordem de ${tipoViagem} lançada com sucesso!`);
        } catch (error) { 
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar ordem de serviço.");
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
                <div style={styles.statsBadge}>{cargas.length} Registros Ativos</div>
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
                        >
                            <option value="" disabled>Selecione o trecho planejado...</option>
                            {rotasPlanejadas.map(rota => (
                                <option key={rota.id} value={rota.id}>
                                    {rota.origem.toUpperCase()} x {rota.destino.toUpperCase()} — ({rota.distancia} km)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{
                        ...styles.gridForm, 
                        gridTemplateColumns: tipoViagem === 'CARREGADO' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' 
                    }}>
                        <div style={styles.formColumn}>
                            <h4 style={styles.columnTitle}><Weight size={14}/> INFORMAÇÕES</h4>
                            <input placeholder="Nº Documento (Opcional)" value={novaCarga.dt} onChange={e => setNovaCarga({...novaCarga, dt: e.target.value})} style={styles.input} />
                            
                            {/* LOGICA SOLICITADA: Tipo Veículo apenas em CARREGADO com opções específicas */}
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
                    </div>

                    {novaCarga.trajeto.length > 0 && (
                        <div style={styles.trajetoAviso}>
                            <Route size={12} /> Rotograma importado: {novaCarga.trajeto.length} pontos de rota.
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
                                
                                return (
                                    <tr key={item.id} style={{
                                        ...styles.tr,
                                        backgroundColor: temSolicitacao ? '#2a1a00' : 'transparent'
                                    }}>
                                        <td style={styles.td}>
                                            <div style={{...styles.statusBadge, 
                                                backgroundColor: item.status === 'AGUARDANDO PROGRAMAÇÃO' ? '#3d2b1f' : '#1b3d2b',
                                                color: item.status === 'AGUARDANDO PROGRAMAÇÃO' ? '#ff9f43' : '#2ecc71',
                                                border: `1px solid ${item.status === 'AGUARDANDO PROGRAMAÇÃO' ? '#ff9f43' : '#2ecc71'}`
                                            }}>{item.status === 'AGUARDANDO PROGRAMAÇÃO' ? 'AGUARDANDO' : (item.status || 'PROGRAMADA')}</div>
                                            <div style={styles.dtLabel}>{item.dt}</div>
                                            {temSolicitacao && (
                                                <div style={styles.alertaRotaPendente}>
                                                    <AlertTriangle size={10} /> ROTA SOLICITADA
                                                </div>
                                            )}
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.infoCol}>
                                                <span style={{...styles.textIcon, color: item.tipoViagem === 'MANUTENÇÃO' ? '#e74c3c' : item.tipoViagem === 'VAZIO' ? '#3498db' : '#ccc'}}>
                                                    {item.tipoViagem === 'MANUTENÇÃO' ? <SettingsIcon size={12}/> : item.tipoViagem === 'VAZIO' ? <Navigation size={12}/> : <Weight size={12}/>} 
                                                    {item.tipoViagem === 'CARREGADO' ? item.peso : item.tipoViagem}
                                                    {item.trajeto?.length > 0 && <Route size={12} color="#2ecc71" title="Possui Rotograma"/>}
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
                                                </div>
                                            ) : <span style={styles.semMotorista}>NÃO ATRIBUÍDO</span>}
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.actionGroup}>
                                                <button onClick={() => { setCargaParaAtribuir(item); setModalAberto(true); }} style={{...styles.circleBtn, backgroundColor: temSolicitacao ? '#FFD700' : '#333', color: temSolicitacao ? '#000' : '#fff'}} title="Atribuir Motorista / Editar"><UserPlus size={16} /></button>
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
    statusBadge: { padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', width: 'fit-content' },
    infoCol: { display: 'flex', flexDirection: 'column', gap: '4px' },
    textIcon: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#ccc' },
    logisticaContainer: { display: 'flex', alignItems: 'center', gap: '15px' },
    pontoInfo: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '150px' },
    localName: { fontSize: '13px', fontWeight: 'bold', color: '#fff' },
    subDetail: { fontSize: '10px', color: '#666' },
    dataDetail: { fontSize: '11px', color: '#FFD700', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' },
    seta: { color: '#333', fontWeight: 'bold' },
    semMotorista: { color: '#444', fontSize: '11px' },
    actionGroup: { display: 'flex', gap: '10px' },
    circleBtn: { border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' },
    deleteBtn: { backgroundColor: '#221111', color: '#ff4444', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' },
    containerResponsavel: { display: 'flex', flexDirection: 'column', gap: '5px' },
    motoristaAtribuido: { color: '#2ecc71', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' },
    infoPlacas: { display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '17px' },
    placaItem: { fontSize: '10px', color: '#999', display: 'flex', alignItems: 'center', gap: '4px' },
    alertaRotaPendente: { color: '#FFD700', fontSize: '9px', fontWeight: 'bold', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '3px' }
};

export default PainelCargas;