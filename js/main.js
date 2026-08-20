// Abre o modal de configuração do Bot
function abrirModalBot() {
    document.getElementById('modal-config').classList.remove('hidden');
}

// Fecha o modal (caso queira adicionar um botão de fechar depois)
// function fecharModal() {
//     document.getElementById('modal-config').classList.add('hidden');
// }

// Inicia o jogo redirecionando com os parâmetros
function iniciarJogo() {
    const nick = document.getElementById('nickname').value.trim();
    const dificuldade = document.getElementById('modal-dificuldade').value;
    const melhorDe = document.getElementById('modal-melhor').value;

    // Se o nick estiver vazio, define um padrão
    const nomeFinal = nick === '' ? 'Jogador 1' : nick;

    // Redireciona para a página de batalha passando os dados pela URL
    window.location.href = `game_ai.html?nick=${encodeURIComponent(nomeFinal)}&diff=${dificuldade}&bestof=${melhorDe}`;
}