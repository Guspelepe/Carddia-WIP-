// game.js
// Lógica principal do jogo, sem custo de Fé para invocações.
// Inclui batalha interativa, regras de dano Yu-Gi-Oh, sorteio e efeitos visuais.

const estado = {
  fase: 'inicio', // 'inicio', 'main', 'batalha', 'fim'
  turno: 1,
  jogadorAtual: 1,
  primeiroTurno: true,
  campeonato: {
    vitoriasJ1: 0,
    vitoriasJ2: 0,
    rodadaAtual: 1,
    historico: []
  },
  jogadores: {
    1: criarJogadorInicial(1),
    2: criarJogadorInicial(2)
  },
  deckCompartilhado: [...ALL_CARDS],
  cartaSelecionada: null,
  acaoPendente: null,
  atacanteSelecionado: null,
  hasAttacked: false,
  processandoAnimacao: false,
  log: []
};

function criarJogadorInicial(id) {
  return {
    id,
    hp: 4000,
    deck: [],
    mao: [],
    zonaMonstros: [null, null, null],
    zonaMagias: [null, null, null]
  };
}

// ==================== FUNÇÕES AUXILIARES ====================
function embaralhar(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function comprarCarta(jogadorId, quantidade = 1) {
  const jogador = estado.jogadores[jogadorId];
  for (let i = 0; i < quantidade; i++) {
    if (jogador.deck.length === 0) {
      finalizarDuelo(jogadorId === 1 ? 2 : 1, 'Deck vazio');
      return false;
    }
    const carta = jogador.deck.shift();
    if (jogador.mao.length < 5) {
      jogador.mao.push(carta);
    }
  }
  return true;
}

function adicionarLog(mensagem) {
  estado.log.push(mensagem);
  renderLog();
}

// ==================== INICIALIZAÇÃO ====================
function iniciarCampeonato() {
  estado.campeonato.vitoriasJ1 = 0;
  estado.campeonato.vitoriasJ2 = 0;
  estado.campeonato.rodadaAtual = 1;
  iniciarNovoDuelo();
}

function iniciarNovoDuelo() {
  estado.jogadores[1] = criarJogadorInicial(1);
  estado.jogadores[2] = criarJogadorInicial(2);

  const deckCompleto = [...ALL_CARDS];
  embaralhar(deckCompleto);
  estado.jogadores[1].deck = deckCompleto.slice(0, 20);
  estado.jogadores[2].deck = deckCompleto.slice(20, 40);

  for (let i = 0; i < 5; i++) {
    comprarCarta(1);
    comprarCarta(2);
  }

  // Sorteio de quem começa
  estado.jogadorAtual = Math.random() < 0.5 ? 1 : 2;
  estado.turno = 1;
  estado.primeiroTurno = true;
  estado.hasAttacked = false;
  estado.fase = 'main';
  estado.cartaSelecionada = null;
  estado.acaoPendente = null;
  estado.atacanteSelecionado = null;
  estado.processandoAnimacao = false;

  render();
  adicionarLog(`--- Novo duelo iniciado! Sorteio: Jogador ${estado.jogadorAtual} começa. ---`);
  if (estado.jogadorAtual === 1) {
    adicionarLog('Você não pode atacar no primeiro turno.');
  } else {
    setTimeout(() => aiTurn(estado), 1200);
  }
}

// ==================== TROCA DE TURNOS ====================
function encerrarTurno() {
  if (estado.fase === 'fim') return;

  // Resetar flags de ataque
  estado.jogadores[1].zonaMonstros.forEach(m => { if (m) m.jaAtacou = false; });
  estado.jogadores[2].zonaMonstros.forEach(m => { if (m) m.jaAtacou = false; });

  // Passar para o outro jogador
  estado.jogadorAtual = estado.jogadorAtual === 1 ? 2 : 1;
  estado.turno++;
  estado.primeiroTurno = false;
  estado.hasAttacked = false;
  estado.fase = 'main';
  estado.cartaSelecionada = null;
  estado.acaoPendente = null;
  estado.atacanteSelecionado = null;
  estado.processandoAnimacao = false;
  limparDestaques();

  const jogador = estado.jogadores[estado.jogadorAtual];
  if (!comprarCarta(estado.jogadorAtual, 5 - jogador.mao.length)) {
    return;
  }

  render();
  adicionarLog(`--- Turno ${estado.turno} - Jogador ${estado.jogadorAtual} ---`);

  if (estado.jogadorAtual === 2) {
    setTimeout(() => aiTurn(estado), 1200);
  }
}

// ==================== AÇÕES DO JOGADOR ====================
function selecionarCartaDaMao(index) {
  if (estado.fase !== 'main' || estado.jogadorAtual !== 1 || estado.processandoAnimacao) return;
  const jogador = estado.jogadores[1];
  if (index >= jogador.mao.length) return;
  const carta = jogador.mao[index];

  estado.cartaSelecionada = null;
  estado.acaoPendente = null;
  estado.atacanteSelecionado = null;
  limparDestaques();
  esconderModalPosicao();

  if (carta.tipo === 'monstro') {
    const slotsVazios = jogador.zonaMonstros.filter(slot => slot === null).length;
    if (slotsVazios === 0) {
      adicionarLog('Sua zona de monstros está cheia.');
      return;
    }
    estado.cartaSelecionada = index;
    mostrarModalPosicao();
  } else if (carta.tipo === 'magia') {
    estado.cartaSelecionada = index;
    if (carta.efeito === 'buff_500') {
      estado.acaoPendente = { tipo: 'magia_buff' };
      destacarMonstrosProprios();
      adicionarLog('Escolha um monstro seu para receber +500 de ATK.');
    } else if (carta.efeito === 'destruir_inimigo') {
      estado.acaoPendente = { tipo: 'magia_destruir' };
      destacarMonstrosInimigos();
      adicionarLog('Escolha um monstro inimigo para destruir.');
    } else if (carta.efeito === 'comprar_2') {
      usarMagia(1, index, null);
    }
  } else if (carta.tipo === 'armadilha') {
    const slotVazio = jogador.zonaMagias.findIndex(slot => slot === null);
    if (slotVazio !== -1) {
      baixarArmadilha(1, index, slotVazio);
    } else {
      adicionarLog('Zona de magias/armadilhas cheia.');
    }
  }
}

// Modal de posição
function mostrarModalPosicao() {
  document.getElementById('modal-position').classList.remove('hidden');
}
function esconderModalPosicao() {
  document.getElementById('modal-position').classList.add('hidden');
}

document.getElementById('btn-ataque').addEventListener('click', () => {
  if (estado.cartaSelecionada !== null) {
    estado.acaoPendente = { tipo: 'invocar', posicao: 'ataque' };
    esconderModalPosicao();
    destacarSlotsMonstroVazios(1);
    adicionarLog(`Selecione um slot vazio para invocar ${estado.jogadores[1].mao[estado.cartaSelecionada].nome} em ataque.`);
  }
});
document.getElementById('btn-defesa').addEventListener('click', () => {
  if (estado.cartaSelecionada !== null) {
    estado.acaoPendente = { tipo: 'invocar', posicao: 'defesa' };
    esconderModalPosicao();
    destacarSlotsMonstroVazios(1);
    adicionarLog(`Selecione um slot vazio para invocar ${estado.jogadores[1].mao[estado.cartaSelecionada].nome} em defesa.`);
  }
});

function invocarMonstro(jogadorId, maoIndex, slotIndex, posicao) {
  const jogador = estado.jogadores[jogadorId];
  const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'monstro') return false;
  if (slotIndex < 0 || slotIndex > 2 || jogador.zonaMonstros[slotIndex] !== null) return false;

  jogador.mao.splice(maoIndex, 1);
  jogador.zonaMonstros[slotIndex] = { ...carta, posicao, jaAtacou: false };
  adicionarLog(`Jogador ${jogadorId} invocou ${carta.nome} na posição ${posicao}.`);
  verificarArmadilhaInvocacao(jogadorId, slotIndex);

  if (jogadorId === 1) {
    estado.cartaSelecionada = null;
    estado.acaoPendente = null;
    limparDestaques();
    esconderModalPosicao();
  }
  render();
  animarCarta(jogadorId, 'monstro', slotIndex);
  return true;
}

