(function () {
  function normalizarCPF(cpf) {
    return String(cpf || "").replace(/\D/g, "");
  }

  function validarCPF(cpf) {
    const digits = normalizarCPF(cpf);

    if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) {
      return false;
    }

    const calcularDigito = (base) => {
      let soma = 0;

      for (let i = 0; i < base.length; i += 1) {
        soma += Number(base[i]) * (base.length + 1 - i);
      }

      const resto = (soma * 10) % 11;
      return resto === 10 ? 0 : resto;
    };

    const primeiro = calcularDigito(digits.slice(0, 9));
    const segundo = calcularDigito(digits.slice(0, 10));

    return primeiro === Number(digits[9]) && segundo === Number(digits[10]);
  }

  async function sha256Hex(valor) {
    const data = new TextEncoder().encode(valor);
    const hash = await crypto.subtle.digest("SHA-256", data);

    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function cpfParaEmailTecnico(cpf) {
    const digits = normalizarCPF(cpf);

    if (!validarCPF(digits)) {
      throw new Error("CPF inválido.");
    }

    return `${await sha256Hex(digits)}@staff.hytalewar.local`;
  }

  window.WarStaffAuth = {
    cpfParaEmailTecnico,
    normalizarCPF,
    sha256Hex,
    validarCPF,
  };
})();
