// =============================================================
// game_engine.js – Lógica central do jogo (corrigido)
// =============================================================

console.log('🧠 game_engine.js carregado!');

// -------------------- Dicionários de Efeitos --------------------
const MAPA_EFEITOS_MAGIA = {
    'buff_500': (jog, alvo, estado) => {
        const m = jog.zonaMonstros[alvo.slot];
        if (m) {
            m.bonusAtk = (m.bonusAtk || 0) + 500;
            window.adicionarLog(jog.id, `${m.nome} ganhou +500 de ATK.`);
            window.animarCarta(jog.id, 'monstro', alvo.slot);
        }
    },
    'buff_1000': (jog, alvo, estado) => {
        const m = jog.zonaMonstros[alvo.slot];
        if (m) {
            m.bonusAtk = (m.bonusAtk || 0) + 1000;
            m.bonusDef = (m.bonusDef || 0) + 1000;
            window.adicionarLog(jog.id, `${m.nome} ganhou +1000 de ATK e DEF.`);
            window.animarCarta(jog.id, 'monstro', alvo.slot);
        }
    },
    'buff_defesa_2000': (jog, alvo, estado) => {
        const m = jog.zonaMonstros[alvo.slot];
        if (m) {
            m.bonusDef = (m.bonusDef || 0) + 2000;
            window.adicionarLog(jog.id, `${m.nome} ganhou +2000 de DEF.`);
            window.animarCarta(jog.id, 'monstro', alvo.slot);
        }
    },
    'buff_1500_dano_500': (jog, alvo, estado) => {
        const m = jog.zonaMonstros[alvo.slot];
        if (m) {
            m.bonusAtk = (m.bonusAtk || 0) + 1500;
            jog.hp -= 500;
            window.adicionarLog(jog.id, `${m.nome} ganhou +1500 de ATK, mas você perdeu 500 PV.`);
            window.animarCarta(jog.id, 'monstro', alvo.slot);
            window.verificarFimDeDuelo(estado);
        }
    },
    'buff_2000_dano_1000_por_turno': (jog, alvo, estado) => {
        const m = jog.zonaMonstros[alvo.slot];
        if (m) {
            m.bonusAtk = (m.bonusAtk || 0) + 2000;
            window.adicionarLog(jog.id, `${m.nome} ganhou +2000 de ATK (Amaldiçoada).`);
            window.animarCarta(jog.id, 'monstro', alvo.slot);
        }
    },
    'imune_ataques_turno': (jog, alvo, estado) => {
        const m = jog.zonaMonstros[alvo.slot];
        if (m) {
            m.imuneAtaquesEsteTurno = true;
            window.adicionarLog(jog.id, `${m.nome} está imune a ataques neste turno.`);
            window.animarCarta(jog.id, 'monstro', alvo.slot);
        }
    },
    'ataque_duplo_destroi_no_fim': (jog, alvo, estado) => {
        const m = jog.zonaMonstros[alvo.slot];
        if (m) {
            m.ataquesRestantes = 2;
            m.turnoUsadoParaDuplo = estado.turno;
            window.adicionarLog(jog.id, `${m.nome} atacará duas vezes e será destruído no final!`);
            window.animarCarta(jog.id, 'monstro', alvo.slot);
        }
    },
    'destruir_inimigo': (jog, alvo, _, op, estado) => {
        const m = op.zonaMonstros[alvo.slot];
        if (m) {
            if (m.efeito === 'imune_a_magias' || m.efeito === 'nao_pode_ser_destruido_por_efeito') {
                window.adicionarLog(jog.id, `${m.nome} é imune a magias.`);
            } else {
                window.destruirMonstro(op.id, alvo.slot, 'efeito de magia', estado);
            }
        }
    },
    'destruir_todos_inimigos': (jog, _, __, op, estado) => {
        for (let i = 0; i < op.zonaMonstros.length; i++) {
            const m = op.zonaMonstros[i];
            if (m && m.efeito !== 'imune_a_magias' && m.efeito !== 'nao_pode_ser_destruido_por_efeito') {
                window.destruirMonstro(op.id, i, 'efeito de magia', estado);
            }
        }
    },
    'destruir_magias_armadilhas': (jog, _, __, op, estado) => {
        for (let i = 0; i < op.zonaMagias.length; i++) {
            if (op.zonaMagias[i]) op.zonaMagias[i] = null;
        }
        window.adicionarLog(jog.id, 'Todas as magias/armadilhas do oponente foram destruídas.');
    },
    'devolver_monstro_mao': (jog, alvo, _, op, estado) => {
        const m = op.zonaMonstros[alvo.slot];
        if (m) {
            op.zonaMonstros[alvo.slot] = null;
            if (op.mao.length < 5) op.mao.push(m);
            else op.cemiterio.push(m);
            window.adicionarLog(jog.id, `${m.nome} foi devolvido para a mão.`);
        }
    },
    'prende_monstro_inimigo': (jog, alvo, _, op, estado) => {
        const m = op.zonaMonstros[alvo.slot];
        if (m) {
            m.estaPreso = true;
            window.adicionarLog(jog.id, `${m.nome} está preso!`);
        }
    },
    'roubar_monstro': (jog, alvo, _, op, estado) => {
        const m = op.zonaMonstros[alvo.slot];
        if (m) {
            op.zonaMonstros[alvo.slot] = null;
            const v = jog.zonaMonstros.findIndex(s => s === null);
            if (v !== -1) {
                jog.zonaMonstros[v] = { ...m, temporario: true, jaAtacou: false, ataquesRestantes: 1 };
                window.adicionarLog(jog.id, `${m.nome} foi controlado!`);
                window.animarCarta(jog.id, 'monstro', v);
            } else {
                op.cemiterio.push(m);
            }
        }
    },
    'reviver_monstro': (jog, alvo, estado) => {
        if (alvo.tipo === 'cemiterio') {
            const cem = jog.cemiterio;
            const m = cem[alvo.index];
            if (m) {
                cem.splice(alvo.index, 1);
                const v = jog.zonaMonstros.findIndex(s => s === null);
                if (v !== -1) {
                    jog.zonaMonstros[v] = { ...m, jaAtacou: false, ataquesRestantes: 1, bonusAtk: 0, bonusDef: 0, temporario: false };
                    window.adicionarLog(jog.id, `${m.nome} foi revivido!`);
                    window.animarCarta(jog.id, 'monstro', v);
                } else {
                    window.adicionarLog(jog.id, 'Zona de monstros cheia.');
                }
            }
        }
    },
    'curar_2000': (jog, _, __, ___, estado) => {
        jog.hp += 2000;
        window.adicionarLog(jog.id, `${window.nomeJogador(jog.id)} curou 2000 de vida.`);
    },
    'curar_1000_por_monstro': (jog, _, __, ___, estado) => {
        const c = jog.zonaMonstros.filter(m => m !== null).length;
        jog.hp += c * 1000;
        window.adicionarLog(jog.id, `${window.nomeJogador(jog.id)} curou ${c * 1000} de vida.`);
    },
    'comprar_2': (jog, _, __, ___, estado) => {
        window.comprarCarta(jog.id, 2, estado);
    },
    'comprar_3_dano_1000': (jog, _, __, ___, estado) => {
        window.comprarCarta(jog.id, 3, estado);
        jog.hp -= 1000;
        window.adicionarLog(jog.id, `${window.nomeJogador(jog.id)} perdeu 1000 de vida.`);
        window.verificarFimDeDuelo(estado);
    },
    'trocar_vida_por_cartas': (jog, _, __, ___, estado) => {
        jog.hp -= 2000;
        window.comprarCarta(jog.id, 2, estado);
        window.adicionarLog(jog.id, `${window.nomeJogador(jog.id)} perdeu 2000 PV para comprar 2 cartas.`);
        window.verificarFimDeDuelo(estado);
    },
    'metade_vida_compra_3': (jog, _, __, ___, estado) => {
        const c = Math.ceil(jog.hp / 2);
        jog.hp -= c;
        window.comprarCarta(jog.id, 3, estado);
        window.adicionarLog(jog.id, `${window.nomeJogador(jog.id)} pagou ${c} PV para comprar 3 cartas.`);
        window.verificarFimDeDuelo(estado);
    },
    'dano_direto_1000': (jog, _, __, op, estado) => {
        op.hp -= 1000;
        window.adicionarLog(jog.id, `${window.nomeJogador(jog.id)} causou 1000 de dano direto!`);
        window.verificarFimDeDuelo(estado);
    },
    'iguala_vida_menor': (jog, _, __, op, estado) => {
        if (jog.hp < op.hp) {
            jog.hp += (op.hp - jog.hp);
            window.adicionarLog(jog.id, `${window.nomeJogador(jog.id)} igualou a vida à do oponente!`);
        }
    },
    'devolve_mao_compra': (jog, _, __, ___, estado) => {
        const q = jog.mao.length;
        for (let i = 0; i < q; i++) jog.mao.pop();
        window.comprarCarta(jog.id, q, estado);
        window.adicionarLog(jog.id, `${window.nomeJogador(jog.id)} devolveu a mão e comprou ${q} cartas.`);
    },
    'olhar_mao_comprar_1': (jog, _, __, op, estado) => {
        if (op.mao.length > 0) {
            window.adicionarLog(jog.id, `${window.nomeJogador(jog.id)} olhou a mão: ${op.mao.map(c => c.nome).join(', ')}`);
        }
        window.comprarCarta(jog.id, 1, estado);
    },
    'bloqueia_magias_turno': (jog, _, __, ___, estado) => {
        estado.magiasBloqueadas = true;
        window.adicionarLog(jog.id, 'Zona de Antimagia bloqueia magias até o próximo turno.');
    },
    'destruir_monstros_baixo_atk': (jog, _, __, op, estado) => {
        for (let i = 0; i < jog.zonaMonstros.length; i++) {
            const m = jog.zonaMonstros[i];
            if (m && (m.atk + (m.bonusAtk || 0)) <= 1500) {
                window.destruirMonstro(jog.id, i, 'Punição dos Fracos', estado);
            }
        }
        for (let i = 0; i < op.zonaMonstros.length; i++) {
            const m = op.zonaMonstros[i];
            if (m && (m.atk + (m.bonusAtk || 0)) <= 1500) {
                window.destruirMonstro(op.id, i, 'Punição dos Fracos', estado);
            }
        }
    }
};

