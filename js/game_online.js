// ================================================================
// game_online.js – Lógica do jogo multiplayer via Firebase Firestore
// ================================================================

// -------------------- Configuração Firebase --------------------
const firebaseConfig = {
  apiKey: "AIzaSyCBAjFzRPB013mCC5mVGs-rojDla9uChk",
  authDomain: "carddia-card-game.firebaseapp.com",
  projectId: "carddia-card-game",
  storageBucket: "carddia-card-game.firebasestorage.app",
  messagingSenderId: "934272406141",
  appId: "1:934272406141:web:204496eb4f51045df15714"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// -------------------- Ler parâmetros da URL --------------------
const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get('matchId');
if (!matchId) {
  alert('ID da partida não encontrado. Redirecionando para o lobby.');
  window.location.href = 'lobby.html';
}

// -------------------- Estado Global --------------------
let estado = {
  fase: 'inicio',
  turno: 1,
  jogadorAtual: 1,
  primeiroTurno: true,
  magiasBloqueadas: false,
  hasAttacked: false,
  processandoAnimacao: false,
  log: [],
  jogadores: {
    1: criarJogadorInicial(1),
    2: criarJogadorInicial(2)
  },
  cartaSelecionada: null,
  acaoPendente: null,
  atacanteSelecionado: null
};

// Dados do jogador local e oponente
let meuId = null;         // 1 ou 2
let meuNick = '';
let oponenteNick = '';
let partidaRef = null;
let unsubscribe = null;

// -------------------- Funções Auxiliares --------------------
function criarJogadorInicial(id) {
  return {
    id,
    hp: 4000,
    deck: [],
    mao: [],
    zonaMonstros: [null, null, null],
    zonaMagias: [null, null, null],
    cemiterio: [],
    devePularCompra: false
  };
}

function nomeJogador(id) {
  if (id === 1) return meuNick || 'Você';
  if (id === 2) return oponenteNick || 'Oponente';
  return 'Jogador';
}

function embaralhar(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// -------------------- Inicialização --------------------
auth.onAuthStateChanged(user => {
  if (!user) {
    alert('Você não está logado. Redirecionando para o login.');
    window.location.href = 'index.html';
    return;
  }

  // Buscar nickname do usuário
  db.collection('users').doc(user.uid).get()
    .then(doc => {
      if (doc.exists) {
        meuNick = doc.data().nickname || 'Jogador';
      } else {
        meuNick = 'Jogador';
      }
      // Iniciar escuta da partida
      iniciarPartida(user.uid);
    })
    .catch(err => {
      console.error('Erro ao buscar usuário:', err);
      meuNick = 'Jogador';
      iniciarPartida(user.uid);
    });
});

function iniciarPartida(uid) {
  partidaRef = db.collection('matches').doc(matchId);

  // Escutar mudanças na partida
  unsubscribe = partidaRef.onSnapshot(doc => {
    if (!doc.exists) {
      alert('Partida não encontrada.');
      window.location.href = 'lobby.html';
      return;
    }
    const data = doc.data();

    // Verificar se o jogador está na partida
    const p1 = data.players.player1;
    const p2 = data.players.player2;
    if (p1 && p1.uid === uid) {
      meuId = 1;
      oponenteNick = p2 ? p2.nick : 'Oponente';
    } else if (p2 && p2.uid === uid) {
      meuId = 2;
      oponenteNick = p1 ? p1.nick : 'Oponente';
    } else {
      alert('Você não faz parte desta partida.');
      window.location.href = 'lobby.html';
      return;
    }

    // Atualizar nomes na interface
    document.getElementById('player1-name').textContent = meuId === 1 ? meuNick : oponenteNick;
    document.getElementById('player2-name').textContent = meuId === 1 ? oponenteNick : meuNick;
    document.getElementById('score-p1-label').textContent = meuId === 1 ? meuNick : oponenteNick;
    document.getElementById('score-p2-label').textContent = meuId === 1 ? oponenteNick : meuNick;

    // Se a partida ainda não tem gameState, inicializar
    if (!data.gameState) {
      // Iniciar novo jogo (só o criador ou quando ambos estiverem prontos)
      // Por simplicidade, vamos inicializar assim que o documento existir.
      // Mas só o jogador 1 inicializa? Podemos fazer ambos tentarem, mas com transação.
      // Vamos usar uma flag: se gameState for null, o primeiro que chegar inicializa.
      if (meuId === 1) {
        inicializarEstadoInicial();
      }
      return;
    }

    // Atualizar estado local com o estado vindo do servidor
    estado = data.gameState;
    // Processar ações pendentes (se houver)
    if (data.actions && data.actions.length > 0) {
      processarAcoes(data.actions);
    }
    // Renderizar
    render();
    renderLog();
    renderBotoes();

    // Verificar se o jogo terminou
    if (estado.fase === 'fim') {
      // Mostrar modal de fim de jogo
      exibirFimDeJogo();
    }

  }, err => {
    console.error('Erro ao escutar partida:', err);
    alert('Erro de conexão com a partida.');
  });
}

// -------------------- Inicializar Estado do Jogo --------------------
function inicializarEstadoInicial() {
  // Montar decks
  const deck1 = montarDeck(1);
  const deck2 = montarDeck(2);

  const jogador1 = criarJogadorInicial(1);
  jogador1.deck = deck1;
  const jogador2 = criarJogadorInicial(2);
  jogador2.deck = deck2;

  // Comprar 5 cartas iniciais
  for (let i = 0; i < 5; i++) {
    comprarCartaLocal(jogador1);
    comprarCartaLocal(jogador2);
  }

  // Sorteio de quem começa
  const primeiro = Math.random() < 0.5 ? 1 : 2;

  const novoEstado = {
    fase: 'main',
    turno: 1,
    jogadorAtual: primeiro,
    primeiroTurno: true,
    magiasBloqueadas: false,
    hasAttacked: false,
    processandoAnimacao: false,
    log: ['--- Partida iniciada! ---', `${nomeJogador(primeiro)} começa.`],
    jogadores: { 1: jogador1, 2: jogador2 },
    cartaSelecionada: null,
    acaoPendente: null,
    atacanteSelecionado: null
  };

  // Salvar no Firestore
  partidaRef.update({
    gameState: novoEstado,
    currentTurn: primeiro,
    actions: [],
    status: 'playing'
  }).catch(err => console.error('Erro ao inicializar estado:', err));
}

function montarDeck(jogadorId) {
  // Mesma lógica de montagem de deck do game.js (pode ser a mesma para ambos)
  const tier1Ids = ['m10','m11','m19','m23','m24','m27','m28','m29','m30','m37','m39','s08','s09','s12','s13','s15','t10','t11'];
  const tier2Ids = ['m05','m08','m16','m21','m25','m26','m32','m33','m34','m35','m36','m40','m41','m42','s04','s05','s10','s11','s14','s16','t08','t09'];
  const tier3Ids = ['m01','m02','m03','m04','m06','m07','m09','m12','m13','m14','m15','m17','m18','m20','m22','s01','s02','s03','s06','s07','s17','s18'];

  const allCards = [...ALL_CARDS];
  const tier3 = allCards.filter(c => tier3Ids.includes(c.id));
  const tier2 = allCards.filter(c => tier2Ids.includes(c.id));
  const tier1 = allCards.filter(c => tier1Ids.includes(c.id));

  // Deck equilibrado para ambos (pode ser diferente se quiser)
  const monstros = embaralhar([...tier3.filter(c => c.tipo === 'monstro')]).slice(0, 10);
  const magias = embaralhar([...tier3.filter(c => c.tipo === 'magia')]).slice(0, 5);
  const armadilhas = embaralhar([...tier3.filter(c => c.tipo === 'armadilha')]).slice(0, 5);
  let deck = [...monstros, ...magias, ...armadilhas];
  while (deck.length < 20) {
    deck.push(tier3[Math.floor(Math.random() * tier3.length)]);
  }
  return embaralhar(deck).slice(0, 20);
}

function comprarCartaLocal(jogador) {
  if (jogador.devePularCompra) {
    jogador.devePularCompra = false;
    return false;
  }
  if (jogador.deck.length === 0) return false;
  const carta = jogador.deck.shift();
  if (jogador.mao.length < 5) jogador.mao.push(carta);
  return true;
}

// -------------------- Enviar Ação --------------------
function enviarAcao(tipo, params) {
  if (estado.fase === 'fim') return;
  if (estado.jogadorAtual !== meuId) {
    adicionarLog('Aguarde seu turno.');
    return;
  }
  if (estado.processandoAnimacao) return;

  const acao = {
    tipo: tipo,
    jogadorId: meuId,
    params: params || {},
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  // Adicionar ao array de ações no Firestore
  partidaRef.update({
    actions: firebase.firestore.FieldValue.arrayUnion(acao)
  }).catch(err => console.error('Erro ao enviar ação:', err));
}

// -------------------- Processar Ações --------------------
let ultimaAcaoProcessada = 0;

function processarAcoes(acoes) {
  // Processar apenas as ações novas
  for (let i = ultimaAcaoProcessada; i < acoes.length; i++) {
    const acao = acoes[i];
    // Evitar processar a própria ação duas vezes (já foi aplicada localmente)
    // Mas como usamos arrayUnion, pode haver duplicatas. Vamos verificar.
    // Para simplificar, aplicamos todas as ações que não são do jogador local,
    // mas as do jogador local já foram aplicadas no momento do envio.
    // Vamos usar uma abordagem: aplicar todas as ações, mas apenas se o estado atual não tiver sido atualizado por ela.
    // Melhor: usar um campo "processed" ou controlar por timestamp.
    // Por enquanto, vamos aplicar todas as ações, pois o estado é substituído pelo gameState completo.
    // Então podemos ignorar as ações e apenas confiar no gameState.
    // Mas precisamos aplicar as ações localmente para manter a consistência.
    // Vamos fazer: se a ação for do jogador local, já foi aplicada; se for do oponente, aplicamos.
    if (acao.jogadorId !== meuId) {
      aplicarAcao(acao);
    }
  }
  ultimaAcaoProcessada = acoes.length;
}

function aplicarAcao(acao) {
  // Aqui chamamos as funções que executam a ação, mas sem enviar novamente.
  // Apenas modifica o estado local.
  switch (acao.tipo) {
    case 'INVOKE':
      // params: { maoIndex, slot, posicao }
      invocarMonstroLocal(acao.jogadorId, acao.params.maoIndex, acao.params.slot, acao.params.posicao);
      break;
    case 'BAIXAR_ARMADILHA':
      baixarArmadilhaLocal(acao.jogadorId, acao.params.maoIndex, acao.params.slot);
      break;
    case 'USAR_MAGIA':
      usarMagiaLocal(acao.jogadorId, acao.params.maoIndex, acao.params.alvo);
      break;
    case 'ATACAR':
      atacarLocal(acao.jogadorId, acao.params.atacanteSlot, acao.params.alvoTipo, acao.params.alvoSlot);
      break;
    case 'MUDAR_POSICAO':
      mudarPosicaoLocal(acao.jogadorId, acao.params.slot);
      break;
    case 'ENCERRAR_TURNO':
      encerrarTurnoLocal(acao.jogadorId);
      break;
    default:
      console.warn('Ação desconhecida:', acao.tipo);
  }
  render();
}

// -------------------- Funções Locais (aplicam ações sem enviar) --------------------
function invocarMonstroLocal(jogadorId, maoIndex, slot, posicao) {
  const jogador = estado.jogadores[jogadorId];
  const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'monstro') return false;
  if (jogador.zonaMonstros[slot] !== null) return false;

  jogador.mao.splice(maoIndex, 1);
  const ataquesRestantes = carta.efeito === 'pode_atacar_duas_vezes' ? 2 : 1;
  const monstro = {
    ...carta,
    posicao,
    jaAtacou: false,
    ataquesRestantes,
    bonusAtk: 0,
    bonusDef: 0,
    temporario: false,
    invocadoEsteTurno: true,
    posicaoMudouEsteTurno: false,
    turnoUsadoParaDuplo: 0,
    naoPodeAtacarProximoTurno: false,
    estaPreso: false
  };
  if (monstro.efeito === 'nao_pode_atacar_no_turno_invocado') monstro.ataquesRestantes = 0;

  jogador.zonaMonstros[slot] = monstro;
  adicionarLog(`${nomeJogador(jogadorId)} invocou ${carta.nome} em ${posicao}.`);
  // Efeitos de invocação (se houver) seriam aplicados aqui, mas simplificamos.
  return true;
}

function baixarArmadilhaLocal(jogadorId, maoIndex, slot) {
  const jogador = estado.jogadores[jogadorId];
  const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'armadilha') return false;
  if (jogador.zonaMagias[slot] !== null) return false;
  jogador.mao.splice(maoIndex, 1);
  jogador.zonaMagias[slot] = { ...carta, viradaParaBaixo: true };
  adicionarLog(`${nomeJogador(jogadorId)} baixou uma armadilha.`);
  return true;
}

function usarMagiaLocal(jogadorId, maoIndex, alvo) {
  // Implementação simplificada – apenas para demonstração
  // Na prática, você deve replicar a lógica completa do game.js
  const jogador = estado.jogadores[jogadorId];
  const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'magia') return false;
  jogador.mao.splice(maoIndex, 1);
  adicionarLog(`${nomeJogador(jogadorId)} usou ${carta.nome}.`);
  // Aplicar efeitos básicos (exemplo: curar)
  if (carta.efeito === 'curar_2000') {
    jogador.hp += 2000;
    adicionarLog(`${nomeJogador(jogadorId)} curou 2000 PV.`);
  }
  return true;
}

