import { GoogleGenerativeAI } from "@google/generative-ai";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

export default async (req, context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const { jobTitles, location, remote, level, type, salaryMin, salaryMax, resumeSkills } = await req.json();
    const titlesStr = Array.isArray(jobTitles) ? jobTitles.join(", ") : String(jobTitles);
    const skillsStr = Array.isArray(resumeSkills) ? resumeSkills.slice(0, 10).join(", ") : "";

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Google Search grounding is free on Gemini 2.0 Flash
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      tools: [{ googleSearch: {} }],
    });

    const prompt = `Search Google RIGHT NOW for real, currently open job postings.

Search for ALL of these job titles: ${titlesStr}
Location: ${location || "anywhere / open to remote"}
Work mode: ${remote}, Level: ${level}, Type: ${type}
${salaryMin ? `Salary: $${salaryMin}k – $${salaryMax}k` : ""}
Candidate skills: ${skillsStr}

Find 10 real open positions from LinkedIn, Indeed, Glassdoor, AngelList, and company career pages.
Set "searchTitle" to whichever searched title best matches each job: ${titlesStr}

Return ONLY a valid JSON array, absolutely no markdown, no code fences, no explanation:
[{"id":"1","title":"exact title","searchTitle":"which searched title this matches","company":"name","location":"city, country","salary":"range or null","type":"full-time/contract","remote":"remote/hybrid/on-site","url":"real apply URL","description":"2-sentence description","requirements":["req1","req2","req3"],"matchScore":75,"postedDate":"X days ago","source":"LinkedIn/Indeed/Glassdoor/AngelList/Company"}]`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/\x60\x60\x60json\n?/g, "").replace(/\x60\x60\x60\n?/g, "").trim();

    let parsed;
    try { parsed = JSON.parse(text); }
    catch {
      const m = text.match(/\[[\s\S]*\]/);
      if (m) parsed = JSON.parse(m[0]);
      else throw new Error("Could not parse job results as JSON");
    }

    return new Response(JSON.stringify(parsed), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
};

export const config = { path: "/api/search-jobs" };