const MAPA_EFEITOS_INVOCACAO = {
    'ao_invocar_revive_monstro': (jog, m, op, estado) => {
        if (jog.cemiterio.length > 0) {
            const f = jog.cemiterio.reduce((a, b) => b.atk > a.atk ? b : a);
            const idx = jog.cemiterio.indexOf(f);
            jog.cemiterio.splice(idx, 1);
            const v = jog.zonaMonstros.findIndex(s => s === null);
            if (v !== -1) {
                jog.zonaMonstros[v] = { ...f, jaAtacou: false, ataquesRestantes: 1, bonusAtk: 0, bonusDef: 0, temporario: false };
                window.adicionarLog(jog.id, `${m.nome} reviveu ${f.nome}!`);
                window.animarCarta(jog.id, 'monstro', v);
            }
        }
    },
    'ao_invocar_destroi_magia_armadilha': (jog, m, op, estado) => {
        for (let i = 0; i < op.zonaMagias.length; i++) {
            if (op.zonaMagias[i]) {
                window.adicionarLog(jog.id, `${m.nome} destruiu ${op.zonaMagias[i].nome}.`);
                op.zonaMagias[i] = null;
            }
        }
    },
    'ao_invocar_destroi_armadilha': (jog, m, op, estado) => {
        for (let i = 0; i < op.zonaMagias.length; i++) {
            const t = op.zonaMagias[i];
            if (t && t.tipo === 'armadilha') {
                window.adicionarLog(jog.id, `${m.nome} destruiu a armadilha ${t.nome}.`);
                op.zonaMagias[i] = null;
            }
        }
    },
    'ao_invocar_destroi_todas_magias': (jog, m, op, estado) => {
        for (let i = 0; i < op.zonaMagias.length; i++) {
            const t = op.zonaMagias[i];
            if (t && t.tipo === 'magia') {
                window.adicionarLog(jog.id, `${m.nome} destruiu a magia ${t.nome}.`);
                op.zonaMagias[i] = null;
            }
        }
    },
    'ao_invocar_ganha_1000_vida': (jog, m, op, estado) => {
        jog.hp += 1000;
        window.adicionarLog(jog.id, `${m.nome} curou 1000 PV.`);
    },
    'ao_invocar_causa_500_dano_em_si': (jog, m, op, estado) => {
        jog.hp -= 500;
        window.adicionarLog(jog.id, `${m.nome} causou 500 de dano a si mesmo.`);
        window.verificarFimDeDuelo(estado);
    },
    'ao_invocar_muda_inimigos_para_defesa': (jog, m, op, estado) => {
        for (let i = 0; i < op.zonaMonstros.length; i++) {
            if (op.zonaMonstros[i]) {
                op.zonaMonstros[i].posicao = 'defesa';
                op.zonaMonstros[i].posicaoMudouEsteTurno = true;
            }
        }
        window.adicionarLog(jog.id, `${m.nome} mudou os inimigos para defesa.`);
    },
    'ao_invocar_comprar_1_carta': (jog, m, op, estado) => {
        window.comprarCarta(jog.id, 1, estado);
    },
    'ao_invocar_causa_500_dano_direto': (jog, m, op, estado) => {
        op.hp -= 500;
        window.adicionarLog(jog.id, `${m.nome} causou 500 de dano direto!`);
        window.verificarFimDeDuelo(estado);
    },
    'ao_invocar_devolve_monstro_pra_mao': (jog, m, op, estado) => {
        if (op.zonaMonstros.some(s => s !== null)) {
            const idx = op.zonaMonstros.findIndex(s => s !== null);
            const a = op.zonaMonstros[idx];
            op.zonaMonstros[idx] = null;
            if (op.mao.length < 5) op.mao.push(a);
            else op.cemiterio.push(a);
            window.adicionarLog(jog.id, `${m.nome} devolveu ${a.nome}.`);
        }
    },
    'ao_invocar_olhar_mao_oponente': (jog, m, op, estado) => {
        const nomes = op.mao.map(c => c.nome).join(', ');
        window.adicionarLog(jog.id, `${m.nome} espiou a mão: ${nomes}`);
    }
};