function atacarLocal(jogadorId, atacanteSlot, alvoTipo, alvoSlot) {
  // Implementação simplificada
  const atacante = estado.jogadores[jogadorId].zonaMonstros[atacanteSlot];
  if (!atacante) return;
  const defensorId = jogadorId === 1 ? 2 : 1;
  const defensor = estado.jogadores[defensorId];

  if (alvoTipo === 'jogador') {
    defensor.hp -= atacante.atk + (atacante.bonusAtk || 0);
    adicionarLog(`${atacante.nome} atacou diretamente! ${nomeJogador(defensorId)} perdeu ${atacante.atk + (atacante.bonusAtk||0)} HP.`);
  } else {
    // Atacar monstro
    const alvo = defensor.zonaMonstros[alvoSlot];
    if (!alvo) return;
    const dano = atacante.atk + (atacante.bonusAtk||0) - (alvo.def + (alvo.bonusDef||0));
    if (dano > 0) {
      defensor.zonaMonstros[alvoSlot] = null;
      defensor.cemiterio.push(alvo);
      adicionarLog(`${atacante.nome} destruiu ${alvo.nome}.`);
    } else {
      adicionarLog(`${atacante.nome} não causou dano a ${alvo.nome}.`);
    }
  }
  atacante.ataquesRestantes--;
}

