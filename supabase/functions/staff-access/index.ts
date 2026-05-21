import { createClient } from "npm:@supabase/supabase-js@2";

const masterKeySha256 =
  "c1d687b469a79d67efd7255aa5073944323ade935d1ad11dead62d642b3b672b";
const legacyTechnicalEmailDomain = "@staff.hytalewar.local";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-staff-master-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

type StaffAccessAction =
  | "list"
  | "create"
  | "update"
  | "delete"
  | "list_roles"
  | "create_role"
  | "update_role"
  | "delete_role"
  | "upload_asset";

type StaffRoleRecord = {
  active: boolean;
  description: string;
  name: string;
  protected: boolean;
  slug: string;
  sort_order: number;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
    status,
  });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const maybeError = error as { error_description?: unknown; message?: unknown };

    if (typeof maybeError.message === "string") {
      return maybeError.message;
    }

    if (typeof maybeError.error_description === "string") {
      return maybeError.error_description;
    }

    return JSON.stringify(error);
  }

  return "Erro inesperado.";
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

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function assertEmail(value: unknown) {
  const email = normalizeEmail(value);

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
  ) {
    throw new Error("Informe um e-mail válido.");
  }

  return email;
}

function publicEmail(value: unknown) {
  const email = normalizeEmail(value);
  return email.endsWith(legacyTechnicalEmailDomain) ? "" : email;
}

function normalizeRoleSlug(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function assertRoleSlug(value: unknown) {
  const slug = normalizeRoleSlug(value);

  if (!/^[a-z0-9-]{2,32}$/.test(slug)) {
    throw new Error("Identificador do cargo inválido.");
  }

  return slug;
}

function assertRoleName(value: unknown) {
  const name = String(value || "").trim();

  if (name.length < 2 || name.length > 40) {
    throw new Error("O nome do cargo precisa ter entre 2 e 40 caracteres.");
  }

  return name;
}

function assertRoleDescription(value: unknown) {
  const description = String(value || "").trim();

  if (description.length > 160) {
    throw new Error("A descrição do cargo pode ter até 160 caracteres.");
  }

  return description;
}

function assertSortOrder(value: unknown) {
  const sortOrder = Number(value || 0);

  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) {
    throw new Error("A ordem do cargo precisa ficar entre 0 e 999.");
  }

  return sortOrder;
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

async function getRole(
  admin: ReturnType<typeof createClient>,
  value: unknown,
  options: { requireActive?: boolean } = {},
) {
  const slug = assertRoleSlug(value);
  const { data, error } = await admin
    .from("staff_roles")
    .select("slug, name, description, active, protected, sort_order")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    throw error || new Error("Cargo não encontrado.");
  }

  const role = data as StaffRoleRecord;

  if (options.requireActive !== false && !role.active) {
    throw new Error("Este cargo está inativo.");
  }

  return role;
}

async function assertAssignableRole(
  admin: ReturnType<typeof createClient>,
  value: unknown,
) {
  const role = await getRole(admin, value || "staff");
  return role.slug;
}

async function assertUniqueProfileEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
  ignoredId = "",
) {
  let query = admin
    .from("staff_profiles")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (ignoredId) {
    query = query.neq("id", ignoredId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    throw new Error("Este e-mail já está em uso por outro acesso.");
  }
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

    if (action === "list_roles") {
      const { data, error } = await admin
        .from("staff_roles")
        .select(
          "slug, name, description, active, protected, sort_order, created_at, updated_at",
        )
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      return jsonResponse({ roles: data || [] });
    }

    if (action === "create_role") {
      const name = assertRoleName(body.name);
      const slug = assertRoleSlug(body.slug || name);
      const description = assertRoleDescription(body.description);
      const active = body.active !== false;
      const sortOrder = assertSortOrder(body.sort_order);

      const { error } = await admin.from("staff_roles").insert({
        active,
        description,
        name,
        protected: false,
        slug,
        sort_order: sortOrder,
      });

      if (error) {
        throw error;
      }

      return jsonResponse({ ok: true });
    }

    if (action === "update_role") {
      const slug = assertRoleSlug(body.slug);
      await getRole(admin, slug, { requireActive: false });
      const name = assertRoleName(body.name);
      const description = assertRoleDescription(body.description);
      const active = body.active !== false;
      const sortOrder = assertSortOrder(body.sort_order);

      const { error } = await admin
        .from("staff_roles")
        .update({
          active,
          description,
          name,
          sort_order: sortOrder,
        })
        .eq("slug", slug);

      if (error) {
        throw error;
      }

      return jsonResponse({ ok: true });
    }

    if (action === "delete_role") {
      const slug = assertRoleSlug(body.slug);
      await getRole(admin, slug, { requireActive: false });

      const { count, error: countError } = await admin
        .from("staff_profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", slug);

      if (countError) {
        throw countError;
      }

      if ((count || 0) > 0) {
        throw new Error("Não é possível excluir um cargo em uso.");
      }

      const { error } = await admin.from("staff_roles").delete().eq("slug", slug);

      if (error) {
        throw error;
      }

      return jsonResponse({ ok: true });
    }

    if (action === "list") {
      const { data, error } = await admin
        .from("staff_profiles")
        .select(
          "id, display_name, role, email, active, created_at, updated_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return jsonResponse({
        staff: (data || []).map((profile) => ({
          ...profile,
          email: publicEmail(profile.email),
        })),
      });
    }

    if (action === "create") {
      const displayName = String(body.display_name || "").trim();
      const email = assertEmail(body.email);
      const password = String(body.password || "");
      const role = await assertAssignableRole(admin, body.role);
      const active = body.active !== false;

      if (displayName.length < 2) {
        throw new Error("Informe um nome para o membro da staff.");
      }

      if (password.length < 8) {
        throw new Error("A senha precisa ter pelo menos 8 caracteres.");
      }

      await assertUniqueProfileEmail(admin, email);

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
          cpf_hash: null,
          cpf_last4: null,
          display_name: displayName,
          email,
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
      const email = assertEmail(body.email);
      const role = await assertAssignableRole(admin, body.role);
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
        .select("id, email, display_name")
        .eq("id", targetId)
        .maybeSingle();

      if (targetError || !target) {
        throw targetError || new Error("Membro da staff não encontrado.");
      }

      await assertUniqueProfileEmail(admin, email, targetId);

      const authUpdate: Record<string, unknown> = {};

      if (String(target.display_name || "").trim() !== displayName) {
        authUpdate.user_metadata = { display_name: displayName };
      }

      if (normalizeEmail(target.email) !== email) {
        authUpdate.email = email;
        authUpdate.email_confirm = true;
      }

      if (password) {
        if (password.length < 8) {
          throw new Error("A senha precisa ter pelo menos 8 caracteres.");
        }

        authUpdate.password = password;
      }

      if (Object.keys(authUpdate).length > 0) {
        const { error: authError } = await admin.auth.admin.updateUserById(
          targetId,
          authUpdate,
        );

        if (authError) {
          throw authError;
        }
      }

      const { error: profileError } = await admin
        .from("staff_profiles")
        .update({ active, display_name: displayName, email, role })
        .eq("id", targetId);

      if (profileError) {
        throw profileError;
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
    return jsonResponse({ error: errorMessage(error) }, 400);
  }
});
