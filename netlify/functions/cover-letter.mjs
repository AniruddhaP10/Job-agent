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
    const { job, resume } = await req.json();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(`Write a compelling, tailored cover letter. No generic AI phrases.

CANDIDATE:
Name: ${resume.name}
Title: ${resume.title}
Summary: ${resume.summary}
Skills: ${resume.skills?.slice(0, 8).join(", ")}
Recent role: ${resume.experience?.[0]?.title} at ${resume.experience?.[0]?.company}
Achievements: ${resume.experience?.[0]?.highlights?.slice(0, 2).join("; ")}

JOB:
Title: ${job.title} at ${job.company} (${job.location}, ${job.remote})
Description: ${job.description}
Requirements: ${job.requirements?.join(", ")}

Write exactly 3 paragraphs. Para 1: hook mentioning company + role specifically. Para 2: connect candidate experience to requirements. Para 3: brief, confident close.
Start with "Dear Hiring Manager," and end with the candidate's name. Plain text only, no markdown.`);

    const text = result.response.text();
    return new Response(JSON.stringify({ text }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
};

export const config = { path: "/api/cover-letter" };
