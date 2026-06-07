import { neon } from "@neondatabase/serverless";

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
};

const getSql = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  return neon(process.env.DATABASE_URL);
};

const ensureTable = async (sql) => {
  await sql`
    create table if not exists budget (
      id text primary key,
      payload text not null,
      updated_at timestamptz not null default now()
    )
  `;
};

export default async function handler(req, res) {
  try {
    const sql = getSql();
    await ensureTable(sql);

    if (req.method === "GET") {
      const id = String(req.query.id || "shared-v1");
      const rows = await sql`
        select payload
        from budget
        where id = ${id}
        limit 1
      `;
      return json(res, 200, rows[0] || null);
    }

    if (req.method === "POST") {
      const { id = "shared-v1", payload, updated_at } = req.body || {};
      if (typeof payload !== "string" || !payload) {
        return json(res, 400, { error: "payload is required" });
      }

      await sql`
        insert into budget (id, payload, updated_at)
        values (${String(id)}, ${payload}, ${updated_at ? new Date(updated_at).toISOString() : new Date().toISOString()})
        on conflict (id)
        do update set
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `;
      return json(res, 200, { ok: true });
    }

    res.setHeader("allow", "GET, POST");
    return json(res, 405, { error: "method not allowed" });
  } catch (error) {
    return json(res, 500, { error: error.message || "server error" });
  }
}