const MAPA_EFEITOS_MORTE = {
    'quando_morre_ganha_500_vida': (jog, estado) => {
        jog.hp += 500;
        window.adicionarLog(jog.id, `${window.nomeJogador(jog.id)} ganhou 500 de vida.`);
    }
};

// -------------------- Funções centrais --------------------
function comprarCarta(jogadorId, quantidade, estado) {
    const jogador = estado.jogadores[jogadorId];
    if (jogador.devePularCompra) {
        window.adicionarLog(jogadorId, `${window.nomeJogador(jogadorId)} teve sua compra pulada!`);
        jogador.devePularCompra = false;
        return false;
    }
    for (let i = 0; i < quantidade; i++) {
        if (jogador.deck.length === 0) {
            finalizarDuelo(jogadorId === 1 ? 2 : 1, 'Deck vazio', estado);
            return false;
        }
        const carta = jogador.deck.shift();
        if (jogador.mao.length < 5) jogador.mao.push(carta);
    }
    return true;
}

function destruirMonstro(jogadorId, slotIndex, motivo, estado) {
    const jogador = estado.jogadores[jogadorId];
    const monstro = jogador.zonaMonstros[slotIndex];
    if (!monstro) return;
    if (MAPA_EFEITOS_MORTE[monstro.efeito]) {
        MAPA_EFEITOS_MORTE[monstro.efeito](jogador, estado);
    }
    jogador.cemiterio.push(monstro);
    jogador.zonaMonstros[slotIndex] = null;
    window.adicionarLog(jogadorId, `${monstro.nome} foi destruído (${motivo}).`);
    window.verificarFimDeDuelo(estado);
}