function mudarPosicaoLocal(jogadorId, slot) {
  const jogador = estado.jogadores[jogadorId];
  const monstro = jogador.zonaMonstros[slot];
  if (!monstro) return;
  monstro.posicao = monstro.posicao === 'ataque' ? 'defesa' : 'ataque';
  adicionarLog(`${nomeJogador(jogadorId)} mudou ${monstro.nome} para ${monstro.posicao}.`);
}

function encerrarTurnoLocal(jogadorId) {
  if (estado.jogadorAtual !== jogadorId) return;
  // Trocar turno
  const outro = jogadorId === 1 ? 2 : 1;
  estado.jogadorAtual = outro;
  estado.turno++;
  estado.primeiroTurno = false;
  estado.hasAttacked = false;
  estado.fase = 'main';
  // Comprar carta para o próximo jogador (se for humano, será automático no próximo evento)
  adicionarLog(`--- Turno ${estado.turno} - ${nomeJogador(outro)} ---`);
  // Resetar ataquesRestantes
  for (let i = 1; i <= 2; i++) {
    estado.jogadores[i].zonaMonstros.forEach(m => {
      if (m) {
        m.ataquesRestantes = m.efeito === 'pode_atacar_duas_vezes' ? 2 : 1;
        m.jaAtacou = false;
        m.invocadoEsteTurno = false;
        m.posicaoMudouEsteTurno = false;
      }
    });
  }
  // Se o próximo jogador for IA (não temos IA no online), então é humano.
  // O jogador comprará cartas manualmente ou automaticamente.
  // Vamos fazer automático: comprar até 5
  const prox = estado.jogadores[outro];
  while (prox.mao.length < 5 && prox.deck.length > 0) {
    comprarCartaLocal(prox);
  }
  render();
  renderBotoes();
}

