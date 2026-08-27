// ================================================================
// game_online.js – Multiplayer com controle de versão e correção de turno
// ================================================================

console.log('🔥 game_online.js carregado!');

if (typeof auth === 'undefined' || typeof db === 'undefined') {
    console.error('❌ auth ou db não definidos!');
}
const authOnline = auth;
const dbOnline = db;

const urlParams = new URLSearchParams(window.location.search);
const matchId = urlParams.get('matchId');
const bestof = parseInt(urlParams.get('bestof')) || 3; // padrão 3
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
    atacanteSelecionado: null,
    _versao: 0
};

let meuId = null;
let meuNick = '';
let oponenteNick = '';
let partidaRef = null;
let unsubscribe = null;
let jogoInicializado = false;
let processandoAcao = false;
let animando = false;

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
    const allCards = [...ALL_CARDS];
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

// -------------------- Inicialização --------------------
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
        atacanteSelecionado: null,
        _versao: 1
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
        const container = document.getElementById('btn-iniciar-container');
        if (container) container.innerHTML = '';
        console.log('✅ Estado inicial salvo.');
    }).catch(err => {
        console.error('❌ Erro ao salvar estado:', err);
        jogoInicializado = false;
    });
}

// -------------------- Sincronização --------------------
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
    if (estado.processandoAnimacao || processandoAcao || animando) return;
    animando = true;

    const acao = {
        tipo,
        jogadorId: meuId,
        params: params || {},
        timestamp: Date.now()
    };

    // Incrementa versão
    estado._versao = (estado._versao || 0) + 1;
    aplicarAcaoLocal(acao);

    partidaRef.update({
        actions: firebase.firestore.FieldValue.arrayUnion(acao),
        gameState: estado,
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        animando = false;
        processandoAcao = false;
    }).catch(err => {
        console.error('Erro ao enviar ação:', err);
        animando = false;
        processandoAcao = false;
    });
}

function aplicarAcaoLocal(acao) {
    switch (acao.tipo) {
        case 'INVOKE':
            window.invocarMonstro(acao.jogadorId, acao.params.maoIndex, acao.params.slot, acao.params.posicao, estado);
            window.verificarArmadilhasInvocacao(acao.jogadorId, acao.params.slot, estado);
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
            // Chama a função da engine e depois atualiza estado
            window.encerrarTurno(estado);
            // A engine já modifica o estado, mas precisamos garantir versão
            estado._versao = (estado._versao || 0) + 1;
            break;
        default:
            console.warn('Ação desconhecida:', acao.tipo);
    }
    render();
    renderBotoes();
    atualizarEstadoFirestore();
}

// ========== Funções de Batalha (com animação e reativação) ==========
function atacar(jogadorId, atacanteSlot, alvoTipo, alvoSlot) {
    const atacante = estado.jogadores[jogadorId].zonaMonstros[atacanteSlot];
    if (!atacante || atacante.ataquesRestantes === 0) return;
    const defensorId = jogadorId === 1 ? 2 : 1;
    const defensor = estado.jogadores[defensorId];

    // Verificar armadilhas antes do ataque
    const armadilhaAtivada = window.verificarArmadilhasAtaque(jogadorId, atacanteSlot, alvoTipo, alvoSlot, estado);
    if (armadilhaAtivada) {
        render();
        renderBotoes();
        atualizarEstadoFirestore();
        return;
    }

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

    // Animação básica de ataque
    window.animarAtaque(atacanteSlot, alvoTipo === 'monstro' ? alvoSlot : null, jogadorId, defensorId).then(() => {
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

        // Reduz ataques restantes
        if (estado.jogadores[jogadorId].zonaMonstros[atacanteSlot]) {
            estado.jogadores[jogadorId].zonaMonstros[atacanteSlot].ataquesRestantes--;
        }
        window.verificarFimDeDuelo(estado);
        render();
        renderBotoes();
        atualizarEstadoFirestore();

        // Reativar destaques se ainda houver atacantes
        if (estado.fase === 'batalha' && estado.jogadorAtual === meuId) {
            const aindaPodeAtacar = estado.jogadores[meuId].zonaMonstros.some(m => m && m.posicao === 'ataque' && m.ataquesRestantes > 0);
            if (aindaPodeAtacar) {
                destacarAtacantesDisponiveis();
                window.adicionarLog(meuId, 'Selecione outro monstro para atacar.');
            } else {
                window.adicionarLog(meuId, 'Todos os monstros atacaram. Encerre o turno.');
            }
        }
    });
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
    mostrarBotaoIniciar();
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

// ========== FUNÇÕES DE UI (INTERAÇÃO DO USUÁRIO) ==========
function selecionarCartaDaMao(index) {
    // ... (código já existente, vou manter resumido para não repetir tudo)
    // Essa função deve estar aqui
}

function handleSlotClick(visualId, zona, slotIndex) {
    // ... (código já existente)
}

function destacarAtacantesDisponiveis() {
    // ... (código já existente)
}

function mostrarModalPosicao() { /* ... */ }
function esconderModalPosicao() { /* ... */ }

// ========== BOTÃO INICIAR ==========
function mostrarBotaoIniciar() {
    const container = document.getElementById('btn-iniciar-container');
    if (!container) return;
    // Só mostra se for player1, ambos presentes e jogo não iniciado
    if (meuId === 1 && window.ambosPresentes && !jogoInicializado) {
        container.innerHTML = `<button id="btn-iniciar-partida" class="btn btn-primary" style="padding:10px 20px; background:#27ae60; border:none; border-radius:8px; color:white; font-weight:bold; cursor:pointer; width:100%;">▶️ Iniciar Partida</button>`;
        document.getElementById('btn-iniciar-partida')?.addEventListener('click', function() {
            inicializarEstadoInicial();
        });
    } else {
        container.innerHTML = '';
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

        const ambosPresentes = p1 && p2;
        window.ambosPresentes = ambosPresentes;

        // Se não tem gameState, mostra botão para jogador 1
        if (!data.gameState) {
            if (ambosPresentes) {
                if (data.status !== 'playing') {
                    partidaRef.update({ status: 'playing', lastActivity: firebase.firestore.FieldValue.serverTimestamp() });
                }
                // Mostra o botão de iniciar para o player1
                mostrarBotaoIniciar();
            } else {
                window.adicionarLog(meuId, 'Aguardando oponente entrar na partida...');
            }
            return;
        }

        // Atualiza estado apenas se a versão remota for maior
        if (data.gameState._versao && data.gameState._versao > (estado._versao || 0)) {
            estado = data.gameState;
            render();
            renderLog();
            renderBotoes();
        } else if (!data.gameState._versao) {
            // Se não tem versão, assume que é o primeiro estado
            estado = data.gameState;
            render();
            renderLog();
            renderBotoes();
        }

        if (estado.fase === 'fim') {
            document.getElementById('modal-endgame')?.classList.remove('hidden');
        }
    }, err => {
        console.error('❌ Erro no snapshot:', err);
        alert('Erro de conexão com a partida.');
    });
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

document.addEventListener('DOMContentLoaded', function() {
    const btnSend = document.getElementById('chat-send-btn');
    const input = document.getElementById('chat-input');
    if (btnSend) btnSend.addEventListener('click', enviarMensagem);
    if (input) input.addEventListener('keydown', function(e) { if (e.key === 'Enter') enviarMensagem(); });
});

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