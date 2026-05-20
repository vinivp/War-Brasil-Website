function renderizarCarrinho() {
  const container = document.getElementById("cart-items-container");

  if (!container) {
    return;
  }

  const carrinho = carregarCarrinho();
  let html = "";
  let total = 0;

  if (carrinho.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 px-6 bg-slate-900/20 rounded-2xl border border-dashed border-white/10">
        <p class="text-gray-500">Seu carrinho está vazio.</p>
        <a href="/index.html" class="text-yellow-500 text-sm underline mt-4 block">Voltar para a loja</a>
      </div>`;
    document.getElementById("total-valor").innerText = formatarMoeda(0);
    document.getElementById("subtotal-valor").innerText = formatarMoeda(0);
    return;
  }

  carrinho.forEach((item, index) => {
    const nome = escaparHTML(item.nome);
    const imagem = escaparHTML(item.imagem);

    total += item.preco;
    html += `
      <div class="bg-slate-900/40 border border-white/5 p-4 sm:p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-yellow-500/30 transition">
        <div class="flex items-center gap-4 sm:gap-6 min-w-0">
          <img src="${imagem}" alt="${nome}" loading="lazy" class="w-20 h-20 rounded-xl object-cover border border-white/10 shrink-0">
          <div class="min-w-0">
            <h3 class="font-bold text-white uppercase text-sm break-words">${nome}</h3>
            <span class="text-yellow-500 font-bold text-lg block">${formatarMoeda(item.preco)}</span>
          </div>
        </div>
        <button type="button" onclick="removerDoCarrinho(${index})" class="self-end sm:self-auto text-gray-500 hover:text-red-500 p-3 transition" aria-label="Remover ${nome} do carrinho">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>`;
  });

  container.innerHTML = html;
  document.getElementById("total-valor").innerText = formatarMoeda(total);
  document.getElementById("subtotal-valor").innerText = formatarMoeda(total);
}

function removerDoCarrinho(index) {
  const carrinho = carregarCarrinho();
  carrinho.splice(index, 1);
  salvarCarrinho(carrinho);
  renderizarCarrinho();
  atualizarContadorCarrinho();
}

document.addEventListener("DOMContentLoaded", renderizarCarrinho);