function invocarMonstro(jogadorId, maoIndex, slotIndex, posicao, estado) {
    const jogador = estado.jogadores[jogadorId];
    const carta = jogador.mao[maoIndex];
    if (!carta || carta.tipo !== 'monstro') return false;
    if (slotIndex < 0 || slotIndex > 2 || jogador.zonaMonstros[slotIndex] !== null) return false;

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

    jogador.zonaMonstros[slotIndex] = monstro;
    window.adicionarLog(jogadorId, `${window.nomeJogador(jogadorId)} invocou ${carta.nome} na posição ${posicao}.`);

    if (MAPA_EFEITOS_INVOCACAO[monstro.efeito]) {
        const oponente = estado.jogadores[jogadorId === 1 ? 2 : 1];
        MAPA_EFEITOS_INVOCACAO[monstro.efeito](jogador, monstro, oponente, estado);
    }
    return true;
}

function baixarArmadilha(jogadorId, maoIndex, slotIndex, estado) {
    const jogador = estado.jogadores[jogadorId];
    const carta = jogador.mao[maoIndex];
    if (!carta || carta.tipo !== 'armadilha') return false;
    if (slotIndex < 0 || slotIndex > 2 || jogador.zonaMagias[slotIndex] !== null) return false;
    jogador.mao.splice(maoIndex, 1);
    jogador.zonaMagias[slotIndex] = { ...carta, viradaParaBaixo: true };
    window.adicionarLog(jogadorId, `${window.nomeJogador(jogadorId)} baixou uma armadilha.`);
    return true;
}

