import { GoogleGenAI, Type, GenerateContentResponse, GroundingChunk } from "@google/genai";
import { AgentRole, ResearchPlan } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'gemini-2.5-flash';

// Agent 1: Planner
export const runPlannerAgent = async (topic: string, onStream: (chunk: string) => void): Promise<ResearchPlan> => {
    const systemInstruction = `You are an expert research planner. Your goal is to break down a complex topic into a series of simple, sequential research questions.
You must also state any assumptions you are making about the user's query.
The user wants to understand: "${topic}".
Generate a JSON object with two keys: "plan" (an array of strings, where each string is a research step) and "assumptions" (a string explaining your assumptions).
Keep the research steps concise and focused. Aim for 3-5 steps.`;

    const response = await ai.models.generateContent({
        model,
        contents: `Create a research plan for the topic: "${topic}"`,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    plan: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "A list of research questions to investigate.",
                    },
                    assumptions: {
                        type: Type.STRING,
                        description: "Assumptions made about the user's request.",
                    },
                },
                required: ["plan", "assumptions"],
            },
        },
    });

    const text = response.text;
    onStream(text); // For visual feedback
    return JSON.parse(text) as ResearchPlan;
};

// Agent 2: Researcher
export const runResearcherAgent = async (query: string, onStream: (chunk: string) => void): Promise<{ summary: string, sources: GroundingChunk[] }> => {
    const systemInstruction = `You are a diligent AI researcher. Your task is to investigate a specific query using Google Search and provide a concise summary of the findings.
Your summary should be factual, to the point, and directly answer the query. Do not add any conversational fluff.
The summary should be 2-3 paragraphs long.`;
    
    const responseStream = await ai.models.generateContentStream({
        model,
        contents: `Research this query: "${query}"`,
        config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
        },
    });

    let summary = "";
    const sources: GroundingChunk[] = [];
    const sourceUris = new Set<string>();

    for await (const chunk of responseStream) {
        summary += chunk.text;
        onStream(chunk.text);

        const chunkSources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunkSources) {
            for (const source of chunkSources) {
                if (source.web?.uri && !sourceUris.has(source.web.uri)) {
                    sources.push(source);
                    sourceUris.add(source.web.uri);
                }
            }
        }
    }
    
    return { summary: summary.trim(), sources };
};

// Agent 3: Writer
export const runWriterAgent = async (topic: string, researchData: string[], onStream: (chunk: string) => void): Promise<string> => {
    const systemInstruction = `You are a professional report writer. Your task is to synthesize the provided research findings into a well-structured, comprehensive, and easy-to-read report.
The report should have a clear introduction, body, and conclusion. Use markdown for formatting (e.g., # for titles, ## for headings, * for bullet points).
Do not mention the research process itself. Focus solely on presenting the information clearly.`;

    const researchContext = researchData.map((data, index) => `Finding ${index + 1}:\n${data}`).join('\n\n---\n\n');

    const responseStream = await ai.models.generateContentStream({
        model,
        contents: `Topic: ${topic}\n\nResearch Findings:\n${researchContext}\n\nWrite the final report based on these findings.`,
        config: {
            systemInstruction,
        },
    });

    let report = "";
    for await (const chunk of responseStream) {
        report += chunk.text;
        onStream(chunk.text);
    }

    return report.trim();
};


// Agent 4: Reviewer
export const runReviewerAgent = async (report: string, onStream: (chunk: string) => void): Promise<string> => {
    const systemInstruction = `You are a critical reviewer. Your task is to read the provided report and offer constructive criticism. 
    Focus on clarity, factual accuracy, and coherence. Provide a short, bulleted list of suggestions for improvement.
    If the report is excellent, state that it is ready for publication.`;
    
    const responseStream = await ai.models.generateContentStream({
        model,
        contents: `Please review the following report:\n\n---\n\n${report}`,
        config: {
            systemInstruction,
            thinkingConfig: { thinkingBudget: 0 } // Faster response for review
        }
    });

    let review = "";
    for await (const chunk of responseStream) {
        review += chunk.text;
        onStream(chunk.text);
    }
    
    return review.trim();
}