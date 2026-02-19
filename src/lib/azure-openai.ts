import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
      defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2024-06-01" },
      defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY! },
    });
  }
  return client;
}

export interface ChatResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  model: string;
  latencyMs: number;
}

export async function callAzureOpenAI(
  systemPrompt: string,
  userMessage: string
): Promise<ChatResult> {
  const openai = getClient();

  const t0 = Date.now();
  const response = await openai.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });
  const latencyMs = Date.now() - t0;

  const choice = response.choices[0];
  if (!choice?.message?.content) {
    throw new Error("Empty response from Azure OpenAI");
  }

  return {
    content: choice.message.content,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    model: response.model,
    latencyMs,
  };
}