function baixarArmadilha(jogadorId, maoIndex, slotIndex) {
  const jogador = estado.jogadores[jogadorId];
  const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'armadilha') return false;
  if (slotIndex < 0 || slotIndex > 2 || jogador.zonaMagias[slotIndex] !== null) return false;

  jogador.mao.splice(maoIndex, 1);
  jogador.zonaMagias[slotIndex] = { ...carta, viradaParaBaixo: true };
  adicionarLog(`Jogador ${jogadorId} baixou uma armadilha.`);
  if (jogadorId === 1) {
    estado.cartaSelecionada = null;
    estado.acaoPendente = null;
    limparDestaques();
  }
  render();
  animarCarta(jogadorId, 'magia', slotIndex);
  return true;
}

function usarMagia(jogadorId, maoIndex, alvo) {
  const jogador = estado.jogadores[jogadorId];
  const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'magia') return false;

  // Efeito de ativação da magia: animar a carta da mão se for humano
  if (jogadorId === 1) {
    const handCard = document.querySelector(`.hand-card[data-index="${maoIndex}"]`);
    if (handCard) {
      handCard.classList.add('magic-activating');
      setTimeout(() => {
        handCard.remove();
      }, 800);
    }
  } else {
    // Para IA, apenas removemos e mostramos efeito no alvo/geral
    adicionarLog(`Jogador 2 ativou ${carta.nome}.`);
  }

  jogador.mao.splice(maoIndex, 1);

  switch (carta.efeito) {
    case 'buff_500':
      if (alvo && alvo.tipo === 'proprio') {
        const monstro = jogador.zonaMonstros[alvo.slot];
        if (monstro) {
          monstro.atk += 500;
          adicionarLog(`${monstro.nome} ganhou +500 de ATK.`);
          animarCarta(jogadorId, 'monstro', alvo.slot);
        }
      }
      break;
    case 'destruir_inimigo':
      if (alvo && alvo.tipo === 'inimigo') {
        const inimigoId = jogadorId === 1 ? 2 : 1;
        const inimigo = estado.jogadores[inimigoId];
        const monstro = inimigo.zonaMonstros[alvo.slot];
        if (monstro) {
          // Animação de destruição: brilho no alvo
          animarCarta(inimigoId, 'monstro', alvo.slot, 'destroy');
          setTimeout(() => {
            inimigo.zonaMonstros[alvo.slot] = null;
            adicionarLog(`${monstro.nome} foi destruído por Raios de Zeus.`);
            aplicarEfeitoMorte(monstro, inimigoId);
            render();
          }, 600);
        }
      }
      break;
    case 'comprar_2':
      comprarCarta(jogadorId, 2);
      adicionarLog(`Jogador ${jogadorId} comprou 2 cartas.`);
      break;
  }

  if (jogadorId === 1) {
    estado.cartaSelecionada = null;
    estado.acaoPendente = null;
    limparDestaques();
  }
  render();
  return true;
}

