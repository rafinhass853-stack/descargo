// ... (mantém todos os imports e configurações Firebase)

export default function App() {
  const mapRef = useRef(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [cargaAtiva, setCargaAtiva] = useState(null);
  const [destinoCoords, setDestinoCoords] = useState(null);

  const [statusOperacional, setStatusOperacional] = useState('Sem programação');
  const [statusJornada, setStatusJornada] = useState('fora da jornada');

  // ESCUTA CARGAS
  useEffect(() => {
    if (isLoggedIn && user) {
      const q = query(
        collection(db, "notificacoes_cargas"),
        where("motoristaEmail", "==", user.email),
        where("status", "in", ["pendente", "aceito"])
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const dados = change.doc.data();
          const id = change.doc.id;

          if (change.type === "added" && dados.status === "pendente") {
            Alert.alert(
              "🚛 VIAGEM PROGRAMADA",
              `DT: ${dados.dt}\n📍 COLETA: ${dados.clienteColeta}\n🏁 ENTREGA: ${dados.clienteEntrega}`,
              [
                { text: "RECUSAR", style: "cancel" },
                { text: "ACEITAR", onPress: () => aceitarCarga(id, dados) }
              ]
            );
          }

          if (dados.status === "aceito") {
            setCargaAtiva({ id, ...dados });
          }
        });
      });

      return () => unsubscribe();
    }
  }, [isLoggedIn, user]);

  const aceitarCarga = async (docId, dadosCarga) => {
    try {
      await updateDoc(doc(db, "notificacoes_cargas", docId), {
        status: "aceito",
        lidoEm: new Date()
      });
      setCargaAtiva({ id: docId, ...dadosCarga });
      setStatusOperacional('Viagem vazio'); 
    } catch {
      Alert.alert("Erro", "Não foi possível confirmar.");
    }
  };

  const alternarJornada = () => {
    setStatusJornada(
      statusJornada === 'dentro da jornada'
        ? 'fora da jornada'
        : 'dentro da jornada'
    );
  };

  const selecionarStatusOperacional = () => {
    Alert.alert("Alterar Status", "Como está a operação agora?", [
      { text: "Sem programação", onPress: () => setStatusOperacional("Sem programação") },
      { text: "Viagem vazio", onPress: () => setStatusOperacional("Viagem vazio") },
      { text: "Viagem carregado", onPress: () => setStatusOperacional("Viagem carregado") },
      { text: "Manutenção", onPress: () => setStatusOperacional("Manutenção") },
      { text: "Cancelar", style: "cancel" }
    ]);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert('Atenção', 'Preencha os campos.');
    }

    setLoading(true);
    try {
      const response = await signInWithEmailAndPassword(auth, email, password);
      setUser(response.user);
      setIsLoggedIn(true);
    } catch {
      Alert.alert('Falha no Login', 'E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsLoggedIn(false);
      setUser(null);
      setEmail('');
      setPassword('');
      setCargaAtiva(null);
      setDestinoCoords(null);
      setStatusOperacional('Sem programação');
      setStatusJornada('fora da jornada');
    } catch {
      Alert.alert('Erro', 'Não foi possível sair.');
    }
  };

  const centralizarNoGPS = () => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion({
        ...location,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      });
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        let curLocation = await Location.getCurrentPositionAsync({});
        setLocation(curLocation.coords);
      })();
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.logoText}>DESCARGO</Text>
              <View style={styles.underline} />
              <Text style={styles.subtitle}>PAINEL DO MOTORISTA</Text>
            </View>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="E-mail"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Senha"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <TouchableOpacity style={styles.button} onPress={handleLogin}>
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={styles.buttonText}>ENTRAR NO SISTEMA</Text>
                }
              </TouchableOpacity>
            </View>

            {/* REDES SOCIAIS */}
            <View style={styles.socialContainer}>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.linkedin.com/in/rafael-araujo1992/')}>
                <FontAwesome name="linkedin-square" size={32} color="#0e76a8" style={styles.socialIcon}/>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.instagram.com/rafael.araujo1992/')}>
                <FontAwesome name="instagram" size={32} color="#c13584" style={styles.socialIcon}/>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('mailto:rafinhass853@gmail.com')}>
                <FontAwesome name="envelope" size={32} color="#f39c12" style={styles.socialIcon}/>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('tel:16988318626')}>
                <FontAwesome name="whatsapp" size={32} color="#25D366" style={styles.socialIcon}/>
              </TouchableOpacity>
            </View>
            <Text style={styles.signature}>Desenvolvido por Rafael Araujo</Text>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* MAPA */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        mapType="hybrid"
        showsUserLocation
        initialRegion={{
          latitude: -23.5505,
          longitude: -46.6333,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {location && destinoCoords && (
          <MapViewDirections
            origin={location}
            destination={destinoCoords}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor="#FFD700"
          />
        )}
      </MapView>

      {/* STATUS */}
      <View style={styles.topStatusContainer}>
        <TouchableOpacity style={styles.statusBox} onPress={selecionarStatusOperacional}>
          <Text style={styles.statusLabel}>STATUS</Text>
          <Text style={styles.statusValue}>{statusOperacional.toUpperCase()}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusBox,
            { borderColor: statusJornada === 'dentro da jornada' ? '#2ecc71' : '#444' }
          ]}
          onPress={alternarJornada}
        >
          <Text style={styles.statusLabel}>JORNADA</Text>
          <Text
            style={[
              styles.statusValue,
              { color: statusJornada === 'dentro da jornada' ? '#2ecc71' : '#888' }
            ]}
          >
            {statusJornada.toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB BAR */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="home" size={24} color="#FFD700" />
          <Text style={[styles.tabText, { color: '#FFD700' }]}>Início</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <MaterialCommunityIcons name="shield-account" size={24} color="#888" />
          <Text style={styles.tabText}>Conta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <FontAwesome name="briefcase" size={22} color="#888" />
          <Text style={styles.tabText}>Operação</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="calendar" size={24} color="#888" />
          <Text style={styles.tabText}>Escala</Text>
        </TouchableOpacity>
      </View>

      {/* BOTÃO GPS */}
      <TouchableOpacity style={styles.gpsButton} onPress={centralizarNoGPS}>
        <Ionicons name="navigate-circle-outline" size={36} color="#FFD700" />
      </TouchableOpacity>

      {/* BOTÃO SAIR COM CONFIRMAÇÃO */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => {
          Alert.alert(
            "Confirmação",
            "Deseja realmente sair do app?",
            [
              { text: "Cancelar", style: "cancel" },
              { text: "Sair", style: "destructive", onPress: handleLogout }
            ]
          );
        }}
      >
        <Ionicons name="log-out-outline" size={20} color="#FFD700" />
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { width: '100%', height: '100%' },

  logoutButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 20 : 15,
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    zIndex: 999,
  },
  logoutText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 6,
  },

  gpsButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 80 : 70,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 5,
    borderRadius: 25,
    zIndex: 998,
  },

  topStatusContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 15,
    right: 15,
    flexDirection: 'row',
    gap: 10,
  },

  statusBox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },

  statusLabel: { color: '#666', fontSize: 9, fontWeight: 'bold' },
  statusValue: { fontSize: 11, fontWeight: '900', color: '#FFD700' },

  loginContainer: { flex: 1, backgroundColor: '#000' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 30 },
  header: { alignItems: 'center', marginBottom: 60 },
  logoText: { fontSize: 48, fontWeight: '900', color: '#FFD700' },
  underline: { height: 3, width: 65, backgroundColor: '#D97706' },
  subtitle: { color: '#888', fontSize: 13, marginTop: 25 },

  form: { width: '100%' },
  input: {
    backgroundColor: '#111',
    color: '#FFF',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#222'
  },
  button: {
    backgroundColor: '#FFD700',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center'
  },
  buttonText: { color: '#000', fontWeight: '900' },

  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20
  },
  socialIcon: {
    marginHorizontal: 10
  },
  signature: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10
  },

  tabBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#000',
    paddingBottom: Platform.OS === 'ios' ? 30 : 15
  },
  tabItem: { alignItems: 'center' },
  tabText: { color: '#888', fontSize: 10, marginTop: 4 }
});
