import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { Plus, MapPin, Truck, UserPlus, Info, Weight, Calendar, Clock, ExternalLink, Trash2, Navigation, Settings as SettingsIcon } from 'lucide-react';

import AcoesCargas from './AcoesCargas';

const PainelCargas = () => {
    const [cargas, setCargas] = useState([]);
    const [tipoViagem, setTipoViagem] = useState('CARREGADO'); // CARREGADO, VAZIO, MANUTENÇÃO
    const [novaCarga, setNovaCarga] = useState({
        dt: '', peso: '', perfilVeiculo: '', observacao: '',
        origemCnpj: '', origemCliente: '', origemCidade: '', origemLink: '', origemData: '',
        destinoCnpj: '', destinoCliente: '', destinoCidade: '', destinoLink: '', destinoData: '',
    });

    const [modalAberto, setModalAberto] = useState(false);
    const [cargaParaAtribuir, setCargaParaAtribuir] = useState(null);

    useEffect(() => {
        const q = query(collection(db, "ordens_servico"), orderBy("criadoEm", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
            setCargas(lista);
        });
        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Gerador de DT automático baseado no tipo se estiver vazio
        let prefixo = tipoViagem === 'MANUTENÇÃO' ? 'MT' : tipoViagem === 'VAZIO' ? 'VZ' : 'DT';
        const dtFinal = novaCarga.dt.trim() === '' ? `${prefixo}${Date.now().toString().slice(-6)}` : novaCarga.dt;

        try {
            await addDoc(collection(db, "ordens_servico"), {
                ...novaCarga,
                tipoViagem: tipoViagem,
                dt: dtFinal,
                status: 'AGUARDANDO PROGRAMAÇÃO',
                motorista: '',
                motoristaId: '',
                criadoEm: serverTimestamp()
            });
            
            setNovaCarga({
                dt: '', peso: '', perfilVeiculo: '', observacao: '',
                origemCnpj: '', origemCliente: '', origemCidade: '', origemLink: '', origemData: '',
                destinoCnpj: '', destinoCliente: '', destinoCidade: '', destinoLink: '', destinoData: '',
            });
            alert(`Viagem de ${tipoViagem} registrada com sucesso!`);
        } catch (error) { console.error(error); }
    };

    const handleExcluirCarga = async (id) => {
        if (window.confirm("Tem certeza que deseja excluir esta carga permanentemente?")) {
            try {
                await deleteDoc(doc(db, "ordens_servico", id));
                alert("Carga removida do sistema.");
            } catch (error) {
                console.error(error);
                alert("Erro ao excluir.");
            }
        }
    };

    const confirmarAtribuicao = async (motoristaInfo) => {
        try {
            const cargaRef = doc(db, "ordens_servico", cargaParaAtribuir.id);
            if (motoristaInfo) {
                await updateDoc(cargaRef, {
                    motorista: motoristaInfo.nome,
                    motoristaId: motoristaInfo.id,
                    status: 'PROGRAMADA',
                    enviadoEm: serverTimestamp()
                });
            } else {
                await updateDoc(cargaRef, {
                    motorista: '',
                    motoristaId: '',
                    status: 'AGUARDANDO PROGRAMAÇÃO',
                    enviadoEm: null
                });
            }
            setModalAberto(false);
            setCargaParaAtribuir(null);
        } catch (error) {
            console.error("Erro ao atualizar carga:", error);
            alert("Erro na operação.");
        }
    };

    const handleAbrirAcoes = (carga) => {
        setCargaParaAtribuir({
            ...carga,
            motoristaNome: carga.motorista 
        });
        setModalAberto(true);
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h2 style={styles.titulo}>LOGÍSTICA OPERACIONAL</h2>
                <div style={styles.statsBadge}>{cargas.length} Viagens Ativas</div>
            </header>

            {/* SELETOR DE TIPO DE VIAGEM */}
            <div style={styles.tipoViagemSelector}>
                <button 
                    onClick={() => setTipoViagem('CARREGADO')}
                    style={{...styles.tipoBtn, backgroundColor: tipoViagem === 'CARREGADO' ? '#FFD700' : '#111', color: tipoViagem === 'CARREGADO' ? '#000' : '#888'}}
                >
                    <Truck size={16}/> VIAGEM CARREGADO
                </button>
                <button 
                    onClick={() => setTipoViagem('VAZIO')}
                    style={{...styles.tipoBtn, backgroundColor: tipoViagem === 'VAZIO' ? '#FFD700' : '#111', color: tipoViagem === 'VAZIO' ? '#000' : '#888'}}
                >
                    <Navigation size={16}/> VIAGEM VAZIO
                </button>
                <button 
                    onClick={() => setTipoViagem('MANUTENÇÃO')}
                    style={{...styles.tipoBtn, backgroundColor: tipoViagem === 'MANUTENÇÃO' ? '#FFD700' : '#111', color: tipoViagem === 'MANUTENÇÃO' ? '#000' : '#888'}}
                >
                    <SettingsIcon size={16}/> MANUTENÇÃO
                </button>
            </div>

            <section style={styles.cardForm}>
                <form onSubmit={handleSubmit}>
                    <div style={styles.gridForm}>
                        <div style={styles.formColumn}>
                            <h4 style={styles.columnTitle}><Weight size={16}/> INFORMAÇÕES GERAIS</h4>
                            <input placeholder="DT (Opcional)" value={novaCarga.dt} onChange={e => setNovaCarga({...novaCarga, dt: e.target.value})} style={styles.input} />
                            
                            {tipoViagem === 'CARREGADO' && (
                                <>
                                    <input placeholder="Peso (ex: 32 Ton)" value={novaCarga.peso} onChange={e => setNovaCarga({...novaCarga, peso: e.target.value})} style={styles.input} required />
                                    <input placeholder="Tipo de Veículo (Vanderleia, Sider...)" value={novaCarga.perfilVeiculo} onChange={e => setNovaCarga({...novaCarga, perfilVeiculo: e.target.value})} style={styles.input} required />
                                </>
                            )}
                            
                            {tipoViagem !== 'CARREGADO' && (
                                <div style={{padding: '10px', backgroundColor: '#000', borderRadius: '4px', fontSize: '11px', color: '#666', border: '1px dashed #333'}}>
                                    Peso e Veículo serão definidos na próxima etapa da coleta.
                                </div>
                            )}
                        </div>

                        <div style={styles.formColumn}>
                            <h4 style={styles.columnTitle}><MapPin size={16} color="#FFD700"/> ORIGEM / COLETA</h4>
                            <input placeholder="CNPJ Origem (se houver)" value={novaCarga.origemCnpj} onChange={e => setNovaCarga({...novaCarga, origemCnpj: e.target.value})} style={styles.input} />
                            <input placeholder="Nome Local Origem" value={novaCarga.origemCliente} onChange={e => setNovaCarga({...novaCarga, origemCliente: e.target.value})} style={styles.input} required />
                            <input placeholder="Cidade/UF" value={novaCarga.origemCidade} onChange={e => setNovaCarga({...novaCarga, origemCidade: e.target.value})} style={styles.input} required />
                            <input placeholder="Link Google Maps" value={novaCarga.origemLink} onChange={e => setNovaCarga({...novaCarga, origemLink: e.target.value})} style={styles.input} />
                            <div style={styles.dateTimeWrapper}>
                                <Calendar size={14} style={styles.dateTimeIcon} />
                                <input type="datetime-local" value={novaCarga.origemData} onChange={e => setNovaCarga({...novaCarga, origemData: e.target.value})} style={styles.inputDate} required />
                            </div>
                        </div>

                        <div style={styles.formColumn}>
                            <h4 style={styles.columnTitle}><MapPin size={16} color="#3498db"/> DESTINO / ENTREGA</h4>
                            <input placeholder="CNPJ Destino (se houver)" value={novaCarga.destinoCnpj} onChange={e => setNovaCarga({...novaCarga, destinoCnpj: e.target.value})} style={styles.input} />
                            <input placeholder="Nome Local Destino" value={novaCarga.destinoCliente} onChange={e => setNovaCarga({...novaCarga, destinoCliente: e.target.value})} style={styles.input} required />
                            <input placeholder="Cidade/UF" value={novaCarga.destinoCidade} onChange={e => setNovaCarga({...novaCarga, destinoCidade: e.target.value})} style={styles.input} required />
                            <input placeholder="Link Google Maps" value={novaCarga.destinoLink} onChange={e => setNovaCarga({...novaCarga, destinoLink: e.target.value})} style={styles.input} />
                            <div style={styles.dateTimeWrapper}>
                                <Calendar size={14} style={styles.dateTimeIcon} />
                                <input type="datetime-local" value={novaCarga.destinoData} onChange={e => setNovaCarga({...novaCarga, destinoData: e.target.value})} style={styles.inputDate} required />
                            </div>
                        </div>
                    </div>
                    <textarea 
                        placeholder={tipoViagem === 'MANUTENÇÃO' ? "Descreva aqui a manutenção (Ex: Borracharia, Troca de Óleo...)" : "Observações e Requisitos..."} 
                        value={novaCarga.observacao} 
                        onChange={e => setNovaCarga({...novaCarga, observacao: e.target.value})} 
                        style={styles.textarea} 
                    />
                    <button type="submit" style={styles.btnSalvar}>LANÇAR {tipoViagem}</button>
                </form>
            </section>

            <section style={styles.cardLista}>
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.headRow}>
                                <th style={styles.th}>TIPO / STATUS</th>
                                <th style={styles.th}>DT</th>
                                <th style={styles.th}>COLETA</th>
                                <th style={styles.th}>ENTREGA</th>
                                <th style={styles.th}>INFO</th>
                                <th style={styles.th}>MOTORISTA</th>
                                <th style={styles.th}>AÇÕES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cargas.map(item => (
                                <tr key={item.id} style={styles.tr}>
                                    <td style={styles.td}>
                                        <span style={{fontSize: '9px', display: 'block', color: '#888', marginBottom: '4px'}}>{item.tipoViagem || 'CARREGADO'}</span>
                                        <div style={{
                                            ...styles.statusBadge, 
                                            backgroundColor: item.status === 'AGUARDANDO PROGRAMAÇÃO' ? '#3d2b1f' : '#1b3d2b',
                                            color: item.status === 'AGUARDANDO PROGRAMAÇÃO' ? '#ff9f43' : '#2ecc71',
                                            border: `1px solid ${item.status === 'AGUARDANDO PROGRAMAÇÃO' ? '#ff9f43' : '#2ecc71'}`
                                        }}>
                                            {item.status === 'AGUARDANDO PROGRAMAÇÃO' ? 'AGUARDANDO' : 'PROGRAMADA'}
                                        </div>
                                    </td>
                                    <td style={styles.td}><span style={styles.dtText}>{item.dt}</span></td>
                                    <td style={styles.td}>
                                        <div style={styles.infoBlock}>
                                            <div style={styles.rowFlex}>
                                                <span style={styles.mainInfo}>{item.origemCliente}</span>
                                                {item.origemLink && <a href={item.origemLink} target="_blank" rel="noreferrer" style={styles.mapBtn}><MapPin size={12}/></a>}
                                            </div>
                                            <span style={styles.cityHighlight}>{item.origemCidade}</span>
                                        </div>
                                    </td>
                                    <td style={styles.td}>
                                        <div style={styles.infoBlock}>
                                            <div style={styles.rowFlex}>
                                                <span style={styles.mainInfo}>{item.destinoCliente}</span>
                                                {item.destinoLink && <a href={item.destinoLink} target="_blank" rel="noreferrer" style={styles.mapBtn}><MapPin size={12}/></a>}
                                            </div>
                                            <span style={styles.cityHighlight}>{item.destinoCidade}</span>
                                        </div>
                                    </td>
                                    <td style={styles.td}>
                                        <div style={styles.infoBlock}>
                                            <span style={{color: '#fff', fontWeight: 'bold'}}>{item.peso || '--'}</span>
                                            <span style={{color: '#888', fontSize: '11px'}}>{item.perfilVeiculo || 'N/A'}</span>
                                        </div>
                                    </td>
                                    <td style={styles.td}>
                                        {item.motorista ? (
                                            <div style={styles.motoristaBox}>
                                                <Truck size={14} /> {item.motorista.toUpperCase()}
                                            </div>
                                        ) : <span style={{color: '#444'}}>Livre</span>}
                                    </td>
                                    <td style={styles.td}>
                                        <div style={styles.actionGroup}>
                                            <button onClick={() => handleAbrirAcoes(item)} style={styles.circleBtn}>
                                                <UserPlus size={16} />
                                            </button>
                                            <button onClick={() => handleExcluirCarga(item.id)} style={{...styles.circleBtn, backgroundColor: '#331111', color: '#ff4444'}}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {modalAberto && (
                <AcoesCargas 
                    cargaSelecionada={cargaParaAtribuir} 
                    onFechar={() => setModalAberto(false)}
                    onConfirmar={confirmarAtribuicao} 
                />
            )}
        </div>
    );
};

const styles = {
    container: { padding: '25px', color: '#FFF', backgroundColor: '#050505', minHeight: '100vh', fontFamily: 'sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
    titulo: { color: '#FFD700', fontSize: '20px', fontWeight: 'bold' },
    statsBadge: { color: '#666', fontSize: '12px' },
    tipoViagemSelector: { display: 'flex', gap: '10px', marginBottom: '15px' },
    tipoBtn: { 
        flex: 1, padding: '12px', border: 'none', borderRadius: '4px', cursor: 'pointer', 
        fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        transition: '0.3s'
    },
    cardForm: { backgroundColor: '#111', padding: '20px', borderRadius: '8px', border: '1px solid #222', marginBottom: '20px' },
    gridForm: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' },
    formColumn: { display: 'flex', flexDirection: 'column', gap: '10px' },
    columnTitle: { fontSize: '12px', color: '#FFD700', borderBottom: '1px solid #222', paddingBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' },
    input: { backgroundColor: '#000', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '4px', fontSize: '13px', outline: 'none' },
    dateTimeWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
    dateTimeIcon: { position: 'absolute', left: '10px', color: '#FFD700', pointerEvents: 'none' },
    inputDate: { 
        backgroundColor: '#000', border: '1px solid #333', color: '#FFF', padding: '10px 10px 10px 35px', 
        borderRadius: '4px', fontSize: '13px', width: '100%', cursor: 'pointer', outline: 'none',
        colorScheme: 'dark' 
    },
    textarea: { width: '100%', backgroundColor: '#000', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '4px', marginTop: '15px', minHeight: '60px', outline: 'none' },
    btnSalvar: { width: '100%', backgroundColor: '#FFD700', border: 'none', padding: '15px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px', marginTop: '10px' },
    cardLista: { backgroundColor: '#111', borderRadius: '8px', border: '1px solid #222' },
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '12px', fontSize: '11px', color: '#555', borderBottom: '2px solid #222', textAlign: 'left' },
    td: { padding: '12px', borderBottom: '1px solid #1a1a1a', verticalAlign: 'top' },
    tr: { transition: '0.2s' },
    infoBlock: { display: 'flex', flexDirection: 'column', gap: '3px' },
    rowFlex: { display: 'flex', alignItems: 'center', gap: '8px' },
    mainInfo: { fontWeight: 'bold', fontSize: '13px' },
    cityHighlight: { color: '#FFD700', fontSize: '11px', fontWeight: 'bold' },
    mapBtn: { backgroundColor: '#222', color: '#FF9F43', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' },
    dtText: { color: '#FFF', fontSize: '11px', fontWeight: 'bold' },
    statusBadge: { padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' },
    motoristaBox: { color: '#2ecc71', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' },
    actionGroup: { display: 'flex', gap: '10px', alignItems: 'center' },
    circleBtn: { backgroundColor: '#FFD700', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

export default PainelCargas;