// ==================== ARMADILHAS ====================
function verificarArmadilhaInvocacao(jogadorInvoker, slotIndex) {
  const invocador = estado.jogadores[jogadorInvoker];
  const oponenteId = jogadorInvoker === 1 ? 2 : 1;
  const oponente = estado.jogadores[oponenteId];
  const monstro = invocador.zonaMonstros[slotIndex];
  if (!monstro) return;

  for (let i = 0; i < oponente.zonaMagias.length; i++) {
    const armadilha = oponente.zonaMagias[i];
    if (armadilha && armadilha.tipo === 'armadilha' && armadilha.viradaParaBaixo && armadilha.efeito === 'armadilha_ira') {
      if (monstro.atk > 2000) {
        // Ativar armadilha: virar para cima e animar
        oponente.zonaMagias[i].viradaParaBaixo = false;
        render();
        animarCarta(oponenteId, 'magia', i, 'trap');
        adicionarLog(`Armadilha "Ira do Submundo" ativada!`);
        setTimeout(() => {
          invocador.zonaMonstros[slotIndex] = null;
          oponente.zonaMagias[i] = null;
          adicionarLog(`${monstro.nome} foi destruído.`);
          aplicarEfeitoMorte(monstro, jogadorInvoker);
          render();
        }, 800);
        break;
      }
    }
  }
}

function aplicarEfeitoMorte(monstro, jogadorId) {
  if (monstro.efeito === 'quando_morre_ganha_500_vida') {
    const jogador = estado.jogadores[jogadorId];
    jogador.hp += 500;
    adicionarLog(`${jogadorId === 1 ? 'Jogador 1' : 'Jogador 2'} ganhou 500 de vida (${monstro.nome}).`);
  }
}

// ==================== BATALHA INTERATIVA ====================
function iniciarBatalha() {
  if (estado.fase !== 'main' || estado.jogadorAtual !== 1 || estado.hasAttacked || estado.processandoAnimacao) return;
  if (estado.primeiroTurno && estado.jogadorAtual === 1) {
    adicionarLog('Você não pode atacar no primeiro turno.');
    return;
  }

  const temAtacantes = estado.jogadores[1].zonaMonstros.some(m => m && m.posicao === 'ataque' && !m.jaAtacou);
  if (!temAtacantes) {
    adicionarLog('Nenhum monstro em posição de ataque disponível para atacar.');
    return;
  }

  estado.fase = 'batalha';
  estado.atacanteSelecionado = null;
  estado.acaoPendente = null;
  limparDestaques();
  destacarAtacantesDisponiveis(1);
  adicionarLog('Selecione um monstro atacante.');
  renderBotoes();
}

