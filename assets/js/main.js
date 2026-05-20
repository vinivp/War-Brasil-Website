const CART_STORAGE_KEY = "carrinho";

function carregarCarrinho() {
  try {
    const carrinho = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];

    if (!Array.isArray(carrinho)) {
      return [];
    }

    return carrinho
      .map((item) => ({
        nome: String(item.nome || "").trim(),
        preco: Number(item.preco),
        imagem: String(item.imagem || "").trim(),
        product_id: item.product_id ? String(item.product_id) : null,
      }))
      .filter((item) => item.nome && Number.isFinite(item.preco));
  } catch {
    localStorage.removeItem(CART_STORAGE_KEY);
    return [];
  }
}

function salvarCarrinho(carrinho) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(carrinho));
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function escaparHTML(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function adicionarAoCarrinho(nome, preco, imagem, produtoId = null) {
  const carrinho = carregarCarrinho();
  const produto = {
    nome: String(nome || "").trim(),
    preco: Number(preco),
    imagem: String(imagem || "").trim(),
    product_id: produtoId ? String(produtoId) : null,
  };

  if (!produto.nome || !Number.isFinite(produto.preco)) {
    alert("Não foi possível adicionar este item ao carrinho.");
    return;
  }

  const itemExistente = carrinho.find((item) => item.nome === produto.nome);

  if (itemExistente) {
    alert("Este item já está no seu carrinho!");
    return;
  }

  carrinho.push(produto);
  salvarCarrinho(carrinho);
  atualizarContadorCarrinho();
  alert(`${produto.nome} foi adicionado ao seu carrinho!`);
}

function atualizarContadorCarrinho() {
  const totalItens = carregarCarrinho().length;
  const contadores = document.querySelectorAll(".cart-count");

  contadores.forEach((contador) => {
    contador.innerText = totalItens;
    contador.setAttribute("aria-label", `${totalItens} itens no carrinho`);
  });
}

document.addEventListener("DOMContentLoaded", atualizarContadorCarrinho);
