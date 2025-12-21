import React, { useState } from 'react';
import { 
  Users, Truck, Package, Clock, Calendar, 
  Fuel, Map as MapIcon, LogOut, Send, Navigation,
  AlertCircle, CheckCircle, Play, Coffee, Timer, ArrowRight, Plus, FileText, UserCircle, ShieldCheck, Lock,
  Instagram, MessageCircle
} from 'lucide-react';

const PainelGestor = () => {
  // --- LÓGICA DE ACESSO ---
  const [logado, setLogado] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const realizarLogin = (e) => {
    e.preventDefault();
    if (email === 'raabi@teste.com' && senha === '123456') {
      setLogado(true);
    } else {
      alert("Credenciais incorretas!");
    }
  };

  const handleLogoff = () => {
    if(window.confirm("Deseja realmente sair do sistema Descargo?")) {
      setLogado(false);
      setEmail('');
      setSenha('');
    }
  };

  // --- ESTADOS DO SISTEMA ---
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  
  const [usuarioLogado] = useState({
    nome: "Rafael",
    sobrenome: "Investidor",
    cargo: "Administrador Geral / Proprietário",
    email: "raabi@teste.com",
    acesso: "Total",
    desde: "Dezembro 2025"
  });

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard Operacional', icon: <MapIcon size={20} /> },
    { id: 'motoristas', label: 'Cadastros: Motoristas', icon: <Users size={20} /> },
    { id: 'veiculos', label: 'Cadastros: Veículos', icon: <Truck size={20} /> },
    { id: 'cargas', label: 'Lançar Carga (DT)', icon: <Package size={20} /> },
    { id: 'leadtime', label: 'Lead Time (Eficiência)', icon: <Clock size={20} /> },
    { id: 'folgas', label: 'Controle de Folgas', icon: <Calendar size={20} /> },
    { id: 'abastecimento', label: 'Abastecimento', icon: <Fuel size={20} /> },
    { id: 'perfil', label: 'Meu Perfil', icon: <UserCircle size={20} /> },
  ];

  // --- TELA DE LOGIN (CORRIGIDA) ---
  if (!logado) {
    return (
      <div style={{ height: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>
        <form onSubmit={realizarLogin} style={{ backgroundColor: '#0a0a0a', padding: '40px', borderRadius: '15px', border: '1px solid #222', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <h1 style={{ color: '#ffcc00', letterSpacing: '4px', marginBottom: '10px', fontWeight: '900' }}>DESCARGO</h1>
          <p style={{ color: '#555', fontSize: '12px', marginBottom: '30px' }}>LOGÍSTICA E GESTÃO</p>
          <div style={{ textAlign: 'left', marginBottom: '20px' }}>
            <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '8px' }}>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '12px', backgroundColor: '#000', border: '1px solid #222', color: '#fff', borderRadius: '6px', outline: 'none' }} placeholder="raabi@teste.com" required />
          </div>
          <div style={{ textAlign: 'left', marginBottom: '30px' }}>
            <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} style={{ width: '100%', padding: '12px', backgroundColor: '#000', border: '1px solid #222', color: '#fff', borderRadius: '6px', outline: 'none' }} placeholder="••••••" required />
          </div>
          <button type="submit" style={{ width: '100%', padding: '15px', backgroundColor: '#ffcc00', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <Lock size={18} /> ENTRAR NO SISTEMA
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#000', color: '#fff', fontFamily: 'Segoe UI, sans-serif' }}>
      
      {/* SIDEBAR FIXA */}
      <aside style={{ width: '280px', backgroundColor: '#0a0a0a', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh' }}>
        <div style={{ padding: '30px 20px', fontSize: '24px', fontWeight: '900', color: '#ffcc00', letterSpacing: '3px', borderBottom: '1px solid #222' }}>
          DESCARGO
        </div>
        
        <nav style={{ flex: 1, marginTop: '15px', overflowY: 'auto' }}>
          {menuItems.map((item) => (
            <div 
              key={item.id}
              onClick={() => setAbaAtiva(item.id)}
              style={{
                display: 'flex', alignItems: 'center', padding: '12px 20px', cursor: 'pointer',
                backgroundColor: abaAtiva === item.id ? '#ffcc00' : 'transparent',
                color: abaAtiva === item.id ? '#000' : '#888',
                fontWeight: abaAtiva === item.id ? 'bold' : 'normal',
                margin: '4px 10px', borderRadius: '8px', transition: '0.2s'
              }}
            >
              {item.icon} <span style={{ marginLeft: '12px', fontSize: '14px' }}>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* RODAPÉ SIDEBAR (SOCIAL & SAIR) */}
        <div style={{ padding: '15px 20px', borderTop: '1px solid #222' }}>
            <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#555', textDecoration: 'none', fontSize: '13px', marginBottom: '10px' }}>
                <Instagram size={16} /> @descargo_oficial
            </a>
            <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#555', textDecoration: 'none', fontSize: '13px', marginBottom: '15px' }}>
                <MessageCircle size={16} /> Suporte Técnico
            </a>
            <div 
              onClick={handleLogoff}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ff4d4d', cursor: 'pointer', fontWeight: 'bold' }}
            >
              <LogOut size={20} /> <span>Sair do Sistema</span>
            </div>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main style={{ flex: 1, marginLeft: '280px', padding: '30px', backgroundColor: '#050505' }}>
        
        {/* HEADER PERFIL */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #111' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>{usuarioLogado.nome}</div>
              <div style={{ color: '#ffcc00', fontSize: '11px' }}>{usuarioLogado.cargo}</div>
            </div>
            <div style={{ width: '35px', height: '35px', borderRadius: '50%', backgroundColor: '#ffcc00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserCircle size={22} color="#000" />
            </div>
          </div>
        </div>

        {/* --- DASHBOARD --- */}
        {abaAtiva === 'dashboard' && (
          <div>
            <h2 style={{ marginBottom: '25px' }}>Monitoramento em Tempo Real</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '25px' }}>
              <StatusCard title="Sem Viagem" value="08" color="#666" icon={<Coffee size={18}/>} />
              <StatusCard title="Vazio (Manutenção)" value="02" color="#f44336" icon={<AlertCircle size={18}/>} />
              <StatusCard title="Vazio (Coleta)" value="05" color="#2196f3" icon={<Navigation size={18}/>} />
              <StatusCard title="Em Viagem" value="14" color="#ffcc00" icon={<Play size={18}/>} />
              <StatusCard title="Em Coleta" value="03" color="#ff9800" icon={<Package size={18}/>} />
              <StatusCard title="Em Descarga" value="04" color="#9c27b0" icon={<CheckCircle size={18}/>} />
            </div>
            <div style={{ width: '100%', height: '400px', backgroundColor: '#111', borderRadius: '12px', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '25px', color: '#333' }}>
              [ MAPA DE SATÉLITE ]
            </div>
          </div>
        )}

        {/* --- LANÇAR CARGA (DT) --- */}
        {abaAtiva === 'cargas' && (
          <div style={{ maxWidth: '900px' }}>
            <h2 style={{ marginBottom: '20px' }}>Lançamento de DT</h2>
            <form style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', backgroundColor: '#111', padding: '30px', borderRadius: '12px', border: '1px solid #222' }}>
              <div style={{ gridColumn: '1 / span 2', borderBottom: '1px solid #222', color: '#ffcc00', paddingBottom: '10px' }}>DADOS DA OPERAÇÃO</div>
              <Input label="Número da DT" /> <Input label="Peso (KG)" />
              <Input label="Data Coleta" type="date" /> <Input label="Data Entrega" type="date" />
              <Select label="Veículo"><option>Truck</option></Select>
              <Select label="Motorista"><option>Com MOP</option></Select>
              <button type="button" style={{ gridColumn: '1 / span 2', padding: '15px', backgroundColor: '#ffcc00', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                CADASTRAR VIAGEM
              </button>
            </form>
          </div>
        )}

        {/* --- LEAD TIME (RECUPERADO) --- */}
        {abaAtiva === 'leadtime' && (
          <div>
            <h2 style={{ marginBottom: '25px' }}>Análise de Eficiência</h2>
            <LeadTimeRow motorista="João Silva" placa="ABC-1234" dt="55090" tempos={{ coleta: '02:30h', viagem: '14:20h', descarga: '01:15h' }} status="Em Viagem" />
            <LeadTimeRow motorista="Ricardo Souza" placa="XYZ-9876" dt="55091" tempos={{ coleta: '01:45h', viagem: '10:10h', descarga: '00:50h' }} status="Concluído" />
          </div>
        )}

        {/* --- ABASTECIMENTO (RECUPERADO) --- */}
        {abaAtiva === 'abastecimento' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2>Controle de Diesel</h2>
                <button style={{ padding: '10px 20px', backgroundColor: '#ffcc00', border: 'none', borderRadius: '6px', color: '#000', fontWeight: 'bold' }}>+ Abastecer</button>
            </div>
            <div style={{ backgroundColor: '#111', borderRadius: '12px', border: '1px solid #222', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1a1a1a', color: '#ffcc00', fontSize: '12px' }}>
                    <th style={{ padding: '15px' }}>DATA</th><th style={{ padding: '15px' }}>MOTORISTA</th><th style={{ padding: '15px' }}>LITROS</th><th style={{ padding: '15px' }}>TOTAL</th><th style={{ padding: '15px' }}>KM/L</th>
                  </tr>
                </thead>
                <tbody>
                   <tr style={{ borderBottom: '1px solid #222' }}><td style={{ padding: '15px' }}>21/12/2025</td><td style={{ padding: '15px' }}>João Silva</td><td style={{ padding: '15px' }}>320L</td><td style={{ padding: '15px' }}>R$ 1.850,00</td><td style={{ padding: '15px' }}>2.4</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- FOLGAS (RECUPERADO) --- */}
        {abaAtiva === 'folgas' && (
          <div>
            <h2 style={{ marginBottom: '25px' }}>Gestão de Escalas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              <FolgaCard nome="Carlos Lima" diasRestantes="2" dataRetorno="23/12/2025" status="Em Casa" />
              <FolgaCard nome="Marcos Oliveira" diasRestantes="5" dataRetorno="26/12/2025" status="Em Casa" />
            </div>
          </div>
        )}

        {/* --- MEU PERFIL --- */}
        {abaAtiva === 'perfil' && (
          <div style={{ maxWidth: '600px' }}>
            <h2 style={{ marginBottom: '25px' }}>Dados da Conta</h2>
            <div style={{ backgroundColor: '#111', padding: '40px', borderRadius: '12px', border: '1px solid #222', textAlign: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#ffcc00', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserCircle size={50} color="#000" />
              </div>
              <h1 style={{ margin: 0 }}>{usuarioLogado.nome}</h1>
              <div style={{ color: '#ffcc00', fontWeight: 'bold', marginBottom: '20px' }}>{usuarioLogado.cargo}</div>
              <div style={{ textAlign: 'left', borderTop: '1px solid #222', paddingTop: '20px' }}>
                <p style={{ color: '#555', fontSize: '11px', margin: '5px 0' }}>E-MAIL</p>
                <p style={{ marginBottom: '15px' }}>{usuarioLogado.email}</p>
                <p style={{ color: '#555', fontSize: '11px', margin: '5px 0' }}>SISTEMA DESCARGO ATIVO DESDE</p>
                <p>{usuarioLogado.desde}</p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

// --- COMPONENTES AUXILIARES ---
const StatusCard = ({ title, value, color, icon }) => (
  <div style={{ backgroundColor: '#111', padding: '20px', borderRadius: '10px', border: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div><div style={{ color: '#666', fontSize: '11px', fontWeight: 'bold' }}>{title.toUpperCase()}</div><div style={{ fontSize: '24px', fontWeight: 'bold', color: color }}>{value}</div></div>
    <div style={{ color: color, opacity: 0.5 }}>{icon}</div>
  </div>
);

const LeadTimeRow = ({ motorista, placa, dt, tempos, status }) => (
    <div style={{ backgroundColor: '#111', padding: '20px', borderRadius: '12px', border: '1px solid #222', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div><h3 style={{ margin: 0 }}>{motorista}</h3><small style={{ color: '#555' }}>DT: {dt} | PLACA: {placa}</small></div>
        <span style={{ color: status === 'Concluído' ? '#4caf50' : '#ffcc00' }}>{status}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
        <div><small style={{ color: '#555' }}>COLETA</small><div>{tempos.coleta}</div></div>
        <ArrowRight size={16} color="#222" />
        <div><small style={{ color: '#555' }}>VIAGEM</small><div>{tempos.viagem}</div></div>
        <ArrowRight size={16} color="#222" />
        <div><small style={{ color: '#555' }}>DESCARGA</small><div>{tempos.descarga}</div></div>
      </div>
    </div>
);

const FolgaCard = ({ nome, diasRestantes, dataRetorno, status }) => (
  <div style={{ backgroundColor: '#111', padding: '20px', borderRadius: '10px', border: '1px solid #222', textAlign: 'center' }}>
    <div style={{ color: '#ffcc00', fontSize: '24px', fontWeight: 'bold' }}>{diasRestantes} dias</div>
    <div style={{ fontWeight: 'bold', margin: '10px 0' }}>{nome}</div>
    <div style={{ fontSize: '11px', color: '#555' }}>Retorno: {dataRetorno}</div>
  </div>
);

const Input = ({ label, type = "text" }) => (
  <div>
    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#aaa' }}>{label}</label>
    <input type={type} style={{ width: '100%', padding: '12px', backgroundColor: '#000', border: '1px solid #222', color: '#fff', borderRadius: '6px' }} />
  </div>
);

const Select = ({ label, children }) => (
  <div>
    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#aaa' }}>{label}</label>
    <select style={{ width: '100%', padding: '12px', backgroundColor: '#000', border: '1px solid #222', color: '#fff', borderRadius: '6px' }}>{children}</select>
  </div>
);

export default PainelGestor;