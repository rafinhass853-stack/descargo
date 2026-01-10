import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy, where, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { 
    History, Search, User, ArrowRight, ChevronDown, ChevronUp, 
    Image as ImageIcon, Trash2, X, Calendar as CalendarIcon, Pencil, Save, Clock,
    MapPin, Truck, Package, CheckCircle, AlertCircle, FileText, Timer, Play, StopCircle
} from 'lucide-react';

const HistoricoViagens = () => {
    const [viagens, setViagens] = useState([]);
    const [filtroNome, setFiltroNome] = useState('');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [abaAtiva, setAbaAtiva] = useState('ativas');
    const [motoristasExpandidos, setMotoristasExpandidos] = useState({});
    const [imagemModal, setImagemModal] = useState(null);
    const [editandoCarga, setEditandoCarga] = useState(null);
    const [detalhesModal, setDetalhesModal] = useState(null);
    const [notificacao, setNotificacao] = useState(null);

    // Mostrar notificação temporária
    const mostrarNotificacao = (mensagem, tipo = 'info') => {
        setNotificacao({ mensagem, tipo });
        setTimeout(() => setNotificacao(null), 3000);
    };

    // Converter datas do Firebase para input
    const paraInputDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toISOString().split('T')[0];
    };

    const paraInputDateTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toISOString().slice(0, 16);
    };

    const paraFirebaseDateTime = (dateString) => {
        if (!dateString) return null;
        return new Date(dateString);
    };

    // Calcular tempo decorrido
    const calcularTempoDecorrido = (inicio, fim) => {
        if (!inicio || !fim) return '00:00:00';
        
        try {
            const [dataInicio, horaInicio] = inicio.split(' ');
            const [dataFim, horaFim] = fim.split(' ');
            
            const [diaI, mesI, anoI] = dataInicio.split('/');
            const [horaI, minI] = horaInicio.split(':');
            
            const [diaF, mesF, anoF] = dataFim.split('/');
            const [horaF, minF] = horaFim.split(':');
            
            const dataInicioObj = new Date(anoI, mesI - 1, diaI, horaI, minI);
            const dataFimObj = new Date(anoF, mesF - 1, diaF, horaF, minF);
            
            const diffMs = dataFimObj - dataInicioObj;
            const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const diffSegundos = Math.floor((diffMs % (1000 * 60)) / 1000);
            
            return `${diffHoras.toString().padStart(2, '0')}:${diffMinutos.toString().padStart(2, '0')}:${diffSegundos.toString().padStart(2, '0')}`;
        } catch (error) {
            return '00:00:00';
        }
    };

    // Carregar dados do Firestore
    useEffect(() => {
        const q = query(
            collection(db, "ordens_servico"), 
            orderBy("criadoEm", "desc")
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                const dados = doc.data();
                
                // Calcular lead time se houver dados
                let leadTimeTotal = '00:00:00';
                let leadTimeColeta = '00:00:00';
                let leadTimeEntrega = '00:00:00';
                
                if (dados.leadTimeColetaInicio && dados.leadTimeColetaFim) {
                    leadTimeColeta = calcularTempoDecorrido(dados.leadTimeColetaInicio, dados.leadTimeColetaFim);
                }
                
                if (dados.leadTimeEntregaInicio && dados.leadTimeEntregaFim) {
                    leadTimeEntrega = calcularTempoDecorrido(dados.leadTimeEntregaInicio, dados.leadTimeEntregaFim);
                }
                
                // Somar tempos (simplificado)
                if (dados.leadTimeTotal) {
                    leadTimeTotal = dados.leadTimeTotal;
                }
                
                // Verificar se tem canhoto e se precisa atualizar status
                if (dados.urlCanhoto && (!dados.chegouAoDestino || !dados.finalizada)) {
                    dados.chegouAoDestino = true;
                    dados.finalizada = true;
                }
                
                lista.push({ 
                    id: doc.id, 
                    ...dados,
                    leadTimeTotal,
                    leadTimeColeta,
                    leadTimeEntrega,
                    // Garantir que os campos de data são objetos Date para filtro
                    dataColetaObj: dados.dataColeta ? (dados.dataColeta.toDate ? dados.dataColeta.toDate() : new Date(dados.dataColeta)) : null,
                    dataEntregaObj: dados.dataEntrega ? (dados.dataEntrega.toDate ? dados.dataEntrega.toDate() : new Date(dados.dataEntrega)) : null,
                    criadoEmObj: dados.criadoEm ? (dados.criadoEm.toDate ? dados.criadoEm.toDate() : new Date(dados.criadoEm)) : null
                });
            });
            setViagens(lista);
        });
        
        return () => unsubscribe();
    }, []);

    // Filtros combinados
    const viagensFiltradas = viagens.filter(v => {
        // Filtro por status (ativa/finalizada)
        const isFinalizada = v.chegouAoDestino === true || v.finalizada === true || v.urlCanhoto;
        if (abaAtiva === 'finalizadas' && !isFinalizada) return false;
        if (abaAtiva === 'ativas' && isFinalizada) return false;
        
        // Filtro por nome do motorista
        const bateNome = v.motoristaNome?.toLowerCase().includes(filtroNome.toLowerCase()) || 
                         v.cavalo?.toLowerCase().includes(filtroNome.toLowerCase()) ||
                         v.carreta?.toLowerCase().includes(filtroNome.toLowerCase());
        
        // Filtro por data
        if (dataInicio || dataFim) {
            const dataColeta = v.dataColetaObj || v.criadoEmObj;
            if (!dataColeta) return false;
            
            const dataViagem = new Date(dataColeta);
            
            if (dataInicio) {
                const inicio = new Date(dataInicio);
                inicio.setHours(0, 0, 0, 0);
                if (dataViagem < inicio) return false;
            }
            
            if (dataFim) {
                const fim = new Date(dataFim);
                fim.setHours(23, 59, 59, 999);
                if (dataViagem > fim) return false;
            }
        }
        
        return bateNome;
    });

    // Agrupar por motorista
    const viagensAgrupadas = viagensFiltradas.reduce((acc, v) => {
        const nome = v.motoristaNome || "Não identificado";
        if (!acc[nome]) acc[nome] = [];
        acc[nome].push(v);
        return acc;
    }, {});

    // Salvar alterações
    const salvarAlteracoes = async () => {
        if (!editandoCarga) return;
        
        try {
            const ref = doc(db, "ordens_servico", editandoCarga.id);
            let dadosAtualizados = {
                ...editandoCarga,
                dataColeta: editandoCarga.dataColeta ? paraFirebaseDateTime(editandoCarga.dataColeta) : null,
                dataEntrega: editandoCarga.dataEntrega ? paraFirebaseDateTime(editandoCarga.dataEntrega) : null,
                atualizadoEm: new Date()
            };
            
            // Remover campos calculados
            delete dadosAtualizados.leadTimeTotal;
            delete dadosAtualizados.leadTimeColeta;
            delete dadosAtualizados.leadTimeEntrega;
            delete dadosAtualizados.dataColetaObj;
            delete dadosAtualizados.dataEntregaObj;
            delete dadosAtualizados.criadoEmObj;
            
            // Verificar se foi adicionado um canhoto
            const tinhaCanhotoAntes = viagens.find(v => v.id === editandoCarga.id)?.urlCanhoto;
            const temCanhotoAgora = editandoCarga.urlCanhoto;
            
            // Se adicionou um canhoto, finalizar automaticamente
            if (temCanhotoAgora && !tinhaCanhotoAntes) {
                dadosAtualizados = {
                    ...dadosAtualizados,
                    chegouAoDestino: true,
                    finalizada: true,
                    dataFinalizacao: new Date()
                };
                mostrarNotificacao('Viagem finalizada automaticamente com o canhoto!', 'success');
            }
            
            await updateDoc(ref, dadosAtualizados);
            setEditandoCarga(null);
            mostrarNotificacao("OS atualizada com sucesso!", 'success');
        } catch (e) { 
            console.error("Erro ao salvar:", e);
            mostrarNotificacao("Erro ao salvar alterações.", 'error'); 
        }
    };

    // Função para abrir modal de imagem do canhoto
    const abrirModalCanhoto = async (viagem) => {
        setImagemModal({
            url: viagem.urlCanhoto,
            viagemId: viagem.id,
            viagemNome: viagem.motoristaNome || 'Viagem'
        });
    };

    // Modal de detalhes
    const abrirModalDetalhes = (viagem) => {
        setDetalhesModal(viagem);
    };

    // Renderizar notificação
    const renderNotificacao = () => {
        if (!notificacao) return null;
        
        const estilo = {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            borderRadius: '8px',
            background: notificacao.tipo === 'success' ? '#16a34a' : 
                       notificacao.tipo === 'error' ? '#e74c3c' : '#3498db',
            color: '#fff',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        };
        
        return (
            <div style={estilo}>
                {notificacao.tipo === 'success' ? <CheckCircle size={20} /> : 
                 notificacao.tipo === 'error' ? <AlertCircle size={20} /> : 
                 <AlertCircle size={20} />}
                <span>{notificacao.mensagem}</span>
            </div>
        );
    };

    // Renderizar status do lead time
    const renderStatusLeadTime = (viagem, tipo) => {
        const inicio = tipo === 'coleta' ? viagem.leadTimeColetaInicio : viagem.leadTimeEntregaInicio;
        const fim = tipo === 'coleta' ? viagem.leadTimeColetaFim : viagem.leadTimeEntregaFim;
        
        if (!inicio && !fim) {
            return <span style={{...styles.leadTimeStatus, color: '#666'}}>NÃO INICIADO</span>;
        }
        
        if (inicio && !fim) {
            return (
                <span style={{...styles.leadTimeStatus, color: '#FFD700', background: 'rgba(255, 215, 0, 0.1)'}}>
                    <Play size={10} /> EM ANDAMENTO
                </span>
            );
        }
        
        if (inicio && fim) {
            const tempo = tipo === 'coleta' ? viagem.leadTimeColeta : viagem.leadTimeEntrega;
            return (
                <span style={{...styles.leadTimeStatus, color: '#2ecc71', background: 'rgba(46, 204, 113, 0.1)'}}>
                    <StopCircle size={10} /> CONCLUÍDO ({tempo})
                </span>
            );
        }
        
        return null;
    };

    return (
        <div style={styles.container}>
            {/* NOTIFICAÇÃO */}
            {renderNotificacao()}
            
            {/* HEADER */}
            <header style={styles.header}>
                <div>
                    <h2 style={styles.title}>
                        <History size={28} color="#FFD700" /> 
                        <span>DESCARGO</span>
                    </h2>
                    <p style={styles.subtitle}>Histórico de Viagens com Lead Time</p>
                </div>
                <div style={styles.AbasContainer}>
                    <button 
                        onClick={() => setAbaAtiva('ativas')} 
                        style={{
                            ...styles.abaBtn, 
                            backgroundColor: abaAtiva === 'ativas' ? '#FFD700' : 'transparent',
                            color: abaAtiva === 'ativas' ? '#000' : '#666',
                            border: `1px solid ${abaAtiva === 'ativas' ? '#FFD700' : '#333'}`
                        }}
                    >
                        <Truck size={14} /> ATIVAS
                    </button>
                    <button 
                        onClick={() => setAbaAtiva('finalizadas')} 
                        style={{
                            ...styles.abaBtn, 
                            backgroundColor: abaAtiva === 'finalizadas' ? '#16a34a' : 'transparent',
                            color: abaAtiva === 'finalizadas' ? '#fff' : '#666',
                            border: `1px solid ${abaAtiva === 'finalizadas' ? '#16a34a' : '#333'}`
                        }}
                    >
                        <CheckCircle size={14} /> FINALIZADAS
                    </button>
                </div>
            </header>

            {/* BARRA DE FILTROS */}
            <div style={styles.filterSection}>
                <div style={styles.filterGrid}>
                    <div style={styles.searchBar}>
                        <Search size={18} color="#555" />
                        <input 
                            placeholder="Buscar motorista, cavalo ou carreta..." 
                            style={styles.searchInput}
                            value={filtroNome}
                            onChange={(e) => setFiltroNome(e.target.value)}
                        />
                    </div>
                    
                    <div style={styles.dateFilters}>
                        <div style={styles.dateInputGroup}>
                            <CalendarIcon size={16} />
                            <input 
                                type="date" 
                                style={styles.dateInput}
                                value={dataInicio}
                                onChange={(e) => setDataInicio(e.target.value)}
                            />
                            <span style={styles.dateLabel}>De</span>
                        </div>
                        
                        <div style={styles.dateInputGroup}>
                            <CalendarIcon size={16} />
                            <input 
                                type="date" 
                                style={styles.dateInput}
                                value={dataFim}
                                onChange={(e) => setDataFim(e.target.value)}
                            />
                            <span style={styles.dateLabel}>Até</span>
                        </div>
                        
                        <button 
                            style={styles.btnLimparFiltros}
                            onClick={() => {
                                setDataInicio('');
                                setDataFim('');
                                setFiltroNome('');
                            }}
                        >
                            Limpar filtros
                        </button>
                    </div>
                </div>
                
                <div style={styles.resumoContainer}>
                    <div style={styles.resumoItem}>
                        <span style={styles.resumoLabel}>Total de Viagens:</span>
                        <span style={styles.resumoValor}>{viagensFiltradas.length}</span>
                    </div>
                    <div style={styles.resumoItem}>
                        <span style={styles.resumoLabel}>Motoristas:</span>
                        <span style={styles.resumoValor}>{Object.keys(viagensAgrupadas).length}</span>
                    </div>
                    <div style={styles.resumoItem}>
                        <span style={styles.resumoLabel}>Com Lead Time:</span>
                        <span style={styles.resumoValor}>
                            {viagensFiltradas.filter(v => v.leadTimeColetaInicio || v.leadTimeEntregaInicio).length}
                        </span>
                    </div>
                </div>
            </div>

            {/* LISTA DE VIAGENS AGRUPADAS POR MOTORISTA */}
            <div style={styles.listaContainer}>
                {Object.keys(viagensAgrupadas).length === 0 ? (
                    <div style={styles.emptyState}>
                        <Package size={48} color="#666" />
                        <p>Nenhuma viagem encontrada com os filtros atuais.</p>
                    </div>
                ) : (
                    Object.keys(viagensAgrupadas).map(nome => (
                        <div key={nome} style={styles.cardMotorista}>
                            <div 
                                style={styles.motoristaHeader} 
                                onClick={() => setMotoristasExpandidos(p => ({...p, [nome]: !p[nome]}))}
                            >
                                <div style={styles.motoristaInfo}>
                                    <div style={styles.avatar}>
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <h3 style={styles.nomeMot}>{nome.toUpperCase()}</h3>
                                        <p style={styles.motoristaDetalhes}>
                                            {viagensAgrupadas[nome][0]?.cavalo && `Cavalo: ${viagensAgrupadas[nome][0].cavalo}`}
                                            {viagensAgrupadas[nome][0]?.carreta && ` | Carreta: ${viagensAgrupadas[nome][0].carreta}`}
                                        </p>
                                    </div>
                                </div>
                                <div style={styles.motoristaStats}>
                                    <span style={styles.statBadge}>
                                        {viagensAgrupadas[nome].length} {viagensAgrupadas[nome].length === 1 ? 'VIAGEM' : 'VIAGENS'}
                                    </span>
                                    {motoristasExpandidos[nome] ? <ChevronUp color="#FFD700" /> : <ChevronDown color="#FFD700" />}
                                </div>
                            </div>

                            {motoristasExpandidos[nome] && (
                                <div style={styles.detalhesViagens}>
                                    {viagensAgrupadas[nome].map((v) => {
                                        const isFinalizada = v.chegouAoDestino === true || v.finalizada === true || v.urlCanhoto;
                                        const temCanhoto = !!v.urlCanhoto;
                                        const temLeadTime = v.leadTimeColetaInicio || v.leadTimeEntregaInicio;
                                        
                                        return (
                                            <div key={v.id} style={styles.viagemItem}>
                                                <div style={styles.viagemMain}>
                                                    {/* ORIGEM */}
                                                    <div style={styles.infoPonto}>
                                                        <div style={styles.tagContainer}>
                                                            <span style={styles.tagOrigem}>
                                                                <MapPin size={10} /> COLETA
                                                            </span>
                                                            {v.confirmaceoPendente && (
                                                                <span style={styles.tagAtencao}>
                                                                    <AlertCircle size={10} /> PENDENTE
                                                                </span>
                                                            )}
                                                            {temCanhoto && (
                                                                <span style={styles.tagCanhoto}>
                                                                    <CheckCircle size={10} /> CANHOTO
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={styles.cidadeText}>{v.cidadeColeta || v.origemCidade}</div>
                                                        <div style={styles.clienteSubText}>{v.clienteColeta}</div>
                                                        <div style={styles.dataText}>
                                                            <Clock size={12}/> 
                                                            {v.dataColeta ? paraInputDateTime(v.dataColeta).replace('T', ' ') : '--/--/-- --:--'}
                                                        </div>
                                                        
                                                        {/* LEAD TIME COLETA */}
                                                        <div style={styles.leadTimeInfo}>
                                                            <Timer size={10} />
                                                            <span style={styles.leadTimeLabel}>Lead Time:</span>
                                                            {renderStatusLeadTime(v, 'coleta')}
                                                        </div>
                                                        
                                                        {v.leadTimeColetaInicio && (
                                                            <div style={styles.leadTimeDetails}>
                                                                <div style={styles.leadTimeDetail}>
                                                                    <span style={styles.leadTimeDetailLabel}>Chegada:</span>
                                                                    <span style={styles.leadTimeDetailValue}>{v.leadTimeColetaInicio}</span>
                                                                </div>
                                                                {v.leadTimeColetaFim && (
                                                                    <div style={styles.leadTimeDetail}>
                                                                        <span style={styles.leadTimeDetailLabel}>Saída:</span>
                                                                        <span style={styles.leadTimeDetailValue}>{v.leadTimeColetaFim}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <ArrowRight size={20} color="#FFD700" style={styles.arrowIcon} />

                                                    {/* DESTINO */}
                                                    <div style={styles.infoPonto}>
                                                        <div style={styles.tagContainer}>
                                                            <span style={styles.tagDestino}>
                                                                <MapPin size={10} /> ENTREGA
                                                            </span>
                                                        </div>
                                                        <div style={styles.cidadeText}>{v.cidadeDestino || v.destinoCidade}</div>
                                                        <div style={styles.clienteSubText}>{v.clienteEntrega}</div>
                                                        <div style={styles.dataText}>
                                                            <Clock size={12}/> 
                                                            {v.dataEntrega ? paraInputDateTime(v.dataEntrega).replace('T', ' ') : '--/--/-- --:--'}
                                                        </div>
                                                        
                                                        {/* LEAD TIME ENTREGA */}
                                                        <div style={styles.leadTimeInfo}>
                                                            <Timer size={10} />
                                                            <span style={styles.leadTimeLabel}>Lead Time:</span>
                                                            {renderStatusLeadTime(v, 'entrega')}
                                                        </div>
                                                        
                                                        {v.leadTimeEntregaInicio && (
                                                            <div style={styles.leadTimeDetails}>
                                                                <div style={styles.leadTimeDetail}>
                                                                    <span style={styles.leadTimeDetailLabel}>Chegada:</span>
                                                                    <span style={styles.leadTimeDetailValue}>{v.leadTimeEntregaInicio}</span>
                                                                </div>
                                                                {v.leadTimeEntregaFim && (
                                                                    <div style={styles.leadTimeDetail}>
                                                                        <span style={styles.leadTimeDetailLabel}>Saída:</span>
                                                                        <span style={styles.leadTimeDetailValue}>{v.leadTimeEntregaFim}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* STATUS E AÇÕES */}
                                                    <div style={styles.infoStatus}>
                                                        <div style={styles.acoesContainer}>
                                                            <button 
                                                                onClick={() => abrirModalDetalhes(v)}
                                                                style={styles.btnIcon}
                                                                title="Ver detalhes"
                                                            >
                                                                <FileText size={16} color="#3498db"/>
                                                            </button>
                                                            <button 
                                                                onClick={() => setEditandoCarga(v)}
                                                                style={styles.btnIcon}
                                                                title="Editar"
                                                            >
                                                                <Pencil size={16} color="#FFD700"/>
                                                            </button>
                                                            <button 
                                                                onClick={async () => {
                                                                    if (window.confirm("Tem certeza que deseja excluir esta viagem?")) {
                                                                        await deleteDoc(doc(db, "ordens_servico", v.id));
                                                                        mostrarNotificacao('Viagem excluída com sucesso!', 'success');
                                                                    }
                                                                }} 
                                                                style={styles.btnIcon}
                                                                title="Excluir"
                                                            >
                                                                <Trash2 size={16} color="#e74c3c" />
                                                            </button>
                                                        </div>
                                                        
                                                        {/* LEAD TIME TOTAL */}
                                                        {(v.leadTimeTotal && v.leadTimeTotal !== '00:00:00') && (
                                                            <div style={styles.leadTimeTotalBadge}>
                                                                <Timer size={12} />
                                                                <span style={styles.leadTimeTotalText}>
                                                                    TOTAL: {v.leadTimeTotal}
                                                                </span>
                                                            </div>
                                                        )}
                                                        
                                                        <div style={{
                                                            ...styles.statusBadge,
                                                            backgroundColor: isFinalizada ? '#16a34a' : '#ca8a04',
                                                            border: temCanhoto ? '2px solid #FFD700' : 'none'
                                                        }}>
                                                            {temCanhoto ? 'FINALIZADA (CANHOTO)' : 
                                                             isFinalizada ? 'FINALIZADA' : 'EM CURSO'}
                                                        </div>
                                                        
                                                        {/* BOTÃO PARA VER CANHOTO */}
                                                        {v.urlCanhoto && (
                                                            <button 
                                                                onClick={() => abrirModalCanhoto(v)}
                                                                style={styles.btnCanhoto}
                                                            >
                                                                <ImageIcon size={14}/> Ver Canhoto
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* INFO ADICIONAL */}
                                                <div style={styles.viagemExtra}>
                                                    <div style={styles.extraItem}>
                                                        <span style={styles.extraLabel}>Cavalo:</span>
                                                        <span style={styles.extraValue}>{v.cavalo || 'S/ PLACA'}</span>
                                                    </div>
                                                    <div style={styles.extraItem}>
                                                        <span style={styles.extraLabel}>Carreta:</span>
                                                        <span style={styles.extraValue}>{v.carreta || '--'}</span>
                                                    </div>
                                                    <div style={styles.extraItem}>
                                                        <span style={styles.extraLabel}>Criado em:</span>
                                                        <span style={styles.extraValue}>
                                                            {v.criadoEm ? paraInputDateTime(v.criadoEm).replace('T', ' ') : '--/--/-- --:--'}
                                                        </span>
                                                    </div>
                                                    {temLeadTime && (
                                                        <div style={styles.extraItem}>
                                                            <span style={styles.extraLabel}>Lead Time:</span>
                                                            <span style={{...styles.extraValue, color: '#FFD700', fontWeight: 'bold'}}>
                                                                {v.leadTimeTotal || 'Em andamento'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* MODAL DE DETALHES */}
            {detalhesModal && (
                <div style={styles.overlay}>
                    <div style={styles.modalDetalhes}>
                        <div style={styles.modalHeader}>
                            <div>
                                <h3 style={styles.modalTitle}>
                                    <FileText size={20} /> DETALHES DA ORDEM DE SERVIÇO
                                </h3>
                                <p style={styles.modalSubtitle}>ID: {detalhesModal.id}</p>
                            </div>
                            <button 
                                onClick={() => setDetalhesModal(null)}
                                style={styles.btnClose}
                            >
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div style={styles.modalContent}>
                            {/* INFORMAÇÕES PRINCIPAIS */}
                            <div style={styles.modalSection}>
                                <h4 style={styles.sectionTitle}>
                                    <Truck size={16} /> INFORMAÇÕES DA VIAGEM
                                </h4>
                                <div style={styles.infoGrid}>
                                    <div style={styles.infoItem}>
                                        <span style={styles.infoLabel}>Motorista:</span>
                                        <span style={styles.infoValue}>{detalhesModal.motoristaNome || 'Não informado'}</span>
                                    </div>
                                    <div style={styles.infoItem}>
                                        <span style={styles.infoLabel}>Cavalo:</span>
                                        <span style={styles.infoValue}>{detalhesModal.cavalo || 'S/ PLACA'}</span>
                                    </div>
                                    <div style={styles.infoItem}>
                                        <span style={styles.infoLabel}>Carreta:</span>
                                        <span style={styles.infoValue}>{detalhesModal.carreta || '--'}</span>
                                    </div>
                                    <div style={styles.infoItem}>
                                        <span style={styles.infoLabel}>Status:</span>
                                        <span style={{
                                            ...styles.infoValue,
                                            color: detalhesModal.chegouAoDestino || detalhesModal.urlCanhoto ? '#16a34a' : '#ca8a04',
                                            fontWeight: 'bold'
                                        }}>
                                            {detalhesModal.urlCanhoto ? 'FINALIZADA (COM CANHOTO)' : 
                                             detalhesModal.chegouAoDestino ? 'FINALIZADA' : 'EM ANDAMENTO'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* LEAD TIME */}
                            {(detalhesModal.leadTimeColetaInicio || detalhesModal.leadTimeEntregaInicio) && (
                                <div style={styles.modalSection}>
                                    <h4 style={styles.sectionTitle}>
                                        <Timer size={16} /> LEAD TIME
                                    </h4>
                                    <div style={styles.leadTimeModalContainer}>
                                        {/* COLETA */}
                                        {detalhesModal.leadTimeColetaInicio && (
                                            <div style={styles.leadTimeModalBox}>
                                                <h5 style={styles.leadTimeModalTitle}>
                                                    <MapPin size={14} /> COLETA
                                                </h5>
                                                <div style={styles.leadTimeModalDetails}>
                                                    <div style={styles.leadTimeModalRow}>
                                                        <span style={styles.leadTimeModalLabel}>Chegada:</span>
                                                        <span style={styles.leadTimeModalValue}>{detalhesModal.leadTimeColetaInicio}</span>
                                                    </div>
                                                    <div style={styles.leadTimeModalRow}>
                                                        <span style={styles.leadTimeModalLabel}>Saída:</span>
                                                        <span style={styles.leadTimeModalValue}>
                                                            {detalhesModal.leadTimeColetaFim || 'Em andamento'}
                                                        </span>
                                                    </div>
                                                    {detalhesModal.leadTimeColeta && detalhesModal.leadTimeColeta !== '00:00:00' && (
                                                        <div style={styles.leadTimeModalRow}>
                                                            <span style={styles.leadTimeModalLabel}>Tempo:</span>
                                                            <span style={{...styles.leadTimeModalValue, color: '#FFD700', fontWeight: 'bold'}}>
                                                                {detalhesModal.leadTimeColeta}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* ENTREGA */}
                                        {detalhesModal.leadTimeEntregaInicio && (
                                            <div style={styles.leadTimeModalBox}>
                                                <h5 style={styles.leadTimeModalTitle}>
                                                    <MapPin size={14} /> ENTREGA
                                                </h5>
                                                <div style={styles.leadTimeModalDetails}>
                                                    <div style={styles.leadTimeModalRow}>
                                                        <span style={styles.leadTimeModalLabel}>Chegada:</span>
                                                        <span style={styles.leadTimeModalValue}>{detalhesModal.leadTimeEntregaInicio}</span>
                                                    </div>
                                                    <div style={styles.leadTimeModalRow}>
                                                        <span style={styles.leadTimeModalLabel}>Saída:</span>
                                                        <span style={styles.leadTimeModalValue}>
                                                            {detalhesModal.leadTimeEntregaFim || 'Em andamento'}
                                                        </span>
                                                    </div>
                                                    {detalhesModal.leadTimeEntrega && detalhesModal.leadTimeEntrega !== '00:00:00' && (
                                                        <div style={styles.leadTimeModalRow}>
                                                            <span style={styles.leadTimeModalLabel}>Tempo:</span>
                                                            <span style={{...styles.leadTimeModalValue, color: '#FFD700', fontWeight: 'bold'}}>
                                                                {detalhesModal.leadTimeEntrega}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* TOTAL */}
                                        {detalhesModal.leadTimeTotal && detalhesModal.leadTimeTotal !== '00:00:00' && (
                                            <div style={styles.leadTimeTotalModal}>
                                                <Timer size={18} />
                                                <span style={styles.leadTimeTotalModalText}>
                                                    LEAD TIME TOTAL: {detalhesModal.leadTimeTotal}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {/* TRAJETO */}
                            <div style={styles.modalSection}>
                                <h4 style={styles.sectionTitle}>
                                    <MapPin size={16} /> TRAJETO
                                </h4>
                                <div style={styles.trajetoContainer}>
                                    <div style={styles.trajetoItem}>
                                        <div style={styles.trajetoHeader}>
                                            <div style={{...styles.trajetoIcon, backgroundColor: '#3498db'}}>
                                                <MapPin size={12} />
                                            </div>
                                            <h5 style={styles.trajetoTitle}>COLETA</h5>
                                        </div>
                                        <div style={styles.trajetoContent}>
                                            <p style={styles.trajetoCliente}>{detalhesModal.clienteColeta}</p>
                                            <p style={styles.trajetoCidade}>{detalhesModal.cidadeColeta || detalhesModal.origemCidade}</p>
                                            <p style={styles.trajetoData}>
                                                <Clock size={12} /> {detalhesModal.dataColeta ? paraInputDateTime(detalhesModal.dataColeta).replace('T', ' ') : '--/--/-- --:--'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <ArrowRight size={24} color="#FFD700" style={{margin: '0 20px', alignSelf: 'center'}} />
                                    
                                    <div style={styles.trajetoItem}>
                                        <div style={styles.trajetoHeader}>
                                            <div style={{...styles.trajetoIcon, backgroundColor: '#e67e22'}}>
                                                <MapPin size={12} />
                                            </div>
                                            <h5 style={styles.trajetoTitle}>ENTREGA</h5>
                                        </div>
                                        <div style={styles.trajetoContent}>
                                            <p style={styles.trajetoCliente}>{detalhesModal.clienteEntrega}</p>
                                            <p style={styles.trajetoCidade}>{detalhesModal.cidadeDestino || detalhesModal.destinoCidade}</p>
                                            <p style={styles.trajetoData}>
                                                <Clock size={12} /> {detalhesModal.dataEntrega ? paraInputDateTime(detalhesModal.dataEntrega).replace('T', ' ') : '--/--/-- --:--'}
                                            </p>
                                            {(detalhesModal.chegouAoDestino || detalhesModal.urlCanhoto) && detalhesModal.dataFinalizacao && (
                                                <p style={styles.trajetoFinalizado}>
                                                    <CheckCircle size={12} /> Finalizado em: {paraInputDateTime(detalhesModal.dataFinalizacao).replace('T', ' ')}
                                                    {detalhesModal.urlCanhoto && ' (com canhoto)'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* CANHOTO */}
                            {detalhesModal.urlCanhoto && (
                                <div style={styles.modalSection}>
                                    <h4 style={styles.sectionTitle}>
                                        <ImageIcon size={16} /> COMPROVANTE/CANHOTO
                                    </h4>
                                    <div style={styles.canhotoContainer}>
                                        <div style={styles.canhotoStatus}>
                                            <CheckCircle size={20} color="#16a34a" />
                                            <span style={styles.canhotoStatusText}>
                                                Esta viagem foi finalizada automaticamente com o envio do canhoto
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => abrirModalCanhoto(detalhesModal)}
                                            style={styles.btnVerCanhoto}
                                        >
                                            <ImageIcon size={18} /> VER CANHOTO COMPLETO
                                        </button>
                                        <p style={styles.canhotoInfo}>
                                            Clique para visualizar a imagem enviada pelo motorista
                                        </p>
                                    </div>
                                </div>
                            )}
                            
                            {/* METADADOS */}
                            <div style={styles.modalSection}>
                                <h4 style={styles.sectionTitle}>
                                    <CalendarIcon size={16} /> METADADOS
                                </h4>
                                <div style={styles.metadataGrid}>
                                    <div style={styles.metadataItem}>
                                        <span style={styles.metadataLabel}>Criado em:</span>
                                        <span style={styles.metadataValue}>
                                            {detalhesModal.criadoEm ? paraInputDateTime(detalhesModal.criadoEm).replace('T', ' ') : '--/--/-- --:--'}
                                        </span>
                                    </div>
                                    <div style={styles.metadataItem}>
                                        <span style={styles.metadataLabel}>Atualizado em:</span>
                                        <span style={styles.metadataValue}>
                                            {detalhesModal.atualizadoEm ? paraInputDateTime(detalhesModal.atualizadoEm).replace('T', ' ') : '--/--/-- --:--'}
                                        </span>
                                    </div>
                                    <div style={styles.metadataItem}>
                                        <span style={styles.metadataLabel}>Tem Canhoto:</span>
                                        <span style={{
                                            ...styles.metadataValue,
                                            color: detalhesModal.urlCanhoto ? '#16a34a' : '#e74c3c',
                                            fontWeight: 'bold'
                                        }}>
                                            {detalhesModal.urlCanhoto ? 'SIM' : 'NÃO'}
                                        </span>
                                    </div>
                                    {(detalhesModal.leadTimeColetaInicio || detalhesModal.leadTimeEntregaInicio) && (
                                        <div style={styles.metadataItem}>
                                            <span style={styles.metadataLabel}>Tem Lead Time:</span>
                                            <span style={{
                                                ...styles.metadataValue,
                                                color: '#FFD700',
                                                fontWeight: 'bold'
                                            }}>
                                                SIM
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div style={styles.modalFooter}>
                            <button 
                                onClick={() => {
                                    setEditandoCarga(detalhesModal);
                                    setDetalhesModal(null);
                                }}
                                style={styles.btnEditarModal}
                            >
                                <Pencil size={16} /> EDITAR OS
                            </button>
                            <button 
                                onClick={() => setDetalhesModal(null)}
                                style={styles.btnFecharModal}
                            >
                                FECHAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE EDIÇÃO */}
            {editandoCarga && (
                <div style={styles.overlay}>
                    <div style={styles.modalEdit}>
                        <div style={styles.modalEditHeader}>
                            <h3><Pencil size={18}/> EDITAR ORDEM DE SERVIÇO</h3>
                            <button onClick={() => setEditandoCarga(null)} style={styles.btnClose}><X /></button>
                        </div>
                        
                        <div style={styles.formGrid}>
                            {/* MOTORISTA E VEÍCULO */}
                            <h4 style={styles.formSectionTitle}><User size={14} /> MOTORISTA E VEÍCULO</h4>
                            <div style={styles.inputGroup}>
                                <label>MOTORISTA</label>
                                <input 
                                    value={editandoCarga.motoristaNome || ''} 
                                    onChange={e => setEditandoCarga({...editandoCarga, motoristaNome: e.target.value})} 
                                    style={styles.inputStyle} 
                                />
                            </div>
                            <div style={styles.inputGroup}>
                                <label>CAVALO</label>
                                <input 
                                    value={editandoCarga.cavalo || ''} 
                                    onChange={e => setEditandoCarga({...editandoCarga, cavalo: e.target.value})} 
                                    style={styles.inputStyle} 
                                />
                            </div>
                            <div style={styles.inputGroup}>
                                <label>CARRETA</label>
                                <input 
                                    value={editandoCarga.carreta || ''} 
                                    onChange={e => setEditandoCarga({...editandoCarga, carreta: e.target.value})} 
                                    style={styles.inputStyle} 
                                />
                            </div>

                            {/* COLETA */}
                            <h4 style={styles.formSectionTitle}><MapPin size={14} /> COLETA (ORIGEM)</h4>
                            <div style={{...styles.inputGroup, gridColumn: 'span 2'}}>
                                <label>CLIENTE COLETA</label>
                                <input 
                                    value={editandoCarga.clienteColeta || ''} 
                                    onChange={e => setEditandoCarga({...editandoCarga, clienteColeta: e.target.value})} 
                                    style={styles.inputStyle} 
                                />
                            </div>
                            <div style={styles.inputGroup}>
                                <label>CIDADE COLETA</label>
                                <input 
                                    value={editandoCarga.cidadeColeta || editandoCarga.origemCidade || ''} 
                                    onChange={e => setEditandoCarga({...editandoCarga, cidadeColeta: e.target.value})} 
                                    style={styles.inputStyle} 
                                />
                            </div>
                            <div style={styles.inputGroup}>
                                <label>DATA/HORA COLETA</label>
                                <input 
                                    type="datetime-local" 
                                    value={paraInputDateTime(editandoCarga.dataColeta)} 
                                    onChange={e => setEditandoCarga({...editandoCarga, dataColeta: e.target.value})} 
                                    style={styles.inputStyle} 
                                />
                            </div>

                            {/* LEAD TIME COLETA */}
                            <h4 style={styles.formSectionTitle}><Timer size={14} /> LEAD TIME COLETA</h4>
                            <div style={styles.inputGroup}>
                                <label>CHEGADA COLETA (dd/mm/aaaa hh:mm)</label>
                                <input 
                                    value={editandoCarga.leadTimeColetaInicio || ''} 
                                    onChange={e => setEditandoCarga({...editandoCarga, leadTimeColetaInicio: e.target.value})} 
                                    style={styles.inputStyle} 
                                    placeholder="01/01/2024 08:00"
                                />
                            </div>
                            <div style={styles.inputGroup}>
                                <label>SAÍDA COLETA (dd/mm/aaaa hh:mm)</label>
                                <input 
                                    value={editandoCarga.leadTimeColetaFim || ''} 
                                    onChange={e => setEditandoCarga({...editandoCarga, leadTimeColetaFim: e.target.value})} 
                                    style={styles.inputStyle} 
                                    placeholder="01/01/2024 10:30"
                                />
                            </div>

                            {/* ENTREGA */}
                            <h4 style={styles.formSectionTitle}><MapPin size={14} /> ENTREGA (DESTINO)</h4>
                            <div style={{...styles.inputGroup, gridColumn: 'span 2'}}>
                                <label>CLIENTE ENTREGA</label>
                                <input 
                                    value={editandoCarga.clienteEntrega || ''} 
                                    onChange={e => setEditandoCarga({...editandoCarga, clienteEntrega: e.target.value})} 
                                    style={styles.inputStyle} 
                                />
                            </div>
                            <div style={styles.inputGroup}>
                                <label>CIDADE DESTINO</label>
                                <input 
                                    value={editandoCarga.cidadeDestino || editandoCarga.destinoCidade || ''} 
                                    onChange={e => setEditandoCarga({...editandoCarga, cidadeDestino: e.target.value})} 
                                    style={styles.inputStyle} 
                                />
                            </div>
                            <div style={styles.inputGroup}>
                                <label>DATA/HORA ENTREGA</label>
                                <input 
                                    type="datetime-local" 
                                    value={paraInputDateTime(editandoCarga.dataEntrega)} 
                                    onChange={e => setEditandoCarga({...editandoCarga, dataEntrega: e.target.value})} 
                                    style={styles.inputStyle} 
                                />
                            </div>

                            {/* LEAD TIME ENTREGA */}
                            <h4 style={styles.formSectionTitle}><Timer size={14} /> LEAD TIME ENTREGA</h4>
                            <div style={styles.inputGroup}>
                                <label>CHEGADA ENTREGA (dd/mm/aaaa hh:mm)</label>
                                <input 
                                    value={editandoCarga.leadTimeEntregaInicio || ''} 
                                    onChange={e => setEditandoCarga({...editandoCarga, leadTimeEntregaInicio: e.target.value})} 
                                    style={styles.inputStyle} 
                                    placeholder="01/01/2024 14:00"
                                />
                            </div>
                            <div style={styles.inputGroup}>
                                <label>SAÍDA ENTREGA (dd/mm/aaaa hh:mm)</label>
                                <input 
                                    value={editandoCarga.leadTimeEntregaFim || ''} 
                                    onChange={e => setEditandoCarga({...editandoCarga, leadTimeEntregaFim: e.target.value})} 
                                    style={styles.inputStyle} 
                                    placeholder="01/01/2024 16:30"
                                />
                            </div>

                            {/* CANHOTO */}
                            <h4 style={styles.formSectionTitle}><ImageIcon size={14} /> CANHOTO</h4>
                            <div style={{...styles.inputGroup, gridColumn: 'span 2'}}>
                                <label>URL DO CANHOTO (Imagem)</label>
                                <input 
                                    value={editandoCarga.urlCanhoto || ''} 
                                    onChange={e => setEditandoCarga({...editandoCarga, urlCanhoto: e.target.value})} 
                                    style={styles.inputStyle} 
                                    placeholder="Cole a URL da imagem do canhoto"
                                />
                                <small style={styles.helperText}>
                                    {editandoCarga.urlCanhoto && !viagens.find(v => v.id === editandoCarga.id)?.urlCanhoto ? 
                                     "⚠️ Ao adicionar um canhoto, esta viagem será automaticamente finalizada!" : 
                                     "Adicione a URL da imagem do canhoto para finalizar a viagem"}
                                </small>
                            </div>

                            {/* STATUS */}
                            <h4 style={styles.formSectionTitle}><CheckCircle size={14} /> STATUS</h4>
                            <div style={styles.inputGroup}>
                                <label>CHEGOU AO DESTINO?</label>
                                <select 
                                    value={editandoCarga.chegouAoDestino ? 'true' : 'false'}
                                    onChange={e => setEditandoCarga({...editandoCarga, chegouAoDestino: e.target.value === 'true'})}
                                    style={styles.inputStyle}
                                    disabled={!!editandoCarga.urlCanhoto}
                                >
                                    <option value="false">NÃO (EM CURSO)</option>
                                    <option value="true">SIM (FINALIZADA)</option>
                                </select>
                                {editandoCarga.urlCanhoto && (
                                    <small style={styles.helperText}>
                                        Status bloqueado porque tem canhoto (finalizada automaticamente)
                                    </small>
                                )}
                            </div>
                            <div style={styles.inputGroup}>
                                <label>CONFIRMAÇÃO PENDENTE?</label>
                                <select 
                                    value={editandoCarga.confirmaceoPendente ? 'true' : 'false'}
                                    onChange={e => setEditandoCarga({...editandoCarga, confirmaceoPendente: e.target.value === 'true'})}
                                    style={styles.inputStyle}
                                >
                                    <option value="false">NÃO</option>
                                    <option value="true">SIM</option>
                                </select>
                            </div>
                        </div>

                        <div style={styles.modalEditFooter}>
                            <button onClick={() => setEditandoCarga(null)} style={styles.btnCancelar}>
                                CANCELAR
                            </button>
                            <button onClick={salvarAlteracoes} style={styles.btnSalvar}>
                                <Save size={18}/> SALVAR ALTERAÇÕES
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DA IMAGEM DO CANHOTO */}
            {imagemModal && (
                <div style={styles.overlayImagem}>
                    <div style={styles.modalImagemContainer}>
                        <div style={styles.modalImagemHeader}>
                            <div>
                                <h3><ImageIcon size={20} /> CANHOTO/COMPROVANTE</h3>
                                <p style={styles.imagemSubtitle}>
                                    {imagemModal.viagemNome} • {imagemModal.viagemId}
                                </p>
                            </div>
                            <button onClick={() => setImagemModal(null)} style={styles.btnClose}>
                                <X size={24} />
                            </button>
                        </div>
                        <div style={styles.modalImagemContent}>
                            <div style={styles.imagemStatus}>
                                <CheckCircle size={24} color="#16a34a" />
                                <span>Viagem finalizada com este canhoto</span>
                            </div>
                            <img 
                                src={imagemModal.url} 
                                alt="Canhoto" 
                                style={styles.imagemCanhoto}
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://via.placeholder.com/600x400/111/FFD700?text=Imagem+n%C3%A3o+dispon%C3%ADvel';
                                }}
                            />
                        </div>
                        <div style={styles.modalImagemFooter}>
                            <a 
                                href={imagemModal.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={styles.btnDownload}
                            >
                                ABRIR EM NOVA ABA
                            </a>
                            <button onClick={() => setImagemModal(null)} style={styles.btnFecharImagem}>
                                FECHAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    container: { 
        padding: '20px', 
        color: '#fff', 
        backgroundColor: '#000', 
        minHeight: '100vh', 
        fontFamily: 'sans-serif',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)',
        position: 'relative'
    },
    header: { 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '15px',
        borderBottom: '2px solid #222'
    },
    title: { 
        display: 'flex', 
        alignItems: 'center', 
        gap: '15px', 
        margin: 0,
        fontSize: '28px',
        fontWeight: 'bold',
        letterSpacing: '1px'
    },
    subtitle: { 
        color: '#666', 
        fontSize: '14px',
        marginTop: '5px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    },
    AbasContainer: { 
        display: 'flex', 
        gap: '10px',
        background: '#111',
        padding: '5px',
        borderRadius: '8px',
        border: '1px solid #222'
    },
    abaBtn: { 
        background: 'none', 
        border: 'none', 
        padding: '10px 20px', 
        cursor: 'pointer', 
        fontWeight: 'bold',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        transition: 'all 0.3s ease'
    },
    filterSection: { 
        marginBottom: '25px',
        background: '#0a0a0a',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #222'
    },
    filterGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '20px',
        marginBottom: '20px'
    },
    searchBar: { 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px', 
        background: '#111', 
        padding: '12px 15px', 
        borderRadius: '8px', 
        border: '1px solid #333' 
    },
    searchInput: { 
        background: 'none', 
        border: 'none', 
        color: '#fff', 
        outline: 'none', 
        width: '100%',
        fontSize: '14px'
    },
    dateFilters: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
    },
    dateInputGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#111',
        padding: '10px 15px',
        borderRadius: '8px',
        border: '1px solid #333'
    },
    dateInput: {
        background: 'none',
        border: 'none',
        color: '#fff',
        outline: 'none',
        fontSize: '14px',
        width: '140px'
    },
    dateLabel: {
        color: '#666',
        fontSize: '12px',
        minWidth: '25px'
    },
    btnLimparFiltros: {
        background: 'transparent',
        border: '1px solid #333',
        color: '#999',
        padding: '10px 15px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'all 0.3s ease',
        marginLeft: 'auto'
    },
    resumoContainer: {
        display: 'flex',
        gap: '30px',
        paddingTop: '15px',
        borderTop: '1px solid #222'
    },
    resumoItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    resumoLabel: {
        color: '#666',
        fontSize: '12px',
        textTransform: 'uppercase'
    },
    resumoValor: {
        color: '#FFD700',
        fontSize: '18px',
        fontWeight: 'bold'
    },
    listaContainer: { 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '15px' 
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        background: '#0a0a0a',
        borderRadius: '12px',
        border: '1px solid #222',
        color: '#666',
        textAlign: 'center',
        gap: '15px'
    },
    cardMotorista: { 
        background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)', 
        borderRadius: '12px', 
        border: '1px solid #1a1a1a',
        overflow: 'hidden',
        transition: 'all 0.3s ease'
    },
    motoristaHeader: { 
        padding: '20px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        cursor: 'pointer', 
        alignItems: 'center',
        borderBottom: '1px solid #222'
    },
    motoristaInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
    },
    avatar: { 
        width: '45px', 
        height: '45px', 
        borderRadius: '50%', 
        background: 'linear-gradient(135deg, #222 0%, #333 100%)', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        color: '#FFD700',
        border: '2px solid #333'
    },
    nomeMot: { 
        margin: 0, 
        fontSize: '16px',
        fontWeight: 'bold',
        letterSpacing: '0.5px'
    },
    motoristaDetalhes: {
        margin: 0,
        fontSize: '12px',
        color: '#666',
        marginTop: '3px'
    },
    motoristaStats: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
    },
    statBadge: {
        background: '#222',
        color: '#FFD700',
        padding: '5px 12px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 'bold',
        border: '1px solid #333'
    },
    detalhesViagens: { 
        padding: '20px', 
        background: '#050505',
        borderTop: '1px solid #222'
    },
    viagemItem: { 
        background: '#0a0a0a', 
        padding: '20px', 
        borderRadius: '10px', 
        marginBottom: '15px', 
        border: '1px solid #111' 
    },
    viagemMain: { 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '15px'
    },
    infoPonto: { 
        flex: 1,
        minWidth: '200px'
    },
    tagContainer: {
        display: 'flex',
        gap: '8px',
        marginBottom: '8px'
    },
    tagOrigem: { 
        color: '#3498db', 
        fontSize: '10px', 
        fontWeight: 'bold',
        background: 'rgba(52, 152, 219, 0.1)',
        padding: '3px 8px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    },
    tagDestino: { 
        color: '#e67e22', 
        fontSize: '10px', 
        fontWeight: 'bold',
        background: 'rgba(230, 126, 34, 0.1)',
        padding: '3px 8px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    },
    tagAtencao: {
        color: '#e74c3c',
        fontSize: '10px',
        fontWeight: 'bold',
        background: 'rgba(231, 76, 60, 0.1)',
        padding: '3px 8px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    },
    tagCanhoto: {
        color: '#16a34a',
        fontSize: '10px',
        fontWeight: 'bold',
        background: 'rgba(22, 163, 74, 0.1)',
        padding: '3px 8px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    },
    cidadeText: { 
        fontSize: '16px', 
        fontWeight: 'bold', 
        margin: '6px 0 2px 0',
        color: '#fff'
    },
    clienteSubText: { 
        fontSize: '13px', 
        color: '#999',
        marginBottom: '5px'
    },
    dataText: { 
        fontSize: '12px', 
        color: '#FFD700', 
        marginTop: '5px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '5px' 
    },
    
    // LEAD TIME STYLES
    leadTimeInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginTop: '8px',
        fontSize: '11px',
    },
    
    leadTimeLabel: {
        color: '#AAA',
        fontSize: '10px',
    },
    
    leadTimeStatus: {
        fontSize: '10px',
        fontWeight: 'bold',
        padding: '3px 8px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    
    leadTimeDetails: {
        marginTop: '6px',
        padding: '6px',
        background: 'rgba(255, 215, 0, 0.05)',
        borderRadius: '4px',
        border: '1px solid rgba(255, 215, 0, 0.1)',
    },
    
    leadTimeDetail: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        marginBottom: '2px',
    },
    
    leadTimeDetailLabel: {
        color: '#AAA',
    },
    
    leadTimeDetailValue: {
        color: '#FFF',
        fontWeight: '600',
    },
    
    leadTimeTotalBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(255, 215, 0, 0.1)',
        padding: '6px 10px',
        borderRadius: '20px',
        marginBottom: '8px',
        border: '1px solid rgba(255, 215, 0, 0.3)',
    },
    
    leadTimeTotalText: {
        color: '#FFD700',
        fontSize: '10px',
        fontWeight: 'bold',
    },
    
    arrowIcon: {
        margin: '0 20px',
        color: '#FFD700',
        opacity: 0.7
    },
    
    infoStatus: { 
        textAlign: 'right', 
        minWidth: '150px'
    },
    
    acoesContainer: { 
        display: 'flex', 
        gap: '10px', 
        justifyContent: 'flex-end', 
        marginBottom: '10px' 
    },
    
    btnIcon: { 
        background: 'rgba(255, 255, 255, 0.05)', 
        border: '1px solid #333', 
        cursor: 'pointer',
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s ease'
    },
    
    statusBadge: { 
        fontSize: '11px', 
        padding: '5px 12px', 
        borderRadius: '20px', 
        fontWeight: 'bold', 
        color: '#fff',
        display: 'inline-block',
        marginBottom: '8px'
    },
    
    btnCanhoto: { 
        background: 'rgba(255, 215, 0, 0.1)', 
        color: '#FFD700', 
        border: '1px solid rgba(255, 215, 0, 0.3)', 
        fontSize: '11px', 
        padding: '8px 12px', 
        borderRadius: '6px', 
        marginTop: '8px', 
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.3s ease'
    },
    
    viagemExtra: {
        display: 'flex',
        gap: '30px',
        paddingTop: '15px',
        borderTop: '1px solid #222',
        fontSize: '12px'
    },
    
    extraItem: {
        display: 'flex',
        gap: '8px'
    },
    
    extraLabel: {
        color: '#666',
        fontWeight: 'bold'
    },
    
    extraValue: {
        color: '#999'
    },
    
    overlay: { 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,0.95)', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        zIndex: 1000,
        padding: '20px'
    },
    
    overlayImagem: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.98)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1001
    },
    
    modalDetalhes: {
        background: '#111',
        padding: '30px',
        borderRadius: '15px',
        width: '800px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid #333',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
    },
    
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '25px',
        paddingBottom: '15px',
        borderBottom: '1px solid #222'
    },
    
    modalTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        margin: 0,
        fontSize: '18px',
        color: '#FFD700'
    },
    
    modalSubtitle: {
        color: '#666',
        fontSize: '12px',
        marginTop: '5px'
    },
    
    modalContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '25px'
    },
    
    modalSection: {
        background: '#0a0a0a',
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid #222'
    },
    
    sectionTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        margin: '0 0 15px 0',
        fontSize: '14px',
        color: '#FFD700',
        paddingBottom: '10px',
        borderBottom: '1px solid #222'
    },
    
    infoGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '15px'
    },
    
    infoItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
    },
    
    infoLabel: {
        fontSize: '12px',
        color: '#666',
        textTransform: 'uppercase',
        fontWeight: 'bold'
    },
    
    infoValue: {
        fontSize: '14px',
        color: '#fff'
    },
    
    // LEAD TIME MODAL STYLES
    leadTimeModalContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
    },
    
    leadTimeModalBox: {
        background: '#050505',
        padding: '15px',
        borderRadius: '8px',
        border: '1px solid #333',
    },
    
    leadTimeModalTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        margin: '0 0 10px 0',
        fontSize: '13px',
        color: '#FFD700',
    },
    
    leadTimeModalDetails: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    
    leadTimeModalRow: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px',
    },
    
    leadTimeModalLabel: {
        color: '#AAA',
    },
    
    leadTimeModalValue: {
        color: '#FFF',
        fontWeight: '600',
    },
    
    leadTimeTotalModal: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(255, 215, 0, 0.1)',
        padding: '12px 15px',
        borderRadius: '8px',
        border: '2px solid rgba(255, 215, 0, 0.3)',
        marginTop: '10px',
    },
    
    leadTimeTotalModalText: {
        color: '#FFD700',
        fontSize: '14px',
        fontWeight: 'bold',
    },
    
    trajetoContainer: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'stretch'
    },
    
    trajetoItem: {
        flex: 1,
        background: '#050505',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #333'
    },
    
    trajetoHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '15px',
        paddingBottom: '10px',
        borderBottom: '1px solid #222'
    },
    
    trajetoIcon: {
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff'
    },
    
    trajetoTitle: {
        margin: 0,
        fontSize: '14px',
        color: '#fff',
        fontWeight: 'bold'
    },
    
    trajetoContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    
    trajetoCliente: {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#fff',
        margin: 0
    },
    
    trajetoCidade: {
        fontSize: '14px',
        color: '#999',
        margin: 0
    },
    
    trajetoData: {
        fontSize: '12px',
        color: '#FFD700',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
    },
    
    trajetoFinalizado: {
        fontSize: '12px',
        color: '#16a34a',
        margin: '10px 0 0 0',
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
    },
    
    canhotoContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '15px',
        padding: '20px',
        background: '#050505',
        borderRadius: '8px',
        border: '2px dashed #333'
    },
    
    canhotoStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(22, 163, 74, 0.1)',
        padding: '10px 15px',
        borderRadius: '8px',
        border: '1px solid rgba(22, 163, 74, 0.3)',
        marginBottom: '15px'
    },
    
    canhotoStatusText: {
        color: '#16a34a',
        fontSize: '13px'
    },
    
    btnVerCanhoto: {
        background: 'rgba(255, 215, 0, 0.1)',
        color: '#FFD700',
        border: '2px solid rgba(255, 215, 0, 0.3)',
        padding: '12px 25px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.3s ease'
    },
    
    canhotoInfo: {
        color: '#666',
        fontSize: '12px',
        textAlign: 'center',
        margin: 0
    },
    
    metadataGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '15px'
    },
    
    metadataItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
    },
    
    metadataLabel: {
        fontSize: '11px',
        color: '#666',
        textTransform: 'uppercase'
    },
    
    metadataValue: {
        fontSize: '13px',
        color: '#999'
    },
    
    modalFooter: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '15px',
        marginTop: '30px',
        paddingTop: '20px',
        borderTop: '1px solid #222'
    },
    
    btnEditarModal: {
        background: 'rgba(255, 215, 0, 0.1)',
        color: '#FFD700',
        border: '1px solid rgba(255, 215, 0, 0.3)',
        padding: '10px 20px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.3s ease'
    },
    
    btnFecharModal: {
        background: '#222',
        color: '#fff',
        border: '1px solid #333',
        padding: '10px 25px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 'bold',
        transition: 'all 0.3s ease'
    },
    
    modalEdit: { 
        background: '#111', 
        padding: '30px', 
        borderRadius: '15px', 
        width: '700px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid #333' 
    },
    
    modalEditHeader: { 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '25px',
        paddingBottom: '15px',
        borderBottom: '1px solid #222' 
    },
    
    btnClose: { 
        border: 'none', 
        color: '#fff', 
        cursor: 'pointer',
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#222',
        transition: 'all 0.3s ease'
    },
    
    formGrid: { 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '20px' 
    },
    
    formSectionTitle: { 
        gridColumn: 'span 2', 
        fontSize: '13px', 
        color: '#FFD700', 
        margin: '20px 0 10px 0', 
        borderBottom: '1px solid #222',
        paddingBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    
    inputGroup: { 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px' 
    },
    
    inputStyle: { 
        background: '#000', 
        border: '1px solid #333', 
        color: '#fff', 
        padding: '12px', 
        borderRadius: '8px', 
        outline: 'none',
        fontSize: '14px'
    },
    
    helperText: {
        color: '#FFD700',
        fontSize: '11px',
        marginTop: '5px',
        fontStyle: 'italic'
    },
    
    modalEditFooter: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '15px',
        marginTop: '30px',
        paddingTop: '20px',
        borderTop: '1px solid #222'
    },
    
    btnCancelar: {
        background: 'transparent',
        color: '#999',
        border: '1px solid #333',
        padding: '12px 25px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 'bold',
        transition: 'all 0.3s ease'
    },
    
    btnSalvar: { 
        background: '#FFD700', 
        color: '#000',
        border: 'none', 
        padding: '12px 30px', 
        borderRadius: '8px', 
        fontWeight: 'bold', 
        cursor: 'pointer',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.3s ease'
    },
    
    modalImagemContainer: {
        background: '#111',
        borderRadius: '15px',
        width: '90vw',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #333',
        overflow: 'hidden'
    },
    
    modalImagemHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 30px',
        borderBottom: '1px solid #222',
        background: '#0a0a0a'
    },
    
    imagemSubtitle: {
        color: '#666',
        fontSize: '12px',
        marginTop: '3px'
    },
    
    modalImagemContent: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflow: 'hidden',
        background: '#000',
        position: 'relative'
    },
    
    imagemStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(22, 163, 74, 0.1)',
        padding: '10px 15px',
        borderRadius: '8px',
        border: '1px solid rgba(22, 163, 74, 0.3)',
        marginBottom: '15px',
        position: 'absolute',
        top: '20px',
        left: '20px',
        right: '20px',
        zIndex: 10
    },
    
    imagemCanhoto: {
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
        borderRadius: '8px',
        border: '1px solid #333'
    },
    
    modalImagemFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 30px',
        borderTop: '1px solid #222',
        background: '#0a0a0a'
    },
    
    btnDownload: {
        background: 'rgba(52, 152, 219, 0.1)',
        color: '#3498db',
        border: '1px solid rgba(52, 152, 219, 0.3)',
        padding: '10px 20px',
        borderRadius: '8px',
        textDecoration: 'none',
        fontSize: '12px',
        fontWeight: 'bold',
        transition: 'all 0.3s ease'
    },
    
    btnFecharImagem: {
        background: '#222',
        color: '#fff',
        border: '1px solid #333',
        padding: '10px 25px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 'bold',
        transition: 'all 0.3s ease'
    }
};

export default HistoricoViagens;