function destacarAtacantesDisponiveis(jogadorId) {
  const slots = document.querySelectorAll(`#monstro-slots-p${jogadorId} .slot`);
  slots.forEach(slot => {
    const index = parseInt(slot.dataset.slot);
    const monstro = estado.jogadores[jogadorId].zonaMonstros[index];
    if (monstro && monstro.posicao === 'ataque' && !monstro.jaAtacou) {
      slot.classList.add('highlight');
    }
  });
}

function selecionarAtacante(slotIndex) {
  if (estado.fase !== 'batalha' || estado.jogadorAtual !== 1 || estado.processandoAnimacao) return;
  const monstro = estado.jogadores[1].zonaMonstros[slotIndex];
  if (!monstro || monstro.posicao !== 'ataque' || monstro.jaAtacou) return;

  estado.atacanteSelecionado = slotIndex;
  limparDestaques();
  destacarAlvosInimigos();
  document.getElementById('hp-p2').classList.add('highlight-target');
  adicionarLog(`Monstro selecionado: ${monstro.nome}. Escolha um alvo.`);
}

function destacarAlvosInimigos() {
  const slots = document.querySelectorAll(`#monstro-slots-p2 .slot`);
  slots.forEach(slot => {
    const index = parseInt(slot.dataset.slot);
    if (estado.jogadores[2].zonaMonstros[index] !== null) {
      slot.classList.add('highlight');
    }
  });
}

// Função para animar ataque: adiciona classes e depois resolve
function animarAtaque(atacanteSlot, defensorSlot, jogadorAtacanteId, jogadorDefensorId) {
  return new Promise(resolve => {
    const atacanteElement = document.querySelector(`#monstro-slots-p${jogadorAtacanteId} .slot[data-slot="${atacanteSlot}"] .card`);
    const defensorElement = defensorSlot !== null ? document.querySelector(`#monstro-slots-p${jogadorDefensorId} .slot[data-slot="${defensorSlot}"] .card`) : null;
    if (atacanteElement) atacanteElement.classList.add('attacking');
    if (defensorElement) defensorElement.classList.add('defending');
    setTimeout(() => {
      if (atacanteElement) atacanteElement.classList.remove('attacking');
      if (defensorElement) defensorElement.classList.remove('defending');
      resolve();
    }, 600);
  });
}