// -------------------- Funções de Interface (adaptadas para enviar ações) --------------------
function selecionarCartaDaMao(index) {
  if (estado.fase !== 'main' || estado.jogadorAtual !== meuId || estado.processandoAnimacao) return;
  const jogador = estado.jogadores[meuId];
  const carta = jogador.mao[index];
  if (!carta) return;

  if (carta.tipo === 'monstro') {
    // Verificar slots vazios
    const slotVazio = jogador.zonaMonstros.findIndex(s => s === null);
    if (slotVazio === -1) {
      adicionarLog('Zona de monstros cheia.');
      return;
    }
    // Mostrar modal de posição
    estado.cartaSelecionada = index;
    mostrarModalPosicao();
  } else if (carta.tipo === 'magia') {
    // Simplificado: usar magia sem alvo (ex: curar)
    // Na prática, você deve implementar a seleção de alvos.
    // Por simplicidade, usamos a magia se não precisar de alvo.
    const efeito = carta.efeito;
    if (['curar_2000', 'comprar_2', 'dano_direto_1000'].includes(efeito)) {
      enviarAcao('USAR_MAGIA', { maoIndex: index, alvo: null });
    } else {
      adicionarLog('Magia com alvo não implementada ainda.');
    }
  } else if (carta.tipo === 'armadilha') {
    const slotVazio = jogador.zonaMagias.findIndex(s => s === null);
    if (slotVazio === -1) {
      adicionarLog('Zona de magias cheia.');
      return;
    }
    enviarAcao('BAIXAR_ARMADILHA', { maoIndex: index, slot: slotVazio });
  }
}

