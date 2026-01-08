import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { 
    History, Search, User, MapPin, Calendar, 
    ArrowRight, ChevronDown, ChevronUp, Clock, Hash, Eye, X, Image as ImageIcon,
    Trash2, Pencil // Novos ícones
} from 'lucide-react';

const HistoricoViagens = () => {
    const [viagens, setViagens] = useState([]);
    const [filtro, setFiltro] = useState('');
    const [motoristasExpandidos, setMotoristasExpandidos] = useState({});
    const [imagemModal, setImagemModal] = useState(null);

    useEffect(() => {
        const q = query(collection(db, "viagens_ativas"), orderBy("criadoEm", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() });
            });
            setViagens(lista);
        });
        return () => unsubscribe();
    }, []);

    // FUNÇÃO PARA EXCLUIR
    const excluirViagem = async (id) => {
        if (window.confirm("Tem certeza que deseja apagar este registro permanentemente?")) {
            try {
                await deleteDoc(doc(db, "viagens_ativas", id));
            } catch (error) {
                console.error("Erro ao excluir:", error);
                alert("Erro ao excluir viagem.");
            }
        }
    };

    // FUNÇÃO PARA EDITAR STATUS
    const editarStatus = async (viagem) => {
        const novoStatus = window.prompt("Digite o novo status da carga:", viagem.statusOperacional);
        if (novoStatus !== null && novoStatus !== "") {
            try {
                const viagemRef = doc(db, "viagens_ativas", viagem.id);
                await updateDoc(viagemRef, { statusOperacional: novoStatus });
            } catch (error) {
                console.error("Erro ao atualizar:", error);
                alert("Erro ao atualizar status.");
            }
        }
    };

    const viagensAgrupadas = viagens.reduce((acc, viagem) => {
        const nome = viagem.motoristaNome || "Não Identificado";
        if (!acc[nome]) acc[nome] = [];
        acc[nome].push(viagem);
        return acc;
    }, {});

    const toggleMotorista = (nome) => {
        setMotoristasExpandidos(prev => ({ ...prev, [nome]: !prev[nome] }));
    };

    const nomesMotoristas = Object.keys(viagensAgrupadas).filter(nome => 
        nome.toLowerCase().includes(filtro.toLowerCase())
    );

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div>
                    <h2 style={styles.title}><History size={24} color="#FFD700" /> Histórico de Operações</h2>
                    <p style={styles.subtitle}>Gestão de canhotos e status de carga</p>
                </div>
                <div style={styles.searchBar}>
                    <Search size={18} color="#FFD700" />
                    <input 
                        placeholder="Filtrar por nome do motorista..." 
                        style={styles.searchInput}
                        onChange={(e) => setFiltro(e.target.value)}
                    />
                </div>
            </header>

            <div style={styles.listaContainer}>
                {nomesMotoristas.map(nome => (
                    <div key={nome} style={styles.cardMotorista}>
                        <div style={styles.motoristaHeader} onClick={() => toggleMotorista(nome)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={styles.avatar}><User size={20} /></div>
                                <div>
                                    <h3 style={styles.nomeMot}>{nome.toUpperCase()}</h3>
                                    <span style={styles.qtdViagens}>{viagensAgrupadas[nome].length} viagem(ns)</span>
                                </div>
                            </div>
                            {motoristasExpandidos[nome] ? <ChevronUp /> : <ChevronDown />}
                        </div>

                        {motoristasExpandidos[nome] && (
                            <div style={styles.detalhesViagens}>
                                {viagensAgrupadas[nome].map((viagem, index) => (
                                    <div key={viagem.id} style={styles.viagemItem}>
                                        <div style={styles.viagemMain}>
                                            <div style={styles.infoPonto}>
                                                <small style={styles.tagColeta}>ORIGEM</small>
                                                <div style={styles.cidadeText}>{viagem.clienteColeta}</div>
                                                <div style={styles.subText}>{viagem.cidadeColeta}</div>
                                            </div>

                                            <div style={styles.seta}><ArrowRight size={20} color="#333" /></div>

                                            <div style={styles.infoPonto}>
                                                <small style={styles.tagEntrega}>DESTINO</small>
                                                <div style={styles.cidadeText}>{viagem.clienteEntrega}</div>
                                                <div style={styles.subText}>{viagem.destinoCidade}</div>
                                            </div>

                                            <div style={styles.infoMeta}>
                                                <div style={styles.acoesGestor}>
                                                    <button onClick={() => editarStatus(viagem)} style={styles.btnIconEdit} title="Editar Status">
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button onClick={() => excluirViagem(viagem.id)} style={styles.btnIconDelete} title="Apagar Carga">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                
                                                <div 
                                                    style={{
                                                        ...styles.metaBadge, 
                                                        backgroundColor: viagem.urlCanhoto ? '#2ecc71' : '#FFD700',
                                                        color: viagem.urlCanhoto ? '#fff' : '#000'
                                                    }}
                                                >
                                                    {viagem.statusOperacional}
                                                </div>
                                                <div style={styles.metaItem}><Hash size={12} /> DT: {viagem.dt}</div>
                                                
                                                {viagem.urlCanhoto ? (
                                                    <button 
                                                        onClick={() => setImagemModal(viagem.urlCanhoto)}
                                                        style={styles.btnVerCanhoto}
                                                    >
                                                        <ImageIcon size={14} /> Ver Canhoto
                                                    </button>
                                                ) : (
                                                    <div style={styles.semCanhoto}>Pendente</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* MODAL DE IMAGEM */}
            {imagemModal && (
                <div style={styles.overlay} onClick={() => setImagemModal(null)}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <button style={styles.closeBtn} onClick={() => setImagemModal(null)}><X size={30} /></button>
                        <img src={imagemModal} alt="Canhoto" style={styles.imgFull} />
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    // ... manter seus estilos anteriores e adicionar estes novos:
    container: { padding: '20px', color: '#fff', backgroundColor: '#000', minHeight: '100vh' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
    title: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '22px', margin: 0, fontWeight: '800' },
    subtitle: { color: '#666', fontSize: '14px', margin: '5px 0 0 0' },
    searchBar: { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#0a0a0a', padding: '10px 15px', borderRadius: '10px', border: '1px solid #222' },
    searchInput: { background: 'none', border: 'none', color: '#fff', outline: 'none', width: '250px' },
    listaContainer: { display: 'flex', flexDirection: 'column', gap: '15px' },
    cardMotorista: { backgroundColor: '#0a0a0a', borderRadius: '12px', border: '1px solid #1a1a1a', overflow: 'hidden' },
    motoristaHeader: { padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: '#0d0d0d' },
    avatar: { width: '45px', height: '45px', borderRadius: '50%', backgroundColor: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700' },
    nomeMot: { margin: 0, fontSize: '16px', fontWeight: '700', letterSpacing: '0.5px' },
    qtdViagens: { fontSize: '12px', color: '#555' },
    detalhesViagens: { padding: '15px', backgroundColor: '#050505', display: 'flex', flexDirection: 'column', gap: '12px' },
    viagemItem: { backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '10px', padding: '15px' },
    viagemMain: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' },
    infoPonto: { flex: 1 },
    tagColeta: { color: '#3498db', fontSize: '9px', fontWeight: 'bold' },
    tagEntrega: { color: '#e67e22', fontSize: '9px', fontWeight: 'bold' },
    cidadeText: { fontSize: '14px', fontWeight: '700', marginTop: '4px' },
    subText: { fontSize: '11px', color: '#666' },
    seta: { display: 'flex', alignItems: 'center' },
    infoMeta: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '160px', alignItems: 'flex-end' },
    metaItem: { fontSize: '11px', color: '#888', display: 'flex', alignItems: 'center', gap: '5px' },
    metaBadge: { fontSize: '9px', fontWeight: '900', padding: '4px 10px', borderRadius: '4px' },
    
    // NOVOS ESTILOS DE GESTÃO
    acoesGestor: { display: 'flex', gap: '8px', marginBottom: '4px' },
    btnIconEdit: { background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', padding: '4px' },
    btnIconDelete: { background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '4px' },
    
    btnVerCanhoto: { 
        backgroundColor: '#1a1a1a', 
        color: '#FFD700', 
        border: '1px solid #FFD700', 
        padding: '5px 10px', 
        borderRadius: '5px', 
        fontSize: '11px', 
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
    },
    semCanhoto: { fontSize: '10px', color: '#444', fontStyle: 'italic' },
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
    modalContent: { position: 'relative', maxWidth: '80%', maxHeight: '80%' },
    imgFull: { width: '100%', borderRadius: '10px' },
    closeBtn: { position: 'absolute', top: '-50px', right: '-50px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }
};

export default HistoricoViagens;