function usarMagia(jogadorId, maoIndex, alvo, estado) {
    const jogador = estado.jogadores[jogadorId];
    const carta = jogador.mao[maoIndex];
    if (!carta || carta.tipo !== 'magia') return false;
    const oponente = estado.jogadores[jogadorId === 1 ? 2 : 1];

    jogador.mao.splice(maoIndex, 1);
    window.adicionarLog(jogadorId, `${window.nomeJogador(jogadorId)} ativou ${carta.nome}.`);

    if (MAPA_EFEITOS_MAGIA[carta.efeito]) {
        MAPA_EFEITOS_MAGIA[carta.efeito](jogador, alvo, carta, oponente, estado);
    }
    return true;
}

function resolverBatalha(jogadorAtacanteId, jogadorDefensorId, slotAtacante, slotDefensor, estado) {
    const atacante = estado.jogadores[jogadorAtacanteId].zonaMonstros[slotAtacante];
    const defensor = estado.jogadores[jogadorDefensorId].zonaMonstros[slotDefensor];
    if (!atacante || !defensor) return;

    let atkTotal = atacante.atk + (atacante.bonusAtk || 0);
    const defTotal = defensor.posicao === 'ataque' ? defensor.atk + (defensor.bonusAtk || 0) : defensor.def + (defensor.bonusDef || 0);

    if (atacante.efeito === 'batalha_iguala_atk_def_do_inimigo') atkTotal = defTotal;
    if (atacante.efeito === 'copia_atk_do_alvo') atkTotal = defTotal;

    if (defensor.posicao === 'ataque') {
        const dif = atkTotal - defTotal;
        if (dif > 0) {
            destruirMonstro(jogadorDefensorId, slotDefensor, 'batalha', estado);
            estado.jogadores[jogadorDefensorId].hp -= dif;
            window.adicionarLog(jogadorAtacanteId, `${defensor.nome} destruído! ${window.nomeJogador(jogadorDefensorId)} perdeu ${dif} HP.`);
            if (atacante.efeito === 'ganha_500_atk_ao_destruir_inimigo') {
                atacante.bonusAtk += 500;
                window.adicionarLog(jogadorAtacanteId, `${atacante.nome} ganhou +500 de ATK.`);
            }
            if (atacante.efeito === 'cura_vida_igual_dano_causado') {
                estado.jogadores[jogadorAtacanteId].hp += dif;
                window.adicionarLog(jogadorAtacanteId, `${atacante.nome} curou ${dif} de vida.`);
            }
        } else if (dif === 0) {
            destruirMonstro(jogadorAtacanteId, slotAtacante, 'batalha', estado);
            destruirMonstro(jogadorDefensorId, slotDefensor, 'batalha', estado);
            window.adicionarLog(jogadorAtacanteId, `Empate! Ambos destruídos.`);
        } else {
            destruirMonstro(jogadorAtacanteId, slotAtacante, 'batalha', estado);
            estado.jogadores[jogadorAtacanteId].hp -= (-dif);
            window.adicionarLog(jogadorAtacanteId, `${atacante.nome} destruído! ${window.nomeJogador(jogadorAtacanteId)} perdeu ${-dif} HP.`);
        }
    } else { // Atacando em Defesa
        if (atacante.efeito === 'ao_atacar_destroi_monstro_em_defesa') {
            destruirMonstro(jogadorDefensorId, slotDefensor, 'efeito Samurai Escarlate', estado);
            window.adicionarLog(jogadorAtacanteId, `${defensor.nome} foi destruído pelo efeito de ${atacante.nome}!`);
            return;
        }
        const dif = atkTotal - defTotal;
        if (dif > 0) {
            destruirMonstro(jogadorDefensorId, slotDefensor, 'batalha', estado);
            window.adicionarLog(jogadorAtacanteId, `${defensor.nome} destruído em defesa.`);
            if (atacante.efeito === 'dano_perfurante' || atacante.efeito === 'ignora_defesa_ataque_direto') {
                estado.jogadores[jogadorDefensorId].hp -= dif;
                window.adicionarLog(jogadorAtacanteId, `Dano perfurante! ${window.nomeJogador(jogadorDefensorId)} perdeu ${dif} HP.`);
            }
        } else if (dif < 0) {
            estado.jogadores[jogadorAtacanteId].hp -= (-dif);
            window.adicionarLog(jogadorAtacanteId, `${atacante.nome} não destruiu ${defensor.nome}. ${window.nomeJogador(jogadorAtacanteId)} perdeu ${-dif} HP.`);
        }
    }
    window.verificarFimDeDuelo(estado);
}