function mostrarModalPosicao() {
  document.getElementById('modal-position').classList.remove('hidden');
}

document.getElementById('btn-ataque').addEventListener('click', () => {
  if (estado.cartaSelecionada !== null) {
    const idx = estado.cartaSelecionada;
    // Encontrar slot vazio
    const jogador = estado.jogadores[meuId];
    const slot = jogador.zonaMonstros.findIndex(s => s === null);
    if (slot !== -1) {
      enviarAcao('INVOKE', { maoIndex: idx, slot: slot, posicao: 'ataque' });
      estado.cartaSelecionada = null;
      document.getElementById('modal-position').classList.add('hidden');
    }
  }
});

document.getElementById('btn-defesa').addEventListener('click', () => {
  if (estado.cartaSelecionada !== null) {
    const idx = estado.cartaSelecionada;
    const jogador = estado.jogadores[meuId];
    const slot = jogador.zonaMonstros.findIndex(s => s === null);
    if (slot !== -1) {
      enviarAcao('INVOKE', { maoIndex: idx, slot: slot, posicao: 'defesa' });
      estado.cartaSelecionada = null;
      document.getElementById('modal-position').classList.add('hidden');
    }
  }
});

// Clique em slots (monstros)
function handleSlotClick(jogadorId, zona, slotIndex) {
  if (estado.jogadorAtual !== meuId) return;
  if (estado.fase === 'batalha' && zona === 'monstro' && jogadorId === meuId) {
    // Selecionar atacante
    if (estado.atacanteSelecionado === null) {
      const monstro = estado.jogadores[meuId].zonaMonstros[slotIndex];
      if (monstro && monstro.posicao === 'ataque' && monstro.ataquesRestantes > 0) {
        estado.atacanteSelecionado = slotIndex;
        adicionarLog(`Monstro ${monstro.nome} selecionado. Escolha o alvo.`);
        // Destacar alvos
        destacarAlvos();
      }
    } else if (estado.atacanteSelecionado === slotIndex) {
      // Desmarcar
      estado.atacanteSelecionado = null;
      limparDestaques();
      adicionarLog('Seleção cancelada.');
    }
  } else if (jogadorId !== meuId && zona === 'monstro' && estado.atacanteSelecionado !== null) {
    // Atacar monstro do oponente
    enviarAcao('ATACAR', {
      atacanteSlot: estado.atacanteSelecionado,
      alvoTipo: 'monstro',
      alvoSlot: slotIndex
    });
    estado.atacanteSelecionado = null;
    limparDestaques();
  } else if (jogadorId === meuId && zona === 'monstro' && estado.fase === 'main') {
    // Mudar posição (se não tiver atacado ainda)
    if (!estado.hasAttacked) {
      enviarAcao('MUDAR_POSICAO', { slot: slotIndex });
    }
  }
}

