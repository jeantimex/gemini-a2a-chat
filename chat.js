require('dotenv').config();
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const readline = require('node:readline').createInterface({
    input: process.stdin,
    output: process.stdout,
});
const fetch = require('node-fetch'); // Using node-fetch v2 for require

// --- Configuration ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const A2A_SERVER_URL = process.env.A2A_SERVER_URL || "http://localhost:3000"; // Default if not in .env
const A2A_AGENT_CARD_URL = `${A2A_SERVER_URL}/.well-known/agent.json`;
const A2A_TASKS_SEND_URL = `${A2A_SERVER_URL}/a2a/tasks/send`;

if (!GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY is not set in the .env file.");
    process.exit(1);
}

// --- Helper: Fetch Agent Card ---
async function fetchAgentCard() {
    console.log(`Fetching Agent Card from ${A2A_AGENT_CARD_URL}...`);
    try {
        const response = await fetch(A2A_AGENT_CARD_URL);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status} fetching agent card`);
        }
        const agentCard = await response.json();
        console.log(`Successfully fetched Agent Card. Found ${agentCard?.a2a?.skills?.length || 0} skills.`);
        return agentCard;
    } catch (error) {
        console.error(`Error fetching or parsing Agent Card: ${error}`);
        console.error("Please ensure the A2A server is running and accessible at", A2A_SERVER_URL);
        process.exit(1); // Exit if we can't get capabilities
    }
}

// --- Helper: Format A2A Skills for Gemini ---
function formatSkillsForGemini(skills) {
    if (!skills || !Array.isArray(skills)) {
        return [];
    }
    return skills.map(skill => ({
        name: skill.name,
        description: skill.description,
        // Gemini expects parameters in OpenAPI 3.0 schema format
        // Fortunately, our A2A inputSchema is already designed like this
        parameters: skill.inputSchema
    }));
}

// --- Helper: Call A2A Skill ---
async function callA2aSkill(functionName, args) {
    console.log(`\nCalling A2A Server Skill: ${functionName}`);
    const taskId = `gemini-task-${Date.now()}-${Math.random().toString(16).slice(2)}`; // Simple unique ID
    const payload = {
        taskId: taskId,
        messages: [{
            role: "user", // Representing the user need that triggered the tool
            parts: [{
                dataPart: {
                    mimeType: "application/json",
                    jsonData: {
                        toolName: functionName,
                        arguments: args
                    }
                }
            }]
        }]
    };

    try {
        const response = await fetch(A2A_TASKS_SEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeout: 30000, // 30 second timeout
        });

        if (!response.ok) {
            // Attempt to get error details from A2A server response body
            let errorBody = `HTTP error ${response.status}`;
            try {
                const errorJson = await response.json();
                errorBody = errorJson?.error?.message || JSON.stringify(errorJson) || errorBody;
            } catch (e) { /* Ignore if body isn't JSON */ }
            throw new Error(errorBody);
        }

        const a2aResponse = await response.json();
        console.log(`A2A Server Response Status: ${a2aResponse.status}`);

        if (a2aResponse.status === 'completed') {
            // Extract result from the first artifact's dataPart
            const resultData = a2aResponse.artifacts?.[0]?.parts?.[0]?.dataPart?.jsonData;
            if (resultData === undefined) {
                 console.warn("A2A status completed, but couldn't extract result data from artifact.");
                 return { result: null }; // Return null or empty object for Gemini
            }
            return { result: resultData };
        } else if (a2aResponse.status === 'failed') {
            const errorMessage = a2aResponse.error?.message || "A2A task failed with unknown error";
            console.error(`A2A Task Failed: ${errorMessage}`);
            // Send error back to Gemini so it knows the tool failed
            return { error: errorMessage };
        } else {
            console.error(`A2A Task had unexpected status: ${a2aResponse.status}`);
            return { error: `A2A task had unexpected status: ${a2aResponse.status}` };
        }

    } catch (error) {
        console.error(`Error calling A2A Server Skill ${functionName}: ${error}`);
        // Send error back to Gemini
        return { error: `Failed to execute tool ${functionName}: ${error.message}` };
    }
}

// --- Main Chat Logic ---
async function runChat() {
    const agentCard = await fetchAgentCard();
    const tools = formatSkillsForGemini(agentCard?.a2a?.skills);

    if (tools.length === 0) {
        console.warn("Warning: No tools/skills found from A2A server. Proceeding without tool capabilities.");
    } else {
         console.log("Formatted tools for Gemini:", JSON.stringify(tools, null, 2));
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
        // Use a model that supports function calling
        model: "gemini-1.5-flash-latest", // Or gemini-1.5-pro-latest
        // Define the tools (functions) the model can call
        tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
    });

    const generationConfig = {
        temperature: 0.9, // Adjust creativity
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
    };

    const safetySettings = [ // Adjust safety settings as needed
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    const chat = model.startChat({
        generationConfig,
        safetySettings,
        history: [ // Optional: Start with some history/context
             { role: "user", parts: [{ text: "You are a helpful assistant that can use Google Maps tools via function calls to answer user questions about locations, directions, places, etc."}] },
             { role: "model", parts: [{ text: "Okay, I understand. I can use my available tools to help with map-related questions. How can I assist you today?"}] }
        ],
    });

    console.log("\nChat with Gemini (type 'quit' to exit)");

    async function chatLoop() {
        readline.question("You: ", async (userInput) => {
            if (userInput.toLowerCase() === 'quit') {
                readline.close();
                return;
            }

            try {
                console.log("Sending to Gemini...");
                // Send the user message
                let result = await chat.sendMessage(userInput);

                // Check if Gemini wants to call a function
                let functionCalls = result.response.functionCalls();

                if (functionCalls && functionCalls.length > 0) {
                    console.log("Gemini requested function calls:", JSON.stringify(functionCalls, null, 2));

                    // Call the A2A functions and collect responses
                    const functionResponses = [];
                    for (const call of functionCalls) {
                        const functionName = call.name;
                        const args = call.args;

                        // --- IMPORTANT: Check if the function called is one we declared ---
                        const knownFunction = tools.find(t => t.name === functionName);
                        if (!knownFunction) {
                            console.error(`Error: Gemini called unknown function '${functionName}'`);
                            functionResponses.push({
                                functionResponse: {
                                    name: functionName,
                                    response: { // Gemini expects 'response' object
                                        content: { error: `Function ${functionName} is not available.` }
                                    }
                                }
                            });
                            continue; // Skip calling A2A for unknown function
                        }
                        // ---

                        // Call the A2A server
                        const apiResponse = await callA2aSkill(functionName, args);

                        // Add the API response to the list for Gemini
                        functionResponses.push({
                            functionResponse: {
                                name: functionName,
                                response: { // Gemini expects 'response' object
                                    // Send back the 'result' or 'error' nested under 'content'
                                    content: apiResponse,
                                }
                            }
                        });
                    } // End loop through function calls

                    // Send the function responses back to Gemini
                    console.log("\nSending function responses back to Gemini...");
                    result = await chat.sendMessage(functionResponses);
                    // The final response from Gemini should now incorporate the tool results
                }

                // Display Gemini's final text response (after potential function calls)
                const finalResponseText = result.response.text();
                console.log(`\nGemini: ${finalResponseText}`);

            } catch (error) {
                console.error("\nAn error occurred:", error);
                // Handle potential specific errors, like blocked content
                if (error.message.includes("SAFETY")) {
                     console.error("Gemini Response Blocked due to Safety Settings.");
                }
            } finally {
                // Continue the loop
                chatLoop();
            }
        });
    }

    chatLoop(); // Start the first loop
}

runChat().catch(console.error);