// Função para executar ataque do jogador humano (async)
async function executarAtaque(atacanteSlot, alvoTipo, alvoSlot) {
  if (estado.fase !== 'batalha' || estado.jogadorAtual !== 1 || estado.processandoAnimacao) return;
  const atacante = estado.jogadores[1].zonaMonstros[atacanteSlot];
  if (!atacante || atacante.jaAtacou) return;

  const defensorId = 2;
  const defensor = estado.jogadores[defensorId];

  // Verificar armadilha escudo
  for (let j = 0; j < defensor.zonaMagias.length; j++) {
    const armadilha = defensor.zonaMagias[j];
    if (armadilha && armadilha.tipo === 'armadilha' && armadilha.viradaParaBaixo && armadilha.efeito === 'armadilha_escudo') {
      // Ativar escudo
      defensor.zonaMagias[j].viradaParaBaixo = false;
      render();
      animarCarta(defensorId, 'magia', j, 'trap');
      adicionarLog(`Armadilha "Escudo de Atenas" ativada!`);
      await delay(800);
      atacante.posicao = 'defesa';
      defensor.zonaMagias[j] = null;
      atacante.jaAtacou = true;
      estado.atacanteSelecionado = null;
      limparDestaques();
      render();
      verificarFimBatalha();
      return;
    }
  }

  // Animar ataque
  estado.processandoAnimacao = true;
  let alvoSlotDefensor = alvoTipo === 'monstro' ? alvoSlot : null;
  await animarAtaque(atacanteSlot, alvoSlotDefensor, 1, 2);

  // Aplicar dano
  if (alvoTipo === 'jogador') {
    defensor.hp -= atacante.atk;
    adicionarLog(`${atacante.nome} atacou diretamente! Jogador 2 perdeu ${atacante.atk} HP.`);
    atacante.jaAtacou = true;
    if (defensor.hp <= 0) {
      finalizarDuelo(1, 'HP zerado');
      return;
    }
  } else if (alvoTipo === 'monstro') {
    const monstroDefensor = defensor.zonaMonstros[alvoSlot];
    if (monstroDefensor) {
      resolverBatalha(1, 2, atacanteSlot, alvoSlot);
      atacante.jaAtacou = true;
    }
  }

  estado.processandoAnimacao = false;
  estado.atacanteSelecionado = null;
  limparDestaques();
  render();
  verificarFimBatalha();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function verificarFimBatalha() {
  const aindaPodeAtacar = estado.jogadores[1].zonaMonstros.some(m => m && m.posicao === 'ataque' && !m.jaAtacou);
  if (aindaPodeAtacar) {
    destacarAtacantesDisponiveis(1);
    adicionarLog('Selecione outro monstro atacante ou encerre a batalha.');
  } else {
    adicionarLog('Todos os monstros atacaram. Encerre a batalha ou o turno.');
    renderBotoes();
  }
}

function resolverBatalha(jogadorAtacanteId, jogadorDefensorId, slotAtacante, slotDefensor) {
  const atacante = estado.jogadores[jogadorAtacanteId].zonaMonstros[slotAtacante];
  const defensor = estado.jogadores[jogadorDefensorId].zonaMonstros[slotDefensor];
  if (!atacante || !defensor) return;

  if (defensor.posicao === 'ataque') {
    const dif = atacante.atk - defensor.atk;
    if (dif > 0) {
      estado.jogadores[jogadorDefensorId].zonaMonstros[slotDefensor] = null;
      estado.jogadores[jogadorDefensorId].hp -= dif;
      adicionarLog(`${defensor.nome} destruído! Jogador ${jogadorDefensorId} perdeu ${dif} HP.`);
      aplicarEfeitoMorte(defensor, jogadorDefensorId);
    } else if (dif === 0) {
      estado.jogadores[jogadorAtacanteId].zonaMonstros[slotAtacante] = null;
      estado.jogadores[jogadorDefensorId].zonaMonstros[slotDefensor] = null;
      adicionarLog(`Empate! ${atacante.nome} e ${defensor.nome} destruídos.`);
      aplicarEfeitoMorte(atacante, jogadorAtacanteId);
      aplicarEfeitoMorte(defensor, jogadorDefensorId);
    } else {
      estado.jogadores[jogadorAtacanteId].zonaMonstros[slotAtacante] = null;
      estado.jogadores[jogadorAtacanteId].hp -= (-dif);
      adicionarLog(`${atacante.nome} destruído! Jogador ${jogadorAtacanteId} perdeu ${-dif} HP.`);
      aplicarEfeitoMorte(atacante, jogadorAtacanteId);
    }
  } else { // Defesa
    const dif = atacante.atk - defensor.def;
    if (dif > 0) {
      estado.jogadores[jogadorDefensorId].zonaMonstros[slotDefensor] = null;
      adicionarLog(`${defensor.nome} destruído em defesa.`);
      aplicarEfeitoMorte(defensor, jogadorDefensorId);
    } else if (dif < 0) {
      estado.jogadores[jogadorAtacanteId].hp -= (-dif);
      adicionarLog(`${atacante.nome} não destruiu ${defensor.nome}. Jogador ${jogadorAtacanteId} perdeu ${-dif} HP.`);
    }
  }
}

// Função para ataques automáticos da IA (async)
async function executarAtaquesAutomaticos(jogadorId) {
  const jogador = estado.jogadores[jogadorId];
  const inimigoId = jogadorId === 1 ? 2 : 1;
  const inimigo = estado.jogadores[inimigoId];

  for (let i = 0; i < jogador.zonaMonstros.length; i++) {
    const monstro = jogador.zonaMonstros[i];
    if (!monstro || monstro.posicao !== 'ataque' || monstro.jaAtacou) continue;

    // Verificar armadilha escudo
    for (let j = 0; j < inimigo.zonaMagias.length; j++) {
      const armadilha = inimigo.zonaMagias[j];
      if (armadilha && armadilha.tipo === 'armadilha' && armadilha.viradaParaBaixo && armadilha.efeito === 'armadilha_escudo') {
        inimigo.zonaMagias[j].viradaParaBaixo = false;
        render();
        animarCarta(inimigoId, 'magia', j, 'trap');
        adicionarLog(`Armadilha "Escudo de Atenas" ativada!`);
        await delay(800);
        monstro.posicao = 'defesa';
        inimigo.zonaMagias[j] = null;
        monstro.jaAtacou = true;
        render();
        break;
      }
    }
    if (monstro.jaAtacou) continue;

    // Animar ataque
    const monstroDefensor = inimigo.zonaMonstros[i];
    await animarAtaque(i, monstroDefensor ? i : null, jogadorId, inimigoId);

    // Aplicar dano
    if (monstroDefensor) {
      resolverBatalha(jogadorId, inimigoId, i, i);
    } else {
      inimigo.hp -= monstro.atk;
      adicionarLog(`${monstro.nome} atacou diretamente! Jogador ${inimigoId} perdeu ${monstro.atk} HP.`);
      if (inimigo.hp <= 0) {
        finalizarDuelo(jogadorId, 'HP zerado');
        return;
      }
    }
    monstro.jaAtacou = true;
    render();
    await delay(800);
  }
}

function encerrarBatalha() {
  if (estado.fase !== 'batalha' || estado.jogadorAtual !== 1) return;
  estado.fase = 'main';
  estado.hasAttacked = true;
  estado.atacanteSelecionado = null;
  limparDestaques();
  renderBotoes();
  adicionarLog('Fase de batalha encerrada.');
}

// ==================== FINALIZAÇÃO ====================
function finalizarDuelo(vencedorId, motivo) {
  if (estado.fase === 'fim') return;
  estado.fase = 'fim';
  adicionarLog(`🏆 Jogador ${vencedorId} venceu o duelo! Motivo: ${motivo}`);
  if (vencedorId === 1) {
    estado.campeonato.vitoriasJ1++;
  } else {
    estado.campeonato.vitoriasJ2++;
  }
  estado.campeonato.historico.push({ rodada: estado.campeonato.rodadaAtual, vencedor: vencedorId, motivo });
  renderPlacar();

  if (estado.campeonato.vitoriasJ1 >= 2 || estado.campeonato.vitoriasJ2 >= 2) {
    adicionarLog('🏆 Campeonato encerrado! Vencedor: ' + (estado.campeonato.vitoriasJ1 >= 2 ? 'Jogador 1' : 'Jogador 2'));
    estado.fase = 'fim';
    render();
    return;
  }

  estado.campeonato.rodadaAtual++;
  setTimeout(() => {
    adicionarLog('--- Iniciando próximo duelo ---');
    iniciarNovoDuelo();
  }, 2000);
}

// ==================== RENDERIZAÇÃO ====================
function render() {
  renderInfoJogadores();
  renderZonas();
  renderMao();
  renderBotoes();
}

function renderInfoJogadores() {
  const p1 = estado.jogadores[1];
  const p2 = estado.jogadores[2];
  document.getElementById('hp-p1').textContent = p1.hp;
  document.getElementById('hp-p2').textContent = p2.hp;
  document.getElementById('deck-p1').textContent = p1.deck.length;
  document.getElementById('deck-p2').textContent = p2.deck.length;
  renderPlacar();
}

function renderPlacar() {
  document.getElementById('score-p1').textContent = estado.campeonato.vitoriasJ1;
  document.getElementById('score-p2').textContent = estado.campeonato.vitoriasJ2;
}

function renderZonas() {
  for (let i = 1; i <= 2; i++) {
    const zonaMonstros = document.getElementById(`monstro-slots-p${i}`);
    const zonaMagias = document.getElementById(`magia-slots-p${i}`);
    zonaMonstros.innerHTML = '';
    zonaMagias.innerHTML = '';

    // Monstros
    for (let j = 0; j < 3; j++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.jogador = i;
      slot.dataset.zona = 'monstro';
      slot.dataset.slot = j;
      const monstro = estado.jogadores[i].zonaMonstros[j];
      if (monstro) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        if (monstro.posicao === 'defesa') cardDiv.classList.add('defense');
        cardDiv.innerHTML = `
          <div class="card-name">${monstro.nome}</div>
          <div class="card-stats">
            <span>ATK ${monstro.atk}</span>
            <span>DEF ${monstro.def}</span>
          </div>
          <div class="card-position">${monstro.posicao === 'ataque' ? 'ATQ' : 'DEF'}</div>
        `;
        cardDiv.addEventListener('mouseenter', () => showPreview(monstro));
        cardDiv.addEventListener('mouseleave', hidePreview);
        slot.appendChild(cardDiv);
      }
      slot.addEventListener('click', () => handleSlotClick(i, 'monstro', j));
      zonaMonstros.appendChild(slot);
    }

    // Magias/Armadilhas
    for (let j = 0; j < 3; j++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.jogador = i;
      slot.dataset.zona = 'magia';
      slot.dataset.slot = j;
      const carta = estado.jogadores[i].zonaMagias[j];
      if (carta) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        if (carta.viradaParaBaixo) {
          cardDiv.classList.add('facedown');
          cardDiv.textContent = '?';
        } else {
          cardDiv.innerHTML = `
            <div class="card-name">${carta.nome}</div>
            <div>${carta.tipo}</div>
          `;
        }
        cardDiv.addEventListener('mouseenter', () => showPreview(carta));
        cardDiv.addEventListener('mouseleave', hidePreview);
        slot.appendChild(cardDiv);
      }
      slot.addEventListener('click', () => handleSlotClick(i, 'magia', j));
      zonaMagias.appendChild(slot);
    }
  }
}

