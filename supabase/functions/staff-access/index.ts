import { createClient } from "npm:@supabase/supabase-js@2";

const masterKeySha256 =
  "c1d687b469a79d67efd7255aa5073944323ade935d1ad11dead62d642b3b672b";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-staff-master-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

type StaffRole = "owner" | "admin" | "staff";
type StaffAccessAction =
  | "list"
  | "create"
  | "update"
  | "delete"
  | "technical_email"
  | "upload_asset";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    status,
  });
}

function getEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getSecretKey() {
  const legacyServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (legacyServiceRole) {
    return legacyServiceRole;
  }

  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const firstKey = Object.values(keys)[0];

  if (typeof firstKey !== "string") {
    throw new Error("No Supabase secret key available.");
  }

  return firstKey;
}

function normalizeCpf(cpf: unknown) {
  return String(cpf || "").replace(/\D/g, "");
}

function validateCpf(cpf: unknown) {
  const digits = normalizeCpf(cpf);

  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) {
    return false;
  }

  const calculateDigit = (base: string) => {
    let sum = 0;

    for (let index = 0; index < base.length; index += 1) {
      sum += Number(base[index]) * (base.length + 1 - index);
    }

    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return (
    calculateDigit(digits.slice(0, 9)) === Number(digits[9]) &&
    calculateDigit(digits.slice(0, 10)) === Number(digits[10])
  );
}

async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function isValidMasterKey(value: unknown) {
  const key = String(value || "");

  if (!key) {
    return false;
  }

  return (await sha256Hex(key)) === masterKeySha256;
}

async function cpfToTechnicalEmail(cpf: unknown) {
  const digits = normalizeCpf(cpf);

  if (!validateCpf(digits)) {
    throw new Error("CPF inválido.");
  }

  const cpfHash = await sha256Hex(digits);

  return {
    cpfHash,
    cpfLast4: digits.slice(-4),
    email: `${cpfHash}@staff.hytalewar.local`,
  };
}

function assertRole(value: unknown): StaffRole {
  if (value === "owner" || value === "admin" || value === "staff") {
    return value;
  }

  return "staff";
}

function decodeBase64(value: unknown) {
  const base64 = String(value || "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function assertAssetPath(value: unknown) {
  const path = String(value || "").trim();

  if (!/^img\/[a-zA-Z0-9._-]+\.(png|webp)$/i.test(path)) {
    throw new Error("Caminho do arquivo inválido.");
  }

  return path;
}

function assertImageContentType(value: unknown) {
  const contentType = String(value || "").toLowerCase();

  if (contentType === "image/png" || contentType === "image/webp") {
    return contentType;
  }

  throw new Error("Tipo de imagem inválido.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const masterKey = req.headers.get("x-staff-master-key") || body.master_key;

    if (!(await isValidMasterKey(masterKey))) {
      return jsonResponse({ error: "Chave de acesso inválida." }, 401);
    }

    const supabaseUrl = getEnv("SUPABASE_URL");
    const secretKey = getSecretKey();
    const action = String(body.action || "") as StaffAccessAction;

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false },
    });

    if (action === "technical_email") {
      const { email } = await cpfToTechnicalEmail(body.cpf);
      return jsonResponse({ email });
    }

    if (action === "upload_asset") {
      const path = assertAssetPath(body.path);
      const contentType = assertImageContentType(body.content_type);
      const bytes = decodeBase64(body.data_base64);

      if (bytes.byteLength > 10 * 1024 * 1024) {
        throw new Error("Arquivo maior que 10 MB.");
      }

      const { error: uploadError } = await admin.storage
        .from("war-assets")
        .upload(path, bytes, {
          cacheControl: "31536000",
          contentType,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = admin.storage.from("war-assets").getPublicUrl(path);

      return jsonResponse({ path, publicUrl: data.publicUrl });
    }

    if (action === "list") {
      const { data, error } = await admin
        .from("staff_profiles")
        .select(
          "id, display_name, role, cpf_last4, active, created_at, updated_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return jsonResponse({ staff: data || [] });
    }

    if (action === "create") {
      const displayName = String(body.display_name || "").trim();
      const password = String(body.password || "");
      const role = assertRole(body.role);
      const active = body.active !== false;
      const { cpfHash, cpfLast4, email } = await cpfToTechnicalEmail(body.cpf);

      if (displayName.length < 2) {
        throw new Error("Informe um nome para o membro da staff.");
      }

      if (password.length < 8) {
        throw new Error("A senha precisa ter pelo menos 8 caracteres.");
      }

      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          password,
          user_metadata: { display_name: displayName },
        });

      if (createError || !created.user) {
        throw createError || new Error("Usuário não foi criado.");
      }

      const { error: profileError } = await admin
        .from("staff_profiles")
        .upsert({
          active,
          cpf_hash: cpfHash,
          cpf_last4: cpfLast4,
          display_name: displayName,
          id: created.user.id,
          role,
        });

      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw profileError;
      }

      return jsonResponse({ ok: true });
    }

    if (action === "update") {
      const targetId = String(body.id || "");
      const displayName = String(body.display_name || "").trim();
      const role = assertRole(body.role);
      const active = body.active !== false;
      const password = String(body.password || "");

      if (!targetId) {
        throw new Error("ID do membro não informado.");
      }

      if (displayName.length < 2) {
        throw new Error("Informe um nome para o membro da staff.");
      }

      const { data: target, error: targetError } = await admin
        .from("staff_profiles")
        .select("id")
        .eq("id", targetId)
        .maybeSingle();

      if (targetError || !target) {
        throw targetError || new Error("Membro da staff não encontrado.");
      }

      const { error: profileError } = await admin
        .from("staff_profiles")
        .update({ active, display_name: displayName, role })
        .eq("id", targetId);

      if (profileError) {
        throw profileError;
      }

      const authUpdate: Record<string, unknown> = {
        user_metadata: { display_name: displayName },
      };

      if (password) {
        if (password.length < 8) {
          throw new Error("A senha precisa ter pelo menos 8 caracteres.");
        }

        authUpdate.password = password;
      }

      const { error: authError } = await admin.auth.admin.updateUserById(
        targetId,
        authUpdate,
      );

      if (authError) {
        throw authError;
      }

      return jsonResponse({ ok: true });
    }

    if (action === "delete") {
      const targetId = String(body.id || "");

      if (!targetId) {
        throw new Error("ID do membro não informado.");
      }

      const { error } = await admin.auth.admin.deleteUser(targetId);

      if (error) {
        throw error;
      }

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Ação inválida." }, 400);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro inesperado." },
      400,
    );
  }
});
