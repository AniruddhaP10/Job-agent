import { GoogleGenerativeAI } from "@google/generative-ai";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

export default async (req, context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const user = context.clientContext?.user;
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

  try {
    const { resumeBase64 } = await req.json();
    if (!resumeBase64) return new Response(JSON.stringify({ error: "resumeBase64 required" }), { status: 400, headers: CORS });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      { inlineData: { mimeType: "application/pdf", data: resumeBase64 } },
      { text: `Extract structured data from this resume and return ONLY valid JSON, no markdown:
{"name":"","email":"","phone":"","title":"current/most recent job title","summary":"2-sentence professional summary","skills":["skill1"],"experience":[{"title":"","company":"","duration":"","highlights":["highlight"]}],"education":[{"degree":"","school":"","year":""}],"totalYearsExperience":0}` },
    ]);

    let text = result.response.text().replace(/\x60\x60\x60json\n?/g, "").replace(/\x60\x60\x60\n?/g, "").trim();
    return new Response(text, { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
};

export const config = { path: "/api/parse-resume" };
