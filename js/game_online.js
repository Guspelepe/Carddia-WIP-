// ================================================================
// game_online.js – Multiplayer com chat e exclusão automática
// ================================================================

console.log('🔥 game_online.js carregado!');

if (typeof auth === 'undefined' || typeof db === 'undefined') {
    console.error('❌ auth ou db não definidos!');
}
const authOnline = auth;
const dbOnline = db;

const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get('matchId');
if (!matchId) {
    alert('ID da partida não encontrado.');
    window.location.href = 'lobby.html';
}
console.log('📌 matchId:', matchId);

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

let meuId = null;
let meuNick = '';
let oponenteNick = '';
let partidaRef = null;
let unsubscribe = null;
let jogoInicializado = false;
let processandoAcao = false;

// Sobrescreve funções da engine para usar o estado e logs locais
window.adicionarLog = (jogadorId, msg) => {
    estado.log.push(msg);
    renderLog();
    if (estado.fase !== 'fim') atualizarEstadoFirestore();
};
window.nomeJogador = (id) => {
    if (id === 1) return (meuId === 1 ? meuNick : oponenteNick) || 'Jogador 1';
    if (id === 2) return (meuId === 2 ? meuNick : oponenteNick) || 'Jogador 2';
    return 'Jogador';
};
window.limparDestaques = () => {
    document.querySelectorAll('.slot.highlight').forEach(el => el.classList.remove('highlight'));
    document.getElementById('hp-p1')?.classList.remove('highlight-target');
    document.getElementById('hp-p2')?.classList.remove('highlight-target');
};

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