function renderMao() {
  const handDiv = document.getElementById('hand');
  handDiv.innerHTML = '';
  if (estado.jogadorAtual === 1) {
    estado.jogadores[1].mao.forEach((carta, index) => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'hand-card';
      cardDiv.dataset.index = index;
      if (estado.cartaSelecionada === index) cardDiv.classList.add('selected');
      let info = `<div class="card-name">${carta.nome}</div>`;
      if (carta.tipo === 'monstro') {
        info += `<div class="card-stats"><span>ATK ${carta.atk}</span><span>DEF ${carta.def}</span></div>`;
      } else if (carta.tipo === 'magia') {
        info += `<div>${carta.descricao || 'Magia'}</div>`;
      } else {
        info += `<div>${carta.descricao || 'Armadilha'}</div>`;
      }
      cardDiv.innerHTML = info;
      cardDiv.addEventListener('mouseenter', () => showPreview(carta));
      cardDiv.addEventListener('mouseleave', hidePreview);
      cardDiv.addEventListener('click', () => selecionarCartaDaMao(index));
      handDiv.appendChild(cardDiv);
    });
  } else {
    for (let i = 0; i < estado.jogadores[2].mao.length; i++) {
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
  const btnEncerrarBatalha = document.getElementById('btn-encerrar-batalha');
  const btnEncerrar = document.getElementById('btn-encerrar');

  if (estado.fase === 'main' && estado.jogadorAtual === 1 && !estado.processandoAnimacao) {
    btnAtacar.disabled = !(estado.turno !== 1 && !estado.hasAttacked && !estado.primeiroTurno);
    btnEncerrar.disabled = false;
    btnEncerrarBatalha.style.display = 'none';
  } else if (estado.fase === 'batalha' && estado.jogadorAtual === 1 && !estado.processandoAnimacao) {
    btnAtacar.disabled = true;
    btnEncerrar.disabled = true;
    btnEncerrarBatalha.style.display = 'inline-block';
  } else {
    btnAtacar.disabled = true;
    btnEncerrar.disabled = true;
    btnEncerrarBatalha.style.display = 'none';
  }
}

function renderLog() {
  const logDiv = document.getElementById('log');
  logDiv.innerHTML = estado.log.slice(-10).map(msg => `<div>${msg}</div>`).join('');
  logDiv.scrollTop = logDiv.scrollHeight;
}

// ==================== PREVIEW ====================
function showPreview(carta) {
  const preview = document.getElementById('card-preview');
  preview.innerHTML = '';
  const nome = document.createElement('div');
  nome.className = 'card-name';
  nome.textContent = carta.nome;
  preview.appendChild(nome);

  const tipo = document.createElement('div');
  tipo.className = 'card-type';
  tipo.textContent = carta.tipo.charAt(0).toUpperCase() + carta.tipo.slice(1);
  preview.appendChild(tipo);

  if (carta.tipo === 'monstro') {
    const stats = document.createElement('div');
    stats.className = 'card-stats';
    stats.innerHTML = `<span>ATK ${carta.atk}</span><span>DEF ${carta.def}</span>`;
    preview.appendChild(stats);
  }

  if (carta.descricao || carta.efeito) {
    const efeito = document.createElement('div');
    efeito.className = 'card-effect';
    efeito.textContent = carta.descricao || (carta.efeito ? `Efeito: ${carta.efeito}` : 'Sem efeito');
    preview.appendChild(efeito);
  }

  preview.classList.remove('hidden');
}

function hidePreview() {
  document.getElementById('card-preview').classList.add('hidden');
}

// ==================== DESTAQUES ====================
function limparDestaques() {
  document.querySelectorAll('.slot.highlight').forEach(el => el.classList.remove('highlight'));
  document.getElementById('hp-p2')?.classList.remove('highlight-target');
  document.getElementById('hp-p1')?.classList.remove('highlight-target');
}

function destacarSlotsMonstroVazios(jogadorId) {
  limparDestaques();
  const slots = document.querySelectorAll(`#monstro-slots-p${jogadorId} .slot`);
  slots.forEach(slot => {
    const index = parseInt(slot.dataset.slot);
    if (estado.jogadores[jogadorId].zonaMonstros[index] === null) {
      slot.classList.add('highlight');
    }
  });
}

function destacarMonstrosProprios() {
  limparDestaques();
  const slots = document.querySelectorAll(`#monstro-slots-p1 .slot`);
  slots.forEach(slot => {
    const index = parseInt(slot.dataset.slot);
    if (estado.jogadores[1].zonaMonstros[index] !== null) {
      slot.classList.add('highlight');
    }
  });
}

function destacarMonstrosInimigos() {
  limparDestaques();
  const slots = document.querySelectorAll(`#monstro-slots-p2 .slot`);
  slots.forEach(slot => {
    const index = parseInt(slot.dataset.slot);
    if (estado.jogadores[2].zonaMonstros[index] !== null) {
      slot.classList.add('highlight');
    }
  });
}

// ==================== ANIMAÇÃO GENÉRICA ====================
function animarCarta(jogadorId, zona, slotIndex, tipo = 'bright') {
  const selector = `#${zona}-slots-p${jogadorId} .slot[data-slot="${slotIndex}"] .card`;
  const cardElement = document.querySelector(selector);
  if (cardElement) {
    let classe;
    switch (tipo) {
      case 'bright': classe = 'bright'; break;
      case 'trap': classe = 'trap-activating'; break;
      case 'magic': classe = 'magic-activating'; break;
      default: classe = 'bright';
    }
    cardElement.classList.add(classe);
    setTimeout(() => {
      cardElement.classList.remove(classe);
    }, 800);
  }
}

// ==================== TRATAMENTO DE CLICKS ====================
function handleSlotClick(jogadorId, zona, slotIndex) {
  // Fase de batalha
  if (estado.fase === 'batalha' && estado.jogadorAtual === 1 && !estado.processandoAnimacao) {
    if (jogadorId === 1 && zona === 'monstro') {
      if (estado.atacanteSelecionado === null) {
        selecionarAtacante(slotIndex);
      } else if (estado.atacanteSelecionado === slotIndex) {
        estado.atacanteSelecionado = null;
        limparDestaques();
        destacarAtacantesDisponiveis(1);
        adicionarLog('Selecione outro monstro atacante.');
      } else {
        selecionarAtacante(slotIndex);
      }
    } else if (jogadorId === 2 && zona === 'monstro') {
      if (estado.atacanteSelecionado !== null) {
        executarAtaque(estado.atacanteSelecionado, 'monstro', slotIndex);
      }
    }
    return;
  }

  // Fase principal
  if (estado.jogadorAtual !== 1 || estado.fase !== 'main' || estado.processandoAnimacao) return;
  const jogador = estado.jogadores[1];
  const acao = estado.acaoPendente;
  if (!acao) return;

  if (acao.tipo === 'invocar') {
    if (jogadorId === 1 && zona === 'monstro' && jogador.zonaMonstros[slotIndex] === null) {
      invocarMonstro(1, estado.cartaSelecionada, slotIndex, acao.posicao);
    }
  } else if (acao.tipo === 'magia_buff') {
    if (jogadorId === 1 && zona === 'monstro' && jogador.zonaMonstros[slotIndex] !== null) {
      usarMagia(1, estado.cartaSelecionada, { tipo: 'proprio', slot: slotIndex });
    }
  } else if (acao.tipo === 'magia_destruir') {
    if (jogadorId === 2 && zona === 'monstro' && estado.jogadores[2].zonaMonstros[slotIndex] !== null) {
      usarMagia(1, estado.cartaSelecionada, { tipo: 'inimigo', slot: slotIndex });
    }
  }
}

// Evento para ataque direto: clicar no HP do jogador 2
document.getElementById('hp-p2').addEventListener('click', () => {
  if (estado.fase === 'batalha' && estado.jogadorAtual === 1 && estado.atacanteSelecionado !== null && !estado.processandoAnimacao) {
    executarAtaque(estado.atacanteSelecionado, 'jogador', null);
  }
});

// ==================== EVENTOS ====================
document.getElementById('btn-atacar').addEventListener('click', iniciarBatalha);
document.getElementById('btn-encerrar-batalha').addEventListener('click', encerrarBatalha);
document.getElementById('btn-encerrar').addEventListener('click', () => {
  if (estado.jogadorAtual === 1 && (estado.fase === 'main' || estado.fase === 'batalha') && !estado.processandoAnimacao) {
    encerrarTurno();
  }
});

// ==================== INICIAR ====================
iniciarCampeonato();