// Clique no HP do oponente (ataque direto)
document.getElementById('hp-p2').addEventListener('click', () => {
  if (estado.fase === 'batalha' && estado.jogadorAtual === meuId && estado.atacanteSelecionado !== null) {
    enviarAcao('ATACAR', {
      atacanteSlot: estado.atacanteSelecionado,
      alvoTipo: 'jogador',
      alvoSlot: null
    });
    estado.atacanteSelecionado = null;
    limparDestaques();
  }
});

function destacarAlvos() {
  const slots = document.querySelectorAll('#monstro-slots-p2 .slot');
  slots.forEach(slot => {
    const index = parseInt(slot.dataset.slot);
    if (estado.jogadores[2].zonaMonstros[index] !== null) {
      slot.classList.add('highlight');
    }
  });
  // Se não houver monstros, destacar HP
  const temMonstro = estado.jogadores[2].zonaMonstros.some(m => m !== null);
  if (!temMonstro) {
    document.getElementById('hp-p2').classList.add('highlight-target');
  }
}

function limparDestaques() {
  document.querySelectorAll('.slot.highlight').forEach(el => el.classList.remove('highlight'));
  document.getElementById('hp-p2')?.classList.remove('highlight-target');
  document.getElementById('hp-p1')?.classList.remove('highlight-target');
}

// Botões de ação
document.getElementById('btn-atacar').addEventListener('click', () => {
  if (estado.fase === 'main' && estado.jogadorAtual === meuId && !estado.hasAttacked && !estado.primeiroTurno) {
    estado.fase = 'batalha';
    estado.atacanteSelecionado = null;
    adicionarLog('Fase de batalha iniciada. Selecione um monstro atacante.');
    renderBotoes();
    // Destacar atacantes disponíveis
    const slots = document.querySelectorAll('#monstro-slots-p1 .slot');
    slots.forEach(slot => {
      const idx = parseInt(slot.dataset.slot);
      const m = estado.jogadores[meuId].zonaMonstros[idx];
      if (m && m.posicao === 'ataque' && m.ataquesRestantes > 0) {
        slot.classList.add('highlight');
      }
    });
  }
});

document.getElementById('btn-encerrar').addEventListener('click', () => {
  if (estado.jogadorAtual === meuId && (estado.fase === 'main' || estado.fase === 'batalha')) {
    enviarAcao('ENCERRAR_TURNO', {});
  }
});

// -------------------- Renderização (similar ao game.js) --------------------
function render() {
  renderInfoJogadores();
  renderZonas();
  renderMao();
  renderBotoes();
}

function renderInfoJogadores() {
  document.getElementById('hp-p1').textContent = estado.jogadores[1].hp;
  document.getElementById('hp-p2').textContent = estado.jogadores[2].hp;
  document.getElementById('deck-p1').textContent = estado.jogadores[1].deck.length;
  document.getElementById('deck-p2').textContent = estado.jogadores[2].deck.length;
}

function renderZonas() {
  for (let i = 1; i <= 2; i++) {
    const zonaMonstros = document.getElementById(`monstro-slots-p${i}`);
    const zonaMagias = document.getElementById(`magia-slots-p${i}`);
    zonaMonstros.innerHTML = '';
    zonaMagias.innerHTML = '';
    for (let j = 0; j < 3; j++) {
      // Monstros
      const slotM = document.createElement('div');
      slotM.className = 'slot';
      slotM.dataset.jogador = i;
      slotM.dataset.zona = 'monstro';
      slotM.dataset.slot = j;
      const monstro = estado.jogadores[i].zonaMonstros[j];
      if (monstro) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        if (monstro.posicao === 'defesa') cardDiv.classList.add('defense');
        cardDiv.innerHTML = `<div class="card-name">${monstro.nome}</div>
                             <div class="card-stats"><span>ATK ${monstro.atk + (monstro.bonusAtk||0)}</span><span>DEF ${monstro.def + (monstro.bonusDef||0)}</span></div>
                             <div class="card-position">${monstro.posicao === 'ataque' ? 'ATQ' : 'DEF'}</div>`;
        slotM.appendChild(cardDiv);
      }
      slotM.addEventListener('click', () => handleSlotClick(i, 'monstro', j));
      zonaMonstros.appendChild(slotM);

      // Magias/Armadilhas
      const slotMa = document.createElement('div');
      slotMa.className = 'slot';
      slotMa.dataset.jogador = i;
      slotMa.dataset.zona = 'magia';
      slotMa.dataset.slot = j;
      const carta = estado.jogadores[i].zonaMagias[j];
      if (carta) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        if (carta.viradaParaBaixo && i === 2) {
          cardDiv.classList.add('facedown');
          cardDiv.textContent = '?';
        } else {
          if (carta.viradaParaBaixo && i === 1) cardDiv.classList.add('facedown-own');
          cardDiv.innerHTML = `<div class="card-name">${carta.nome}</div><div>${carta.tipo}</div>`;
        }
        slotMa.appendChild(cardDiv);
      }
      slotMa.addEventListener('click', () => handleSlotClick(i, 'magia', j));
      zonaMagias.appendChild(slotMa);
    }
  }
}

