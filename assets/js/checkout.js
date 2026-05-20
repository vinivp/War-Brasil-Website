function renderizarResumoCheckout() {
  const container = document.getElementById("checkout-items-list");

  if (!container) {
    return;
  }

  const carrinho = carregarCarrinho();
  const botaoPagamento = document.getElementById("finalizar-pagamento");
  let html = "";
  let total = 0;

  if (carrinho.length === 0) {
    container.innerHTML =
      '<p class="text-gray-500 text-xs italic">Nenhum item selecionado.</p>';
    document.getElementById("checkout-subtotal").innerText = formatarMoeda(0);
    document.getElementById("checkout-total").innerText = formatarMoeda(0);

    if (botaoPagamento) {
      botaoPagamento.disabled = true;
      botaoPagamento.classList.add("opacity-50", "cursor-not-allowed");
    }

    return;
  }

  carrinho.forEach((item) => {
    total += item.preco;
    html += `
      <div class="flex justify-between items-start gap-4">
        <span class="text-sm text-gray-400 break-words">1x ${escaparHTML(item.nome)}</span>
        <span class="text-sm font-bold text-white shrink-0">${formatarMoeda(item.preco)}</span>
      </div>`;
  });

  container.innerHTML = html;
  document.getElementById("checkout-subtotal").innerText = formatarMoeda(total);
  document.getElementById("checkout-total").innerText = formatarMoeda(total);

  if (botaoPagamento) {
    botaoPagamento.disabled = false;
    botaoPagamento.classList.remove("opacity-50", "cursor-not-allowed");
  }
}

async function processarPagamento() {
  const nickInput = document.getElementById("nick");
  const emailInput = document.getElementById("email");
  const button = document.getElementById("finalizar-pagamento");
  const nick = nickInput.value.trim();

  if (!nick) {
    alert("Por favor, informe seu Nick no jogo!");
    nickInput.focus();
    return;
  }

  if (!emailInput.checkValidity()) {
    alert("Por favor, informe um e-mail válido para recibo!");
    emailInput.focus();
    return;
  }

  const carrinho = carregarCarrinho();

  if (!carrinho.length) {
    alert("Seu carrinho está vazio.");
    return;
  }

  if (!window.warSupabase) {
    alert(`Pedido enviado para processamento! Nick: ${nick}`);
    return;
  }

  button.disabled = true;
  button.classList.add("opacity-60", "cursor-not-allowed");
  button.innerHTML = "<i class='fas fa-spinner fa-spin mr-2'></i> Registrando";

  try {
    const orderId = crypto.randomUUID();
    const totalCents = carrinho.reduce(
      (total, item) => total + Math.round(item.preco * 100),
      0,
    );
    const paymentMethod =
      document
        .querySelector('input[name="pay"]:checked')
        ?.id?.replace("pay-", "") || "pix";

    const { error: orderError } = await warSupabase.from("orders").insert({
      id: orderId,
      buyer_nick: nick,
      buyer_email: emailInput.value.trim(),
      payment_method: paymentMethod,
      status: "recorded",
      total_cents: totalCents,
      source: "site_checkout",
    });

    if (orderError) {
      throw orderError;
    }

    const items = carrinho.map((item) => ({
      order_id: orderId,
      product_id: item.product_id || null,
      product_name: item.nome,
      quantity: 1,
      unit_price_cents: Math.round(item.preco * 100),
    }));

    const { error: itemsError } = await warSupabase
      .from("order_items")
      .insert(items);

    if (itemsError) {
      throw itemsError;
    }

    salvarCarrinho([]);
    atualizarContadorCarrinho();
    alert(`Pedido registrado! Nick: ${nick}`);
    window.location.href = "/assets/pages/carrinho.html";
  } catch (error) {
    alert(`Não foi possível registrar o pedido: ${error.message}`);
  } finally {
    button.disabled = false;
    button.classList.remove("opacity-60", "cursor-not-allowed");
    button.innerHTML = '<i class="fas fa-lock mr-2"></i> Finalizar Pagamento';
  }
}

document.addEventListener("DOMContentLoaded", renderizarResumoCheckout);
