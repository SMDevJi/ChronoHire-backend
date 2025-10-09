import fs from 'fs';
import { extractText, getDocumentProxy } from 'unpdf'
import mammoth from 'mammoth';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);


function cleanJSON(str) {
  // Remove Markdown-style ```json blocks
  let cleaned = str.replace(/```json|```/g, "").trim();

  // Find first { and last } to ensure only JSON remains
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}


// Generate 7 AI questions (5 job-based, 2 resume-based)
export async function generateAIQA(role, description, resumeText, difficulty, yearsOfExperience) {
    try {

        const prompt = `
    You are an AI interview assistant.

    Candidate info:
    - Role: ${role}
    - Description: ${description}
    - Years of Experience: ${yearsOfExperience}
    - Difficulty: ${difficulty}
    - Resume: ${resumeText}

    Task:
    Generate exactly 7 interview questions.  
    - 5 based on the role, description, difficulty, and years of experience.  
    - 2 specifically based on the resume.  

    For each question, also provide a concise, high-quality suggested answer.  

    Respond in **strict JSON format** like this:
    [
      { "question": "Explain event loop in Node.js", "suggestedAns": "The event loop is a mechanism in Node.js..." },
      { "question": "What are common pitfalls in backend dev?", "suggestedAns": "Common pitfalls include..." }
    ]
    `;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        const text = result.text;

        // Try parsing as JSON
        let questions;
        try {
            questions = JSON.parse(text);
        } catch {
            // Fallback if Gemini adds extra text
            const jsonMatch = text.match(/\[([\s\S]*)\]/);
            if (jsonMatch) {
                questions = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("Could not parse Gemini response");
            }
        }

        // Ensure each question is in schema format
        return questions.map(q => ({
            question: q.question || q,
            suggestedAns: q.suggestedAns || "No suggested answer provided"
        }));
    } catch (err) {
        console.error("Gemini question generation failed:", err.message);
    }
}






// Extract resume text (mock version)
export async function extractResumeText(file) {
    const ext = file.substring(file.lastIndexOf('.') + 1)

    if (ext == 'pdf') {
        const buffer = fs.readFileSync(file)
        const pdf = await getDocumentProxy(new Uint8Array(buffer))
        const { text } = await extractText(pdf, { mergePages: true })
        //console.log(text)
        return text;
    } else {
        const data = fs.readFileSync(file);

        const result = await mammoth.extractRawText({ buffer: data });
        //console.log(result.value);
        return result.value
    }

}






// Evaluate answers with AI (mock version)
/**
 * Evaluate all answers in one API call with structured sub-metrics
 * @param {Array} answeredQuestions - [{ _id, question, suggestedAns, transcript }]
 * @returns {Object} { evaluatedQuestions, overallEvaluation, overallScore }
 */
export async function evaluateAnswers(answeredQuestions) {
    try {
        const prompt = `
You are an AI interview evaluator.

Evaluate the candidate's answers.

1. For each question:
   - Give a score (0–100).
   - Provide short constructive feedback.

2. Then give an overall evaluation with these metrics:
   - Content Relevance: { relevant, offTopic } (numbers should add to 100)
   - Grammar & Vocabulary: { correct, minorErrors, majorErrors } (numbers should add to 100)
   - Answer Completeness: { full, partial, missed } (numbers should add to 100)

Return JSON strictly in this format:
{
  "questions": [
    {
      "id": "questionId",
      "score": number,
      "feedback": "string"
    }
  ],
  "overallEvaluation": { 
    "contentRelevance": { "relevant": number, "offTopic": number },
    "grammarVocabulary": { "correct": number, "minorErrors": number, "majorErrors": number },
    "answerCompleteness": { "full": number, "partial": number, "missed": number }
  }
}

Questions:
${answeredQuestions.map((q, i) => `
Q${i + 1}:
id: ${q._id}
question: ${q.question}
suggested answer: ${q.suggestedAns}
candidate answer: ${q.transcript}
`).join("\n")}
`;



        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        const responseText = result.text;

        let parsed;
        try {
            parsed = JSON.parse(cleanJSON(responseText));
        } catch (err) {
            console.error("Failed to parse Gemini JSON:", responseText);
            throw new Error("Gemini response not valid JSON");
        }

        // Attach scores + feedback back to questions
        const evaluatedQuestions = answeredQuestions.map(q => {
            const evalData = parsed.questions.find(e => e.id === q._id.toString());
            return {
                ...q,
                score: evalData?.score ?? 0,
                aiFeedback: evalData?.feedback ?? "No feedback"
            };
        });

        // Compute average score
        const overallScore = Math.round(
            evaluatedQuestions.reduce((sum, q) => sum + q.score, 0) / evaluatedQuestions.length
        );

        return {
            evaluatedQuestions,
            overallEvaluation: parsed.overallEvaluation,
            overallScore
        };

    } catch (error) {
        console.error("Error in evaluateAnswers:", error);
        throw new Error("Evaluation failed");
    }
}