function renderMao() {
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = '';
  if (estado.jogadorAtual === meuId) {
    const jogador = estado.jogadores[meuId];
    jogador.mao.forEach((carta, index) => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'hand-card';
      cardDiv.dataset.index = index;
      let info = `<div class="card-name">${carta.nome}</div>`;
      if (carta.tipo === 'monstro') info += `<div class="card-stats"><span>ATK ${carta.atk}</span><span>DEF ${carta.def}</span></div>`;
      else if (carta.tipo === 'magia') info += `<div>${carta.descricao || 'Magia'}</div>`;
      else info += `<div>${carta.descricao || 'Armadilha'}</div>`;
      cardDiv.innerHTML = info;
      cardDiv.addEventListener('click', () => selecionarCartaDaMao(index));
      handDiv.appendChild(cardDiv);
    });
  } else {
    // Mostrar cartas viradas do oponente
    const jogador = estado.jogadores[meuId === 1 ? 2 : 1];
    for (let i = 0; i < jogador.mao.length; i++) {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'hand-card';
      cardDiv.style.backgroundColor = '#2c3e50';
      cardDiv.style.color = 'white';
      cardDiv.textContent = '?';
      handDiv.appendChild(cardDiv);
    }
  }
}

function renderBotoes() {
  const btnAtacar = document.getElementById('btn-atacar');
  const btnEncerrar = document.getElementById('btn-encerrar');
  const isMyTurn = estado.jogadorAtual === meuId && !estado.processandoAnimacao;
  if (estado.fase === 'main' && isMyTurn) {
    btnAtacar.disabled = !(estado.turno !== 1 && !estado.hasAttacked && !estado.primeiroTurno);
    btnEncerrar.disabled = false;
  } else if (estado.fase === 'batalha' && isMyTurn) {
    btnAtacar.disabled = true;
    btnEncerrar.disabled = false;
  } else {
    btnAtacar.disabled = true;
    btnEncerrar.disabled = true;
  }
}

function renderLog() {
  const logDiv = document.getElementById('log');
  logDiv.innerHTML = estado.log.slice(-15).map(msg => `<div>${msg}</div>`).join('');
  logDiv.scrollTop = logDiv.scrollHeight;
}

function adicionarLog(msg) {
  estado.log.push(msg);
  renderLog();
  // Também salvar no Firestore? Pode ser útil, mas não obrigatório.
  // Vamos atualizar o gameState com o log atualizado.
  atualizarEstadoFirestore();
}

function atualizarEstadoFirestore() {
  partidaRef.update({
    'gameState': estado
  }).catch(err => console.error('Erro ao salvar estado:', err));
}

// -------------------- Sair --------------------
function sairDaPartida() {
  if (confirm('Deseja sair da partida?')) {
    if (unsubscribe) unsubscribe();
    window.location.href = 'lobby.html';
  }
}

// -------------------- Inicialização --------------------
// Após o carregamento, a partida é iniciada via onAuthStateChanged.
// Mas também podemos forçar a renderização inicial.
window.onload = function() {
  // O estado será preenchido pelo listener.
};

// Exportar para uso em outros scripts (se necessário)
window.estado = estado;
window.enviarAcao = enviarAcao;
window.sairDaPartida = sairDaPartida;