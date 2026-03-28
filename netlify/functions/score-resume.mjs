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
    const { resume, jobDescription } = await req.json();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(`Analyze how well this candidate matches the job description. Return ONLY valid JSON, no markdown:

CANDIDATE:
Title: ${resume.title}
Skills: ${resume.skills?.join(", ")}
Experience: ${resume.experience?.map(e => `${e.title} at ${e.company} (${e.duration}): ${e.highlights?.slice(0,2).join("; ")}`).join(" | ")}
Education: ${resume.education?.map(e => `${e.degree} from ${e.school}`).join(", ")}
Years: ${resume.totalYearsExperience}

JOB DESCRIPTION:
${jobDescription}

Return this exact JSON structure:
{"score":78,"summary":"2-3 sentence honest assessment","matches":["specific matching skill or experience"],"missing":["specific missing requirement"],"suggestions":["specific actionable suggestion to improve application"]}

Score 0-100. Include 4-6 matches, 3-5 missing items, 3-4 suggestions.`);

    let text = result.response.text().replace(/\x60\x60\x60json\n?/g, "").replace(/\x60\x60\x60\n?/g, "").trim();

    let parsed;
    try { parsed = JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else throw new Error("Could not parse score result");
    }

    return new Response(JSON.stringify(parsed), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
};

export const config = { path: "/api/score-resume" };
