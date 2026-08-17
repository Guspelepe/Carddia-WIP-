// game.js
// Lógica principal do jogo, sem custo de Fé para invocações.
// Inclui escolha de posição (ataque/defesa), preview de carta e correções.

// ==================== ESTADO GLOBAL ====================
const estado = {
  fase: 'inicio',
  turno: 1,
  jogadorAtual: 1,
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
  hasAttacked: false,
  log: []
};

function criarJogadorInicial(id) {
  return {
    id,
    hp: 2500,
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

  estado.turno = 1;
  estado.jogadorAtual = 1;
  estado.fase = 'main';
  estado.cartaSelecionada = null;
  estado.acaoPendente = null;
  estado.hasAttacked = false;
  render();
  adicionarLog('--- Novo duelo iniciado! Jogador 1 começa (não pode atacar no primeiro turno). ---');
}

// ==================== TROCA DE TURNOS ====================
function encerrarTurno() {
  if (estado.fase === 'fim') return;

  estado.jogadorAtual = estado.jogadorAtual === 1 ? 2 : 1;
  estado.turno++;
  estado.hasAttacked = false;

  const jogador = estado.jogadores[estado.jogadorAtual];
  if (!comprarCarta(estado.jogadorAtual, 5 - jogador.mao.length)) {
    return;
  }

  estado.fase = 'main';
  estado.cartaSelecionada = null;
  estado.acaoPendente = null;
  render();
  adicionarLog(`--- Turno ${estado.turno} - Jogador ${estado.jogadorAtual} ---`);

  if (estado.jogadorAtual === 2) {
    setTimeout(() => aiTurn(estado), 1200);
  }
}

// ==================== AÇÕES DO JOGADOR ====================
function selecionarCartaDaMao(index) {
  if (estado.fase !== 'main' || estado.jogadorAtual !== 1) return;
  const jogador = estado.jogadores[1];
  if (index >= jogador.mao.length) return;
  const carta = jogador.mao[index];

  estado.cartaSelecionada = null;
  estado.acaoPendente = null;
  limparDestaques();
  esconderModalPosicao();

  if (carta.tipo === 'monstro') {
    const slotsVazios = jogador.zonaMonstros.filter(slot => slot === null).length;
    if (slotsVazios === 0) {
      adicionarLog('Sua zona de monstros está cheia.');
      return;
    }
    // Mostrar modal para escolher posição
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

// Funções do modal de posição
function mostrarModalPosicao() {
  document.getElementById('modal-position').classList.remove('hidden');
}

function esconderModalPosicao() {
  document.getElementById('modal-position').classList.add('hidden');
}

// Eventos dos botões do modal
document.getElementById('btn-ataque').addEventListener('click', () => {
  if (estado.cartaSelecionada !== null) {
    estado.acaoPendente = { tipo: 'invocar', posicao: 'ataque' };
    esconderModalPosicao();
    destacarSlotsMonstroVazios(1);
    adicionarLog(`Selecione um slot vazio para invocar ${estado.jogadores[1].mao[estado.cartaSelecionada].nome} em posição de ataque.`);
  }
});

document.getElementById('btn-defesa').addEventListener('click', () => {
  if (estado.cartaSelecionada !== null) {
    estado.acaoPendente = { tipo: 'invocar', posicao: 'defesa' };
    esconderModalPosicao();
    destacarSlotsMonstroVazios(1);
    adicionarLog(`Selecione um slot vazio para invocar ${estado.jogadores[1].mao[estado.cartaSelecionada].nome} em posição de defesa.`);
  }
});

// Função genérica para invocar monstro (sem custo)
function invocarMonstro(jogadorId, maoIndex, slotIndex, posicao) {
  const jogador = estado.jogadores[jogadorId];
  const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'monstro') return false;
  if (slotIndex < 0 || slotIndex > 2 || jogador.zonaMonstros[slotIndex] !== null) return false;

  jogador.mao.splice(maoIndex, 1);
  jogador.zonaMonstros[slotIndex] = { ...carta, posicao };
  adicionarLog(`Jogador ${jogadorId} invocou ${carta.nome} na posição ${posicao}.`);

  verificarArmadilhaInvocacao(jogadorId, slotIndex);

  if (jogadorId === 1) {
    estado.cartaSelecionada = null;
    estado.acaoPendente = null;
    limparDestaques();
    esconderModalPosicao();
  }
  render();
  return true;
}

// Baixar armadilha
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
  return true;
}

// Usar magia
function usarMagia(jogadorId, maoIndex, alvo) {
  const jogador = estado.jogadores[jogadorId];
  const carta = jogador.mao[maoIndex];
  if (!carta || carta.tipo !== 'magia') return false;

  jogador.mao.splice(maoIndex, 1);

  switch (carta.efeito) {
    case 'buff_500':
      if (alvo && alvo.tipo === 'proprio') {
        const monstro = jogador.zonaMonstros[alvo.slot];
        if (monstro) {
          monstro.atk += 500;
          adicionarLog(`${monstro.nome} ganhou +500 de ATK.`);
        }
      }
      break;
    case 'destruir_inimigo':
      if (alvo && alvo.tipo === 'inimigo') {
        const inimigoId = jogadorId === 1 ? 2 : 1;
        const inimigo = estado.jogadores[inimigoId];
        const monstro = inimigo.zonaMonstros[alvo.slot];
        if (monstro) {
          inimigo.zonaMonstros[alvo.slot] = null;
          adicionarLog(`${monstro.nome} foi destruído por Raios de Zeus.`);
          aplicarEfeitoMorte(monstro, inimigoId);
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

// ==================== ARMADILHAS AUTOMÁTICAS ====================
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
        invocador.zonaMonstros[slotIndex] = null;
        oponente.zonaMagias[i] = null;
        adicionarLog(`Armadilha "Ira do Submundo" ativada! ${monstro.nome} foi destruído.`);
        aplicarEfeitoMorte(monstro, jogadorInvoker);
        render();
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

// ==================== FASE DE BATALHA ====================
function executarBatalha(jogadorAtacanteId) {
  if (estado.hasAttacked) return;
  if (estado.turno === 1 && jogadorAtacanteId === 1) {
    adicionarLog('Você não pode atacar no primeiro turno.');
    return;
  }

  const atacante = estado.jogadores[jogadorAtacanteId];
  const defensorId = jogadorAtacanteId === 1 ? 2 : 1;
  const defensor = estado.jogadores[defensorId];
  let atacou = false;

  for (let i = 0; i < 3; i++) {
    const monstroAtacante = atacante.zonaMonstros[i];
    if (!monstroAtacante || monstroAtacante.posicao !== 'ataque') continue;

    let ataqueCancelado = false;
    for (let j = 0; j < defensor.zonaMagias.length; j++) {
      const armadilha = defensor.zonaMagias[j];
      if (armadilha && armadilha.tipo === 'armadilha' && armadilha.viradaParaBaixo && armadilha.efeito === 'armadilha_escudo') {
        monstroAtacante.posicao = 'defesa';
        defensor.zonaMagias[j] = null;
        adicionarLog(`Armadilha "Escudo de Atenas" ativada! ${monstroAtacante.nome} foi colocado em defesa.`);
        ataqueCancelado = true;
        break;
      }
    }

    if (ataqueCancelado || monstroAtacante.posicao !== 'ataque') continue;

    const monstroDefensor = defensor.zonaMonstros[i];
    if (monstroDefensor) {
      const atkValor = monstroAtacante.atk;
      const defValor = monstroDefensor.posicao === 'ataque' ? monstroDefensor.atk : monstroDefensor.def;
      adicionarLog(`${monstroAtacante.nome} (${atkValor}) vs ${monstroDefensor.nome} (${defValor})`);

      if (atkValor > defValor) {
        defensor.zonaMonstros[i] = null;
        adicionarLog(`${monstroDefensor.nome} foi destruído.`);
        aplicarEfeitoMorte(monstroDefensor, defensorId);
        atacou = true;
      } else if (atkValor < defValor) {
        atacante.zonaMonstros[i] = null;
        adicionarLog(`${monstroAtacante.nome} foi destruído.`);
        aplicarEfeitoMorte(monstroAtacante, jogadorAtacanteId);
        atacou = true;
      } else {
        atacante.zonaMonstros[i] = null;
        defensor.zonaMonstros[i] = null;
        adicionarLog(`Empate! ${monstroAtacante.nome} e ${monstroDefensor.nome} destruídos.`);
        aplicarEfeitoMorte(monstroAtacante, jogadorAtacanteId);
        aplicarEfeitoMorte(monstroDefensor, defensorId);
        atacou = true;
      }
    } else {
      defensor.hp -= atkValor;
      adicionarLog(`${monstroAtacante.nome} atacou diretamente! Jogador ${defensorId} perdeu ${atkValor} HP.`);
      atacou = true;
      if (defensor.hp <= 0) {
        finalizarDuelo(jogadorAtacanteId, 'HP zerado');
        return;
      }
    }
  }

  if (!atacou) {
    adicionarLog('Nenhum monstro em posição de ataque para atacar.');
  }
  estado.hasAttacked = true;
  render();
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
  estado.campeonato.historico.push({
    rodada: estado.campeonato.rodadaAtual,
    vencedor: vencedorId,
    motivo
  });
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
        if (monstro.posicao === 'defesa') {
          cardDiv.classList.add('defense');
        }
        cardDiv.innerHTML = `
          <div class="card-name">${monstro.nome}</div>
          <div class="card-stats">
            <span>ATK ${monstro.atk}</span>
            <span>DEF ${monstro.def}</span>
          </div>
          <div class="card-position">${monstro.posicao === 'ataque' ? 'ATQ' : 'DEF'}</div>
        `;
        // Adicionar evento de preview
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
      if (estado.cartaSelecionada === index) {
        cardDiv.classList.add('selected');
      }
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
      // Não mostramos preview para cartas da IA (escondidas)
      handDiv.appendChild(cardDiv);
    }
  }
}

function renderBotoes() {
  const btnAtacar = document.getElementById('btn-atacar');
  const btnEncerrar = document.getElementById('btn-encerrar');
  const podeAtacar = estado.fase === 'main' && estado.jogadorAtual === 1 && !estado.hasAttacked && !(estado.turno === 1);
  btnAtacar.disabled = !podeAtacar;
  btnEncerrar.disabled = !(estado.fase === 'main' && estado.jogadorAtual === 1);
}

function renderLog() {
  const logDiv = document.getElementById('log');
  logDiv.innerHTML = estado.log.slice(-10).map(msg => `<div>${msg}</div>`).join('');
  logDiv.scrollTop = logDiv.scrollHeight;
}

// ==================== PREVIEW DA CARTA ====================
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

// ==================== TRATAMENTO DE CLICKS ====================
function handleSlotClick(jogadorId, zona, slotIndex) {
  if (estado.jogadorAtual !== 1 || estado.fase !== 'main') return;

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

// ==================== EVENTOS ====================
document.getElementById('btn-atacar').addEventListener('click', () => {
  if (estado.jogadorAtual === 1 && estado.fase === 'main' && !estado.hasAttacked) {
    executarBatalha(1);
    renderBotoes();
  }
});

document.getElementById('btn-encerrar').addEventListener('click', () => {
  if (estado.jogadorAtual === 1 && estado.fase === 'main') {
    encerrarTurno();
  }
});

// ==================== INICIAR ====================
iniciarCampeonato();