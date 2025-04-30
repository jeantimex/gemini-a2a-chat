import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import inquirer from 'inquirer';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const A2A_SERVER_URL = process.env.A2A_SERVER_URL || "http://localhost:3000";
const A2A_AGENT_CARD_URL = `${A2A_SERVER_URL}/.well-known/agent.json`;
const A2A_TASKS_SEND_URL = `${A2A_SERVER_URL}/a2a/tasks/send`;

async function fetchAgentCard() {
  const res = await fetch(A2A_AGENT_CARD_URL);
  const card = await res.json();
  return card?.a2a?.skills || [];
}

function formatSkillsForGemini(skills) {
  return skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    parameters: skill.inputSchema,
  }));
}

async function callA2aSkill(name, args) {
  const payload = {
    taskId: `agent-task-${Date.now()}`,
    messages: [
      {
        role: "user",
        parts: [
          {
            dataPart: {
              mimeType: "application/json",
              jsonData: { toolName: name, arguments: args },
            },
          },
        ],
      },
    ],
  };
  const res = await fetch(A2A_TASKS_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  return result?.artifacts?.[0]?.parts?.[0]?.dataPart?.jsonData || {};
}

async function main() {
  const skills = await fetchAgentCard();
  const gemini = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = gemini.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction:
      "You are a travel assistant agent with access to Google Maps tools. Break down user goals, suggest queries, call tools, and reply naturally.",
  });

  const session = model.startChat({
    history: [],
    tools: [{ functionDeclarations: formatSkillsForGemini(skills) }],
  });

  console.log("\n🌍 Travel Planner Agent - Type 'quit' to exit.\n");

  while (true) {
    const answers = await inquirer.prompt({
      type: 'input',
      name: 'input',
      message: 'You:'
    });
    
    const input = answers.input;
    if (input.toLowerCase() === "quit") break;

    let response = await session.sendMessage(input);
    const calls = response.response.functionCalls();

    if (calls?.length) {
      console.log("🔧 Agent is working on your request...");
      const results = [];
      for (const call of calls) {
        const skill = skills.find((s) => s.name === call.name);
        if (!skill) continue;
        const result = await callA2aSkill(call.name, call.args);
        results.push({
          functionResponse: {
            name: call.name,
            response: { content: { result } },
          },
        });
      }
      response = await session.sendMessage(results);
    }
    console.log(`🧭 Agent: ${response.response.text()}`);
  }
}

main().catch(console.error);
