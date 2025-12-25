import React, { useState, useEffect } from 'react';
import { signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { 
    Truck, Users, LayoutDashboard, ClipboardList, 
    LogOut, Fuel, Settings, UserCheck, Bell, Container,
    MapPin 
} from 'lucide-react';

// Importação das Telas de Operação
import PainelCargas from './PainelCargas';
import Motoristas from './Motoristas';
import Veiculos from './Veiculos';
import Carretas from './Carretas';
import Notificacoes from './Notificacoes';
import ClientesPontos from './ClientesPontos';
import Folgas from './Folgas'; // <-- Nova Importação

// Importação do Dashboard Principal
import DashboardGeral from './DashboardGeral';

const PainelGestor = () => {
    const [motoristasOnline, setMotoristasOnline] = useState([]);
    const [totalMotoristas, setTotalMotoristas] = useState(0);
    const [menuAtivo, setMenuAtivo] = useState('dashboard');

    useEffect(() => {
        // 1. Monitoramento de quem está enviando sinal GPS (localizacao_realtime)
        const qLoc = query(collection(db, "localizacao_realtime"));
        const unsubscribeLoc = onSnapshot(qLoc, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() });
            });
            setMotoristasOnline(lista);
        });

        // 2. Monitoramento do Total de Cadastros (cadastro_motoristas)
        const qCad = query(collection(db, "cadastro_motoristas"));
        const unsubscribeCad = onSnapshot(qCad, (snapshot) => {
            setTotalMotoristas(snapshot.size);
        });

        return () => {
            unsubscribeLoc();
            unsubscribeCad();
        };
    }, []);

    const handleLogout = () => signOut(auth);

    const renderConteudo = () => {
        switch (menuAtivo) {
            case 'dashboard':
                return <DashboardGeral 
                            totalCadastradosProp={totalMotoristas} 
                            motoristasOnlineProp={motoristasOnline} 
                            styles={styles} 
                        />;
            
            case 'cargas': return <PainelCargas />;
            case 'veiculos': return <Veiculos />;
            case 'carretas': return <Carretas />;
            case 'motoristas': return <Motoristas />;
            case 'clientes_pontos': return <ClientesPontos />;
            case 'notificacoes': return <Notificacoes />;
            case 'folgas': return <Folgas />; // <-- Caso Adicionado
            default: return <div style={{color: '#666', padding: '20px'}}>Em desenvolvimento...</div>;
        }
    };

    return (
        <div style={styles.container}>
            <aside style={styles.sidebar}>
                <h1 style={styles.logo}>DESCARGO</h1>
                <nav style={styles.nav}>
                    <div onClick={() => setMenuAtivo('dashboard')} style={menuAtivo === 'dashboard' ? styles.navItemAtivo : styles.navItem}>
                        <LayoutDashboard size={18} /> Monitoramento
                    </div>

                    <hr style={{ border: '0.1px solid #222', margin: '10px 0' }} />

                    <div onClick={() => setMenuAtivo('cargas')} style={menuAtivo === 'cargas' ? styles.navItemAtivo : styles.navItem}>
                        <ClipboardList size={18} /> Painel de Cargas
                    </div>

                    <div onClick={() => setMenuAtivo('clientes_pontos')} style={menuAtivo === 'clientes_pontos' ? styles.navItemAtivo : styles.navItem}>
                        <MapPin size={18} /> Clientes e Pontos
                    </div>

                    <div onClick={() => setMenuAtivo('veiculos')} style={menuAtivo === 'veiculos' ? styles.navItemAtivo : styles.navItem}>
                        <Truck size={18} /> Veículos
                    </div>
                    <div onClick={() => setMenuAtivo('carretas')} style={menuAtivo === 'carretas' ? styles.navItemAtivo : styles.navItem}>
                        <Container size={18} /> Carretas
                    </div>
                    <div onClick={() => setMenuAtivo('motoristas')} style={menuAtivo === 'motoristas' ? styles.navItemAtivo : styles.navItem}>
                        <Users size={18} /> Motoristas ({totalMotoristas})
                    </div>
                    
                    <hr style={{ border: '0.1px solid #222', margin: '10px 0' }} />

                    <div style={styles.navItem}><Fuel size={18} /> Dash Combustível</div>
                    <div style={styles.navItem}><Settings size={18} /> Manutenções</div>
                    
                    {/* Botão de Folgas Ajustado */}
                    <div onClick={() => setMenuAtivo('folgas')} style={menuAtivo === 'folgas' ? styles.navItemAtivo : styles.navItem}>
                        <UserCheck size={18} />Folgas
                    </div>
                    
                    <div onClick={() => setMenuAtivo('notificacoes')} style={menuAtivo === 'notificacoes' ? styles.navItemAtivo : styles.navItem}>
                        <Bell size={18} />Notificações
                    </div>
                </nav>
                <button onClick={handleLogout} style={styles.btnSair}><LogOut size={18} /> Sair</button>
            </aside>

            <main style={styles.main}>
                <header style={styles.header}>
                    <span>Operação Logística | Rafael Araujo</span>
                </header>
                <div style={styles.content}>
                    {renderConteudo()}
                </div>
            </main>
        </div>
    );
};

const styles = {
    container: { display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#000', color: '#FFF', overflow: 'hidden' },
    sidebar: { width: '260px', backgroundColor: '#0a0a0a', padding: '20px', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column' },
    logo: { color: '#FFD700', fontSize: '24px', fontWeight: 'bold', marginBottom: '35px', letterSpacing: '1px' },
    nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', overflowY: 'auto' },
    navItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', color: '#888', cursor: 'pointer', fontSize: '14px', borderRadius: '8px', transition: '0.2s' },
    navItemAtivo: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', color: '#000', backgroundColor: '#FFD700', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
    btnSair: { display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'transparent', color: '#ff4d4d', border: 'none', cursor: 'pointer', padding: '10px', marginTop: 'auto' },
    main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
    header: { height: '60px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 30px', color: '#444', fontSize: '11px' },
    content: { padding: '25px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' },
    titulo: { color: '#FFD700', fontSize: '22px', margin: 0, borderLeft: '4px solid #FFD700', paddingLeft: '15px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' },
    card: { backgroundColor: '#111', padding: '15px', borderRadius: '10px', border: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    cardInfo: { display: 'flex', flexDirection: 'column' },
    cardLabel: { fontSize: '10px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase' },
    cardValor: { fontSize: '24px', fontWeight: 'bold', marginTop: '5px', color: '#FFF' },
    mapaContainer: { borderRadius: '15px', overflow: 'hidden', border: '1px solid #333', backgroundColor: '#111' },
    mapaHeader: { padding: '10px 15px', borderBottom: '1px solid #222', color: '#888', fontSize: '12px' }
};

export default PainelGestor;