function embaralhar(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function montarDeck() {
    if (typeof ALL_CARDS === 'undefined' || !ALL_CARDS.length) {
        console.error('❌ ALL_CARDS não definido!');
        return [];
    }
    // Usando todos os tiers para maior variedade
    const allCards = [...ALL_CARDS];
    // Embaralha tudo e pega 20 cartas aleatórias
    const shuffled = embaralhar(allCards);
    return shuffled.slice(0, 20);
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

// -------------------- Mapeamento Visual --------------------
function getVisualToReal(visualId) {
    if (meuId === 1) return visualId;
    return visualId === 1 ? 2 : 1;
}

function getRealToVisual(realId) {
    if (meuId === 1) return realId;
    return realId === 1 ? 2 : 1;
}

function configurarLayoutCampos() {
    document.getElementById('player1-name').textContent = window.nomeJogador(1);
    document.getElementById('player2-name').textContent = window.nomeJogador(2);
    document.getElementById('score-p1-label').textContent = window.nomeJogador(1);
    document.getElementById('score-p2-label').textContent = window.nomeJogador(2);
    inverterCampos();
}

function inverterCampos() {
    const container = document.getElementById('game-container');
    if (!container) return;
    const player1Area = document.getElementById('player1-area');
    const player2Area = document.getElementById('player2-area');
    const handContainer = document.getElementById('hand-container');
    const board = document.querySelector('.board');
    const seriesInfo = document.getElementById('series-info');

    if (!player1Area || !player2Area || !board || !handContainer) return;

    const order = (meuId === 2)
        ? [seriesInfo, player1Area, board, player2Area, handContainer]
        : [seriesInfo, player2Area, board, player1Area, handContainer];

    while (container.firstChild) container.removeChild(container.firstChild);
    order.forEach(el => { if (el) container.appendChild(el); });
}

// -------------------- Preview --------------------
function showPreview(carta, jogadorId) {
    const preview = document.getElementById('card-preview');
    const effectDisplay = document.getElementById('card-effect-display');
    if (!preview || !effectDisplay) return;
    preview.innerHTML = '';
    preview.classList.remove('hidden');

    if (carta.viradaParaBaixo && jogadorId === 2) {
        const nome = document.createElement('div');
        nome.className = 'card-name';
        nome.textContent = 'Carta virada';
        preview.appendChild(nome);
        effectDisplay.classList.add('hidden');
        return;
    }

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
        const atk = carta.atk + (carta.bonusAtk || 0);
        const def = carta.def + (carta.bonusDef || 0);
        stats.innerHTML = `<span>ATK ${atk}</span><span>DEF ${def}</span>`;
        preview.appendChild(stats);
    }

    let efeitoTexto = '';
    if (carta.descricao) {
        efeitoTexto = carta.descricao;
    } else if (carta.efeito) {
        efeitoTexto = `Efeito: ${carta.efeito}`;
    }

    if (efeitoTexto) {
        effectDisplay.textContent = efeitoTexto;
        effectDisplay.classList.remove('hidden');
    } else {
        effectDisplay.classList.add('hidden');
    }
}

// -------------------- Inicialização do Jogo --------------------
function inicializarEstadoInicial() {
    if (jogoInicializado) {
        console.log('⚠️ Jogo já inicializado.');
        return;
    }
    jogoInicializado = true;
    console.log('⚡ Inicializando estado...');

    if (typeof ALL_CARDS === 'undefined' || !ALL_CARDS.length) {
        console.error('❌ ALL_CARDS não disponível!');
        jogoInicializado = false;
        return;
    }

    const deck1 = montarDeck();
    const deck2 = montarDeck();
    if (deck1.length === 0 || deck2.length === 0) {
        console.error('❌ Deck vazio!');
        jogoInicializado = false;
        return;
    }

    const jogador1 = criarJogadorInicial(1);
    jogador1.deck = deck1;
    const jogador2 = criarJogadorInicial(2);
    jogador2.deck = deck2;

    for (let i = 0; i < 5; i++) {
        comprarCartaLocal(jogador1);
        comprarCartaLocal(jogador2);
    }

    const primeiro = Math.random() < 0.5 ? 1 : 2;

    const novoEstado = {
        fase: 'main',
        turno: 1,
        jogadorAtual: primeiro,
        primeiroTurno: true,
        magiasBloqueadas: false,
        hasAttacked: false,
        processandoAnimacao: false,
        log: ['--- Partida iniciada! ---', `${window.nomeJogador(primeiro)} começa.`],
        jogadores: { 1: jogador1, 2: jogador2 },
        cartaSelecionada: null,
        acaoPendente: null,
        atacanteSelecionado: null
    };

    partidaRef.update({
        gameState: novoEstado,
        currentTurn: primeiro,
        actions: [],
        status: 'playing',
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        estado = novoEstado;
        configurarLayoutCampos();
        render();
        renderBotoes();
        console.log('✅ Estado inicial salvo.');
    }).catch(err => {
        console.error('❌ Erro ao salvar estado:', err);
        jogoInicializado = false;
    });
}

// -------------------- Sincronização e lastActivity --------------------
function atualizarEstadoFirestore() {
    if (!partidaRef) return;
    partidaRef.update({
        gameState: estado,
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(err => console.error('Erro ao salvar estado:', err));
}

// -------------------- Enviar Ação --------------------
function enviarAcao(tipo, params) {
    if (estado.fase === 'fim') return;
    if (estado.jogadorAtual !== meuId) {
        window.adicionarLog(meuId, 'Aguarde seu turno.');
        return;
    }
    if (estado.processandoAnimacao || processandoAcao) return;
    processandoAcao = true;

    const acao = {
        tipo,
        jogadorId: meuId,
        params: params || {},
        timestamp: Date.now()
    };

    aplicarAcaoLocal(acao);

    partidaRef.update({
        actions: firebase.firestore.FieldValue.arrayUnion(acao),
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        processandoAcao = false;
    }).catch(err => {
        console.error('Erro ao enviar ação:', err);
        processandoAcao = false;
    });
}

function aplicarAcaoLocal(acao) {
    switch (acao.tipo) {
        case 'INVOKE':
            window.invocarMonstro(acao.jogadorId, acao.params.maoIndex, acao.params.slot, acao.params.posicao, estado);
            break;
        case 'BAIXAR_ARMADILHA':
            window.baixarArmadilha(acao.jogadorId, acao.params.maoIndex, acao.params.slot, estado);
            break;
        case 'USAR_MAGIA':
            window.usarMagia(acao.jogadorId, acao.params.maoIndex, acao.params.alvo, estado);
            break;
        case 'ATACAR':
            atacar(acao.jogadorId, acao.params.atacanteSlot, acao.params.alvoTipo, acao.params.alvoSlot);
            break;
        case 'MUDAR_POSICAO':
            mudarPosicao(acao.jogadorId, acao.params.slot);
            break;
        case 'ENCERRAR_TURNO':
            window.encerrarTurno(estado);
            break;
        default:
            console.warn('Ação desconhecida:', acao.tipo);
    }
    render();
    renderBotoes();
    atualizarEstadoFirestore();
}

// ========== Funções de Batalha ==========
function atacar(jogadorId, atacanteSlot, alvoTipo, alvoSlot) {
    const atacante = estado.jogadores[jogadorId].zonaMonstros[atacanteSlot];
    if (!atacante || atacante.ataquesRestantes === 0) return;
    const defensorId = jogadorId === 1 ? 2 : 1;
    const defensor = estado.jogadores[defensorId];

    let podeAtacarDireto = false;
    const temMonstrosInimigos = defensor.zonaMonstros.some(m => m !== null);
    if (!temMonstrosInimigos) podeAtacarDireto = true;
    if (atacante.efeito === 'ignora_defesa_ataque_direto' || atacante.efeito === 'se_oponente_tem_armadilha_ataque_direto') {
        if (atacante.efeito === 'se_oponente_tem_armadilha_ataque_direto') {
            const temArmadilha = defensor.zonaMagias.some(a => a !== null && a.viradaParaBaixo);
            if (temArmadilha) podeAtacarDireto = true;
        } else podeAtacarDireto = true;
    }

    if (alvoTipo === 'jogador' && !podeAtacarDireto) {
        window.adicionarLog(jogadorId, 'Não pode atacar diretamente.');
        return;
    }

    if (alvoTipo === 'jogador') {
        const dano = atacante.atk + (atacante.bonusAtk || 0);
        defensor.hp -= dano;
        window.adicionarLog(jogadorId, `${atacante.nome} atacou diretamente! ${window.nomeJogador(defensorId)} perdeu ${dano} HP.`);
        if (atacante.efeito === 'ao_causar_dano_oponente_descarta_1_carta' && defensor.mao.length > 0) {
            const descartada = defensor.mao.pop();
            window.adicionarLog(jogadorId, `${atacante.nome} descartou ${descartada.nome}.`);
        }
    } else {
        if (!defensor.zonaMonstros[alvoSlot]) {
            window.adicionarLog(jogadorId, 'Alvo inválido.');
            return;
        }
        window.resolverBatalha(jogadorId, defensorId, atacanteSlot, alvoSlot, estado);
    }

    if (estado.jogadores[jogadorId].zonaMonstros[atacanteSlot]) {
        estado.jogadores[jogadorId].zonaMonstros[atacanteSlot].ataquesRestantes--;
    }
    window.verificarFimDeDuelo(estado);
}

function mudarPosicao(jogadorId, slot) {
    const monstro = estado.jogadores[jogadorId].zonaMonstros[slot];
    if (!monstro) return;
    if (monstro.invocadoEsteTurno) {
        window.adicionarLog(jogadorId, 'Não pode mudar no turno invocado.');
        return;
    }
    if (monstro.posicaoMudouEsteTurno) {
        window.adicionarLog(jogadorId, 'Já mudou de posição neste turno.');
        return;
    }
    if (monstro.estaPreso) {
        window.adicionarLog(jogadorId, `${monstro.nome} está preso.`);
        return;
    }
    monstro.posicao = monstro.posicao === 'ataque' ? 'defesa' : 'ataque';
    monstro.posicaoMudouEsteTurno = true;
    window.adicionarLog(jogadorId, `${window.nomeJogador(jogadorId)} mudou ${monstro.nome} para ${monstro.posicao}.`);
}

// ========== Renderização ==========
function render() {
    renderInfoJogadores();
    renderZonas();
    renderMao();
    renderBotoes();
    configurarLayoutCampos();
}

function renderInfoJogadores() {
    document.getElementById('hp-p1').textContent = estado.jogadores[1].hp;
    document.getElementById('hp-p2').textContent = estado.jogadores[2].hp;
    document.getElementById('deck-p1').textContent = estado.jogadores[1].deck.length;
    document.getElementById('deck-p2').textContent = estado.jogadores[2].deck.length;
}

function renderZonas() {
    for (let visualId = 1; visualId <= 2; visualId++) {
        const realId = getVisualToReal(visualId);
        const zonaMonstros = document.getElementById(`monstro-slots-p${visualId}`);
        const zonaMagias = document.getElementById(`magia-slots-p${visualId}`);
        if (!zonaMonstros || !zonaMagias) continue;
        zonaMonstros.innerHTML = '';
        zonaMagias.innerHTML = '';

        for (let j = 0; j < 3; j++) {
            const slotM = document.createElement('div');
            slotM.className = 'slot';
            slotM.dataset.jogador = visualId;
            slotM.dataset.zona = 'monstro';
            slotM.dataset.slot = j;
            const monstro = estado.jogadores[realId].zonaMonstros[j];
            if (monstro) {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'card';
                if (monstro.posicao === 'defesa') cardDiv.classList.add('defense');
                const atkTotal = monstro.atk + (monstro.bonusAtk || 0);
                const defTotal = monstro.def + (monstro.bonusDef || 0);
                cardDiv.innerHTML =
                    `<div class="card-name">${monstro.nome}</div>
                     <div class="card-stats"><span>ATK ${atkTotal}</span><span>DEF ${defTotal}</span></div>
                     <div class="card-position">${monstro.posicao === 'ataque' ? 'ATQ' : 'DEF'}</div>`;
                cardDiv.addEventListener('mouseenter', () => showPreview(monstro, realId));
                slotM.appendChild(cardDiv);
            }
            slotM.addEventListener('click', () => handleSlotClick(visualId, 'monstro', j));
            zonaMonstros.appendChild(slotM);

            const slotMa = document.createElement('div');
            slotMa.className = 'slot';
            slotMa.dataset.jogador = visualId;
            slotMa.dataset.zona = 'magia';
            slotMa.dataset.slot = j;
            const carta = estado.jogadores[realId].zonaMagias[j];
            if (carta) {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'card';
                if (carta.viradaParaBaixo) {
                    cardDiv.classList.add('facedown');
                    cardDiv.textContent = '?';
                } else {
                    cardDiv.innerHTML = `<div class="card-name">${carta.nome}</div><div>${carta.tipo}</div>`;
                    cardDiv.addEventListener('mouseenter', () => showPreview(carta, realId));
                }
                slotMa.appendChild(cardDiv);
            }
            slotMa.addEventListener('click', () => handleSlotClick(visualId, 'magia', j));
            zonaMagias.appendChild(slotMa);
        }
    }
}

function renderMao() {
    const handDiv = document.getElementById('hand');
    if (!handDiv) return;
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
            cardDiv.addEventListener('mouseenter', () => showPreview(carta, meuId));
            cardDiv.addEventListener('click', () => selecionarCartaDaMao(index));
            handDiv.appendChild(cardDiv);
        });
    } else {
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
        if (btnAtacar) btnAtacar.disabled = !(estado.turno !== 1 && !estado.hasAttacked && !estado.primeiroTurno);
        if (btnEncerrar) btnEncerrar.disabled = false;
    } else if (estado.fase === 'batalha' && isMyTurn) {
        if (btnAtacar) btnAtacar.disabled = true;
        if (btnEncerrar) btnEncerrar.disabled = false;
    } else {
        if (btnAtacar) btnAtacar.disabled = true;
        if (btnEncerrar) btnEncerrar.disabled = true;
    }
}

function renderLog() {
    const logDiv = document.getElementById('log');
    if (!logDiv) return;
    logDiv.innerHTML = estado.log.slice(-15).map(msg => `<div>${msg}</div>`).join('');
    logDiv.scrollTop = logDiv.scrollHeight;
}

// ========== CHAT ==========
function carregarChat() {
    if (!partidaRef) return;
    partidaRef.onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        if (data.chat) {
            const chatDiv = document.getElementById('chat-messages');
            chatDiv.innerHTML = '';
            // Mostra as últimas 20 mensagens
            const mensagens = data.chat.slice(-20);
            mensagens.forEach(msg => {
                const div = document.createElement('div');
                div.innerHTML = `<span class="sender">${msg.sender}:</span> ${msg.text}`;
                chatDiv.appendChild(div);
            });
            chatDiv.scrollTop = chatDiv.scrollHeight;
        }
    });
}

function enviarMensagem() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !partidaRef || !meuNick) return;
    const msg = {
        sender: meuNick,
        text: text,
        timestamp: Date.now()
    };
    partidaRef.update({
        chat: firebase.firestore.FieldValue.arrayUnion(msg),
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        input.value = '';
    }).catch(err => console.error('Erro ao enviar mensagem:', err));
}

// Evento do chat
document.addEventListener('DOMContentLoaded', function() {
    const btnSend = document.getElementById('chat-send-btn');
    const input = document.getElementById('chat-input');
    if (btnSend) {
        btnSend.addEventListener('click', enviarMensagem);
    }
    if (input) {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') enviarMensagem();
        });
    }
});

// ========== Eventos ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado, configurando eventos...');

    const btnAtacar = document.getElementById('btn-atacar');
    if (btnAtacar) {
        btnAtacar.addEventListener('click', function() {
            if (estado.fase === 'main' && estado.jogadorAtual === meuId && !estado.hasAttacked && !estado.primeiroTurno) {
                estado.fase = 'batalha';
                estado.atacanteSelecionado = null;
                window.adicionarLog(meuId, 'Fase de batalha iniciada. Selecione um monstro atacante.');
                renderBotoes();
                destacarAtacantesDisponiveis();
            }
        });
    }

    const btnEncerrar = document.getElementById('btn-encerrar');
    if (btnEncerrar) {
        btnEncerrar.addEventListener('click', function() {
            if (estado.jogadorAtual === meuId && (estado.fase === 'main' || estado.fase === 'batalha')) {
                enviarAcao('ENCERRAR_TURNO', {});
            }
        });
    }

    const btnAtaqueModal = document.getElementById('btn-ataque-modal');
    if (btnAtaqueModal) {
        btnAtaqueModal.addEventListener('click', function() {
            if (estado.cartaSelecionada !== null) {
                const idx = estado.cartaSelecionada;
                const jogador = estado.jogadores[meuId];
                const slot = jogador.zonaMonstros.findIndex(s => s === null);
                if (slot !== -1) {
                    enviarAcao('INVOKE', { maoIndex: idx, slot: slot, posicao: 'ataque' });
                    estado.cartaSelecionada = null;
                    esconderModalPosicao();
                }
            }
        });
    }

    const btnDefesaModal = document.getElementById('btn-defesa-modal');
    if (btnDefesaModal) {
        btnDefesaModal.addEventListener('click', function() {
            if (estado.cartaSelecionada !== null) {
                const idx = estado.cartaSelecionada;
                const jogador = estado.jogadores[meuId];
                const slot = jogador.zonaMonstros.findIndex(s => s === null);
                if (slot !== -1) {
                    enviarAcao('INVOKE', { maoIndex: idx, slot: slot, posicao: 'defesa' });
                    estado.cartaSelecionada = null;
                    esconderModalPosicao();
                }
            }
        });
    }

    // Ataque direto (HP do oponente visual)
    const hpP1 = document.getElementById('hp-p1');
    const hpP2 = document.getElementById('hp-p2');
    if (hpP1) {
        hpP1.addEventListener('click', function() {
            if (estado.fase === 'batalha' && estado.jogadorAtual === meuId && estado.atacanteSelecionado !== null) {
                const defensorVisual = 1;
                const defensorReal = getVisualToReal(defensorVisual);
                const defensor = estado.jogadores[defensorReal];
                const temMonstros = defensor.zonaMonstros.some(m => m !== null);
                const atacante = estado.jogadores[meuId].zonaMonstros[estado.atacanteSelecionado];
                let podeDireto = !temMonstros;
                if (atacante && (atacante.efeito === 'ignora_defesa_ataque_direto' || atacante.efeito === 'se_oponente_tem_armadilha_ataque_direto')) {
                    if (atacante.efeito === 'se_oponente_tem_armadilha_ataque_direto') {
                        const temArmadilha = defensor.zonaMagias.some(a => a !== null && a.viradaParaBaixo);
                        if (temArmadilha) podeDireto = true;
                    } else podeDireto = true;
                }
                if (podeDireto) {
                    enviarAcao('ATACAR', { atacanteSlot: estado.atacanteSelecionado, alvoTipo: 'jogador', alvoSlot: null });
                    estado.atacanteSelecionado = null;
                    window.limparDestaques();
                } else {
                    window.adicionarLog(meuId, 'Não pode atacar diretamente.');
                }
            }
        });
    }

    if (hpP2) {
        hpP2.addEventListener('click', function() {
            if (estado.fase === 'batalha' && estado.jogadorAtual === meuId && estado.atacanteSelecionado !== null) {
                const defensorVisual = 2;
                const defensorReal = getVisualToReal(defensorVisual);
                const defensor = estado.jogadores[defensorReal];
                const temMonstros = defensor.zonaMonstros.some(m => m !== null);
                const atacante = estado.jogadores[meuId].zonaMonstros[estado.atacanteSelecionado];
                let podeDireto = !temMonstros;
                if (atacante && (atacante.efeito === 'ignora_defesa_ataque_direto' || atacante.efeito === 'se_oponente_tem_armadilha_ataque_direto')) {
                    if (atacante.efeito === 'se_oponente_tem_armadilha_ataque_direto') {
                        const temArmadilha = defensor.zonaMagias.some(a => a !== null && a.viradaParaBaixo);
                        if (temArmadilha) podeDireto = true;
                    } else podeDireto = true;
                }
                if (podeDireto) {
                    enviarAcao('ATACAR', { atacanteSlot: estado.atacanteSelecionado, alvoTipo: 'jogador', alvoSlot: null });
                    estado.atacanteSelecionado = null;
                    window.limparDestaques();
                } else {
                    window.adicionarLog(meuId, 'Não pode atacar diretamente.');
                }
            }
        });
    }
});

// ========== Funções de Interface ==========
function selecionarCartaDaMao(index) {
    if (estado.fase !== 'main' || estado.jogadorAtual !== meuId || estado.processandoAnimacao) return;
    const jogador = estado.jogadores[meuId];
    const carta = jogador.mao[index];
    if (!carta) return;

    estado.cartaSelecionada = null;
    estado.acaoPendente = null;
    window.limparDestaques();

    if (carta.tipo === 'monstro') {
        const slotVazio = jogador.zonaMonstros.findIndex(s => s === null);
        if (slotVazio === -1) {
            window.adicionarLog(meuId, 'Zona de monstros cheia.');
            return;
        }
        estado.cartaSelecionada = index;
        mostrarModalPosicao();
    } else if (carta.tipo === 'magia') {
        const efeito = carta.efeito;
        const oponenteReal = meuId === 1 ? 2 : 1;
        const alvosInimigos = estado.jogadores[oponenteReal].zonaMonstros.filter(m => m !== null);
        const alvosProprios = jogador.zonaMonstros.filter(m => m !== null);

        if (['buff_500','buff_1000','buff_defesa_2000','buff_1500_dano_500','buff_2000_dano_1000_por_turno','imune_ataques_turno','ataque_duplo_destroi_no_fim'].includes(efeito)) {
            if (alvosProprios.length === 0) {
                window.adicionarLog(meuId, 'Você não tem monstros para alvo.');
                return;
            }
            estado.cartaSelecionada = index;
            estado.acaoPendente = { tipo: 'magia_buff', efeito: efeito };
            destacarMonstrosProprios();
        } else if (['destruir_inimigo','devolver_monstro_mao','prende_monstro_inimigo','roubar_monstro'].includes(efeito)) {
            if (alvosInimigos.length === 0) {
                window.adicionarLog(meuId, 'Oponente sem monstros.');
                return;
            }
            estado.cartaSelecionada = index;
            estado.acaoPendente = { tipo: 'magia_inimigo', efeito: efeito };
            destacarMonstrosInimigos();
        } else if (efeito === 'reviver_monstro') {
            if (jogador.cemiterio.length === 0) {
                window.adicionarLog(meuId, 'Cemitério vazio.');
                return;
            }
            const maisForte = jogador.cemiterio.reduce((a,b) => b.atk > a.atk ? b : a);
            const idxCem = jogador.cemiterio.indexOf(maisForte);
            enviarAcao('USAR_MAGIA', { maoIndex: index, alvo: { tipo: 'cemiterio', index: idxCem } });
        } else {
            enviarAcao('USAR_MAGIA', { maoIndex: index, alvo: null });
        }
    } else if (carta.tipo === 'armadilha') {
        const slotVazio = jogador.zonaMagias.findIndex(s => s === null);
        if (slotVazio === -1) {
            window.adicionarLog(meuId, 'Zona de magias cheia.');
            return;
        }
        enviarAcao('BAIXAR_ARMADILHA', { maoIndex: index, slot: slotVazio });
    }
}

function destacarMonstrosProprios() {
    window.limparDestaques();
    const visualId = getRealToVisual(meuId);
    const slots = document.querySelectorAll(`#monstro-slots-p${visualId} .slot`);
    slots.forEach(slot => {
        const idx = parseInt(slot.dataset.slot);
        const realId = getVisualToReal(visualId);
        if (estado.jogadores[realId].zonaMonstros[idx] !== null) {
            slot.classList.add('highlight');
        }
    });
}

function destacarMonstrosInimigos() {
    window.limparDestaques();
    const oponenteReal = meuId === 1 ? 2 : 1;
    const visualId = getRealToVisual(oponenteReal);
    const slots = document.querySelectorAll(`#monstro-slots-p${visualId} .slot`);
    slots.forEach(slot => {
        const idx = parseInt(slot.dataset.slot);
        const realId = getVisualToReal(visualId);
        if (estado.jogadores[realId].zonaMonstros[idx] !== null) {
            slot.classList.add('highlight');
        }
    });
}

function mostrarModalPosicao() {
    document.getElementById('modal-position')?.classList.remove('hidden');
}
function esconderModalPosicao() {
    document.getElementById('modal-position')?.classList.add('hidden');
}

function destacarAtacantesDisponiveis() {
    window.limparDestaques();
    const visualId = getRealToVisual(meuId);
    const slots = document.querySelectorAll(`#monstro-slots-p${visualId} .slot`);
    slots.forEach(slot => {
        const idx = parseInt(slot.dataset.slot);
        const realId = getVisualToReal(visualId);
        const m = estado.jogadores[realId].zonaMonstros[idx];
        if (m && m.posicao === 'ataque' && m.ataquesRestantes > 0) {
            slot.classList.add('highlight');
        }
    });
}

function destacarAlvos() {
    window.limparDestaques();
    const oponenteReal = meuId === 1 ? 2 : 1;
    const visualId = getRealToVisual(oponenteReal);
    const slots = document.querySelectorAll(`#monstro-slots-p${visualId} .slot`);
    slots.forEach(slot => {
        const idx = parseInt(slot.dataset.slot);
        const realId = getVisualToReal(visualId);
        if (estado.jogadores[realId].zonaMonstros[idx] !== null) {
            slot.classList.add('highlight');
        }
    });
    const defensor = estado.jogadores[oponenteReal];
    const temMonstro = defensor.zonaMonstros.some(m => m !== null);
    if (!temMonstro) {
        const hpId = `hp-p${visualId}`;
        document.getElementById(hpId)?.classList.add('highlight-target');
    }
}

function handleSlotClick(visualId, zona, slotIndex) {
    const realId = getVisualToReal(visualId);

    // Fase de batalha
    if (estado.fase === 'batalha' && estado.jogadorAtual === meuId && !estado.processandoAnimacao) {
        if (realId === meuId && zona === 'monstro' && estado.atacanteSelecionado === null) {
            const monstro = estado.jogadores[meuId].zonaMonstros[slotIndex];
            if (monstro && monstro.posicao === 'ataque' && monstro.ataquesRestantes > 0) {
                estado.atacanteSelecionado = slotIndex;
                window.adicionarLog(meuId, `Monstro ${monstro.nome} selecionado. Escolha o alvo.`);
                destacarAlvos();
            }
        } else if (estado.atacanteSelecionado !== null && realId !== meuId && zona === 'monstro') {
            if (estado.jogadores[realId].zonaMonstros[slotIndex] !== null) {
                enviarAcao('ATACAR', {
                    atacanteSlot: estado.atacanteSelecionado,
                    alvoTipo: 'monstro',
                    alvoSlot: slotIndex
                });
                estado.atacanteSelecionado = null;
                window.limparDestaques();
            }
        } else if (realId === meuId && zona === 'monstro' && estado.atacanteSelecionado === slotIndex) {
            estado.atacanteSelecionado = null;
            window.limparDestaques();
            window.adicionarLog(meuId, 'Seleção cancelada.');
            destacarAtacantesDisponiveis();
        }
        return;
    }

    // Fase main
    if (estado.fase === 'main' && estado.jogadorAtual === meuId && !estado.processandoAnimacao) {
        if (estado.acaoPendente) {
            if (estado.acaoPendente.tipo === 'magia_buff' && realId === meuId && zona === 'monstro') {
                const monstro = estado.jogadores[meuId].zonaMonstros[slotIndex];
                if (monstro) {
                    enviarAcao('USAR_MAGIA', {
                        maoIndex: estado.cartaSelecionada,
                        alvo: { tipo: 'proprio', slot: slotIndex }
                    });
                    estado.acaoPendente = null;
                    estado.cartaSelecionada = null;
                    window.limparDestaques();
                }
            } else if (estado.acaoPendente.tipo === 'magia_inimigo' && realId !== meuId && zona === 'monstro') {
                const monstro = estado.jogadores[realId].zonaMonstros[slotIndex];
                if (monstro) {
                    enviarAcao('USAR_MAGIA', {
                        maoIndex: estado.cartaSelecionada,
                        alvo: { tipo: 'inimigo', slot: slotIndex }
                    });
                    estado.acaoPendente = null;
                    estado.cartaSelecionada = null;
                    window.limparDestaques();
                }
            }
            return;
        }

        // Mudar posição
        if (realId === meuId && zona === 'monstro') {
            if (!estado.hasAttacked) {
                enviarAcao('MUDAR_POSICAO', { slot: slotIndex });
            } else {
                window.adicionarLog(meuId, 'Você já atacou este turno.');
            }
        }
    }
}

// ========== Inicialização da Partida ==========
function iniciarPartida(uid) {
    partidaRef = dbOnline.collection('matches').doc(matchId);

    // Carregar chat
    carregarChat();

    unsubscribe = partidaRef.onSnapshot(doc => {
        if (!doc.exists) {
            alert('Partida não encontrada.');
            window.location.href = 'lobby.html';
            return;
        }
        const data = doc.data();
        console.log('📡 Snapshot recebido:', data);
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
        console.log('👤 meuId:', meuId);

        configurarLayoutCampos();

        // Se não tem gameState, inicializa (apenas se ambos estiverem presentes)
        if (!data.gameState) {
            if (p1 && p2) {
                if (!jogoInicializado) {
                    console.log('🎮 Ambos jogadores presentes. Inicializando estado...');
                    inicializarEstadoInicial();
                } else {
                    console.log('⚠️ jogoInicializado já é true, ignorando.');
                }
            } else {
                window.adicionarLog(meuId, 'Aguardando oponente entrar na partida...');
            }
            return;
        }

        // Atualiza estado
        estado = data.gameState;
        render();
        renderLog();
        renderBotoes();

        if (estado.fase === 'fim') {
            document.getElementById('modal-endgame')?.classList.remove('hidden');
        }
    }, err => {
        console.error('❌ Erro no snapshot:', err);
        alert('Erro de conexão com a partida.');
    });
}

// ========== Autenticação ==========
authOnline.onAuthStateChanged(user => {
    if (user) {
        dbOnline.collection('users').doc(user.uid).get()
            .then(doc => {
                meuNick = doc.exists ? (doc.data().nickname || 'Jogador') : 'Jogador';
                iniciarPartida(user.uid);
            })
            .catch(() => {
                meuNick = 'Jogador';
                iniciarPartida(user.uid);
            });
    } else {
        window.location.href = 'index.html';
    }
});

// ========== Funções Globais ==========
window.sairDaPartida = function() {
    if (unsubscribe) unsubscribe();
    window.location.href = 'lobby.html';
};
window.iniciarCampeonato = function() {
    document.getElementById('modal-endgame')?.classList.add('hidden');
    if (meuId === 1) {
        jogoInicializado = false;
        inicializarEstadoInicial();
    } else {
        alert('Aguarde o oponente reiniciar.');
    }
};

console.log('✅ game_online.js carregado completamente.');