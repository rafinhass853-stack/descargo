import React, { useState, useEffect } from 'react';
import { signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { 
    Truck, Users, LayoutDashboard, ClipboardList, 
    LogOut, Fuel, Settings, UserCheck, Bell, Container,
    MapPin, FileText, Route, CalendarDays, Gauge // Adicionado Gauge aqui
} from 'lucide-react';

// Importação das Telas de Operação
import PainelCargas from './PainelCargas';
import Motoristas from './Motoristas';
import Veiculos from './Veiculos';
import Carretas from './Carretas';
import Notificacoes from './Notificacoes';
import ClientesPontos from './ClientesPontos';
import Folgas from './Folgas';
import Roteirizacao from './Roteirizacao';
import Escala from './Escala';
import JornadaHodometro from './JornadaHodometro'; // Importado aqui

// Importação dos Dashboards
import DashboardGeral from './DashboardGeral';
import DashboardCargas from './DashboardCargas';

const PainelGestor = () => {
    const [motoristasOnline, setMotoristasOnline] = useState([]);
    const [totalMotoristas, setTotalMotoristas] = useState(0);
    const [menuAtivo, setMenuAtivo] = useState('dashboard');

    useEffect(() => {
        const qLoc = query(collection(db, "localizacao_realtime"));
        const unsubscribeLoc = onSnapshot(qLoc, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() });
            });
            setMotoristasOnline(lista);
        });

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
            
            case 'relatorio_viagens':
                return <DashboardCargas />;
            
            case 'roteirizacao':
                return <Roteirizacao />;
            
            case 'escala':
                return <Escala />;
            
            case 'jornada_hodometro': // Adicionado o caso para a nova tela
                return <JornadaHodometro />;
            
            case 'cargas': return <PainelCargas />;
            case 'veiculos': return <Veiculos />;
            case 'carretas': return <Carretas />;
            case 'motoristas': return <Motoristas />;
            case 'clientes_pontos': return <ClientesPontos />;
            case 'notificacoes': return <Notificacoes />;
            case 'folgas': return <Folgas />;
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

                    <div onClick={() => setMenuAtivo('escala')} style={menuAtivo === 'escala' ? styles.navItemAtivo : styles.navItem}>
                        <CalendarDays size={18} /> Escala Motoristas
                    </div>

                    {/* Novo item de menu: Jornada e Hodômetro */}
                    <div onClick={() => setMenuAtivo('jornada_hodometro')} style={menuAtivo === 'jornada_hodometro' ? styles.navItemAtivo : styles.navItem}>
                        <Gauge size={18} /> Jornada e Hodômetro
                    </div>

                    <div onClick={() => setMenuAtivo('relatorio_viagens')} style={menuAtivo === 'relatorio_viagens' ? styles.navItemAtivo : styles.navItem}>
                        <FileText size={18} /> Relatório de Viagens
                    </div>

                    <hr style={{ border: '0.1px solid #222', margin: '10px 0' }} />

                    <div onClick={() => setMenuAtivo('roteirizacao')} style={menuAtivo === 'roteirizacao' ? styles.navItemAtivo : styles.navItem}>
                        <Route size={18} /> Roteirização
                    </div>

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
};

export default PainelGestor;