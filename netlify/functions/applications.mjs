import { createClient } from "@libsql/client";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

function getDb() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables are required.");
  }
  return createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

async function ensureTable(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS applications (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      job_title   TEXT,
      company     TEXT,
      location    TEXT,
      status      TEXT DEFAULT 'applied',
      url         TEXT,
      source      TEXT,
      applied_date TEXT,
      notes       TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);
}

export default async (req, context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const userId = "default-user";
  const url = new URL(req.url);
  const appId = url.searchParams.get("id");

  const db = getDb();

  try {
    await ensureTable(db);

    // GET /api/applications — list all for user
    if (req.method === "GET") {
      const result = await db.execute({
        sql: "SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC",
        args: [userId],
      });
      return new Response(JSON.stringify(result.rows), { status: 200, headers: CORS });
    }

    // POST /api/applications — create new
    if (req.method === "POST") {
      const body = await req.json();
      const id = crypto.randomUUID();
      await db.execute({
        sql: `INSERT INTO applications (id, user_id, job_title, company, location, status, url, source, applied_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, userId, body.jobTitle, body.company, body.location, body.status || "applied", body.url, body.source, body.appliedDate],
      });
      return new Response(JSON.stringify({ id, ...body, user_id: userId }), { status: 201, headers: CORS });
    }

    // PATCH /api/applications?id=xxx — update status
    if (req.method === "PATCH" && appId) {
      const body = await req.json();
      await db.execute({
        sql: "UPDATE applications SET status = ? WHERE id = ? AND user_id = ?",
        args: [body.status, appId, userId],
      });
      return new Response(JSON.stringify({ id: appId, status: body.status }), { status: 200, headers: CORS });
    }

    // DELETE /api/applications?id=xxx — remove
    if (req.method === "DELETE" && appId) {
      await db.execute({
        sql: "DELETE FROM applications WHERE id = ? AND user_id = ?",
        args: [appId, userId],
      });
      return new Response(JSON.stringify({ deleted: appId }), { status: 200, headers: CORS });
    }

    return new Response(JSON.stringify({ error: "Method not supported" }), { status: 405, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
};

export const config = { path: "/api/applications" };