function encerrarTurno(estado) {
    if (estado.fase === 'fim') return;
    if (estado.fase === 'batalha') {
        estado.fase = 'main';
        estado.hasAttacked = true;
        estado.atacanteSelecionado = null;
        window.limparDestaques();
        window.adicionarLog(estado.jogadorAtual, 'Fase de batalha encerrada.');
    }

    // Aplicar efeitos de fim de turno
    const p1 = estado.jogadores[1];
    const p2 = estado.jogadores[2];
    [p1, p2].forEach((jogador, idx) => {
        const id = idx + 1;
        let cura = 0,
            dano = 0;
        jogador.zonaMonstros.forEach(m => {
            if (m) {
                if (m.efeito === 'final_turno_cura_300_por_aliado') {
                    cura += 300 * jogador.zonaMonstros.filter(s => s !== null).length;
                }
                if (m.efeito === 'buff_2000_dano_1000_por_turno' && m.bonusAtk > 0) {
                    dano += 1000;
                }
                if (m.efeito === 'ataque_duplo_destroi_no_fim' && m.ataquesRestantes > 0 && estado.turno === m.turnoUsadoParaDuplo) {
                    window.destruirMonstro(id, jogador.zonaMonstros.indexOf(m), 'Poção da Fúria', estado);
                    m.ataquesRestantes = 1;
                }
                m.naoPodeAtacarProximoTurno = false;
                m.estaPreso = false;
            }
        });
        if (cura > 0) {
            jogador.hp += cura;
            window.adicionarLog(id, `${window.nomeJogador(id)} curou ${cura} PV.`);
        }
        if (dano > 0) {
            jogador.hp -= dano;
            window.adicionarLog(id, `${window.nomeJogador(id)} perdeu ${dano} PV (Espada Amaldiçoada).`);
            window.verificarFimDeDuelo(estado);
        }
    });

    // Trocar turno
    const outro = estado.jogadorAtual === 1 ? 2 : 1;
    estado.jogadorAtual = outro;
    estado.turno++;
    estado.primeiroTurno = false;
    estado.hasAttacked = false;
    estado.fase = 'main';
    estado.atacanteSelecionado = null;
    estado.cartaSelecionada = null;
    estado.acaoPendente = null;
    window.limparDestaques();

    // Resetar monstros
    for (let i = 1; i <= 2; i++) {
        estado.jogadores[i].zonaMonstros.forEach(m => {
            if (m) {
                m.ataquesRestantes = m.efeito === 'pode_atacar_duas_vezes' ? 2 : 1;
                m.jaAtacou = false;
                m.invocadoEsteTurno = false;
                m.posicaoMudouEsteTurno = false;
                m.turnoUsadoParaDuplo = 0;
            }
        });
    }

    // Comprar carta para o próximo
    const prox = estado.jogadores[outro];
    window.comprarCarta(prox.id, 5 - prox.mao.length, estado);
    window.adicionarLog(outro, `--- Turno ${estado.turno} - ${window.nomeJogador(outro)} ---`);
}

function verificarFimDeDuelo(estado) {
    if (estado.fase === 'fim') return true;
    // Verifica se os jogadores existem antes de acessar hp
    if (!estado.jogadores || !estado.jogadores[1] || !estado.jogadores[2]) return false;
    if (estado.jogadores[1].hp <= 0) {
        finalizarDuelo(2, 'HP zerado', estado);
        return true;
    }
    if (estado.jogadores[2].hp <= 0) {
        finalizarDuelo(1, 'HP zerado', estado);
        return true;
    }
    return false;
}

function finalizarDuelo(vencedorId, motivo, estado) {
    if (estado.fase === 'fim') return;
    estado.fase = 'fim';
    window.adicionarLog(vencedorId, `🏆 ${window.nomeJogador(vencedorId)} venceu o duelo! Motivo: ${motivo}`);
    // Atualizar placar (se houver campeonato)
    if (estado.campeonato) {
        if (vencedorId === 1) estado.campeonato.vitoriasJ1++;
        else estado.campeonato.vitoriasJ2++;
        // ... resto da lógica de campeonato (opcional)
    }
}

// -------------------- Animações --------------------
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
        setTimeout(() => cardElement.classList.remove(classe), 800);
    }
}

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

// -------------------- Exportações globais --------------------
window.MAPA_EFEITOS_MAGIA = MAPA_EFEITOS_MAGIA;
window.MAPA_EFEITOS_INVOCACAO = MAPA_EFEITOS_INVOCACAO;
window.MAPA_EFEITOS_MORTE = MAPA_EFEITOS_MORTE;
window.comprarCarta = comprarCarta;
window.destruirMonstro = destruirMonstro;
window.invocarMonstro = invocarMonstro;
window.baixarArmadilha = baixarArmadilha;
window.usarMagia = usarMagia;
window.resolverBatalha = resolverBatalha;
window.encerrarTurno = encerrarTurno;
window.verificarFimDeDuelo = verificarFimDeDuelo;
window.finalizarDuelo = finalizarDuelo;
window.animarCarta = animarCarta;
window.animarAtaque = animarAtaque;