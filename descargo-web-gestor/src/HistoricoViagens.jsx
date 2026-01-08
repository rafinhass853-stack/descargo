import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { 
    History, Search, User, MapPin, Calendar, 
    ArrowRight, ChevronDown, ChevronUp, Clock, Hash
} from 'lucide-react';

const HistoricoViagens = () => {
    const [viagens, setViagens] = useState([]);
    const [filtro, setFiltro] = useState('');
    const [motoristasExpandidos, setMotoristasExpandidos] = useState({});

    useEffect(() => {
        // Buscamos na coleção 'viagens_ativas' e em uma futura 'historico_viagens'
        // Dica: Quando o motorista finaliza no App, você deve mover de 'viagens_ativas' para 'historico_viagens'
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

    // Agrupando viagens por Motorista
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
                    <p style={styles.subtitle}>Viagens lançadas via Dashboard</p>
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
                {nomesMotoristas.length > 0 ? (
                    nomesMotoristas.map(nome => (
                        <div key={nome} style={styles.cardMotorista}>
                            <div style={styles.motoristaHeader} onClick={() => toggleMotorista(nome)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={styles.avatar}><User size={20} /></div>
                                    <div>
                                        <h3 style={styles.nomeMot}>{nome.toUpperCase()}</h3>
                                        <span style={styles.qtdViagens}>{viagensAgrupadas[nome].length} viagem(ns) registrada(s)</span>
                                    </div>
                                </div>
                                {motoristasExpandidos[nome] ? <ChevronUp /> : <ChevronDown />}
                            </div>

                            {motoristasExpandidos[nome] && (
                                <div style={styles.detalhesViagens}>
                                    {viagensAgrupadas[nome].map((viagem, index) => (
                                        <div key={index} style={styles.viagemItem}>
                                            <div style={styles.viagemMain}>
                                                <div style={styles.infoPonto}>
                                                    <small style={styles.tagColeta}>ORIGEM/COLETA</small>
                                                    <div style={styles.cidadeText}>{viagem.clienteColeta}</div>
                                                    <div style={styles.subText}>{viagem.cidadeColeta}</div>
                                                </div>

                                                <div style={styles.seta}><ArrowRight size={20} color="#333" /></div>

                                                <div style={styles.infoPonto}>
                                                    <small style={styles.tagEntrega}>DESTINO/ENTREGA</small>
                                                    <div style={styles.cidadeText}>{viagem.clienteEntrega}</div>
                                                    <div style={styles.subText}>{viagem.destinoCidade}</div>
                                                </div>

                                                <div style={styles.infoMeta}>
                                                    <div style={styles.metaItem}><Hash size={14} /> DT: {viagem.dt}</div>
                                                    <div style={styles.metaItem}><Clock size={14} /> {viagem.criadoEm?.toDate().toLocaleDateString()}</div>
                                                    <div style={styles.metaBadge}>{viagem.statusOperacional}</div>
                                                </div>
                                            </div>
                                            {viagem.observacao && (
                                                <div style={styles.obsBox}>
                                                    <strong>Obs:</strong> {viagem.observacao}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div style={styles.empty}>Nenhum registro encontrado.</div>
                )}
            </div>
        </div>
    );
};

const styles = {
    container: { padding: '5px', color: '#fff' },
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
    
    infoMeta: { display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '150px', alignItems: 'flex-end' },
    metaItem: { fontSize: '11px', color: '#888', display: 'flex', alignItems: 'center', gap: '5px' },
    metaBadge: { backgroundColor: '#FFD700', color: '#000', fontSize: '9px', fontWeight: '900', padding: '3px 8px', borderRadius: '4px', marginTop: '5px' },
    
    obsBox: { marginTop: '10px', padding: '8px', backgroundColor: '#111', borderRadius: '5px', fontSize: '12px', color: '#aaa', borderLeft: '3px solid #333' },
    empty: { textAlign: 'center', padding: '50px', color: '#444' }
};

export default HistoricoViagens;