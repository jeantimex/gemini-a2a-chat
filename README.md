# Gemini A2A Chat Demo: Integrating Google Maps

This project demonstrates a Node.js command-line chat application that integrates Google's Gemini language model with a custom Agent-to-Agent (A2A) server. Specifically, it allows the Gemini model to leverage the capabilities of the [google-maps-a2a-server](https://github.com/jeantimex/google-maps-a2a-server) (or a similar A2A service) to answer questions requiring Google Maps information.

The core concept is using Gemini's "Function Calling" (also known as Tool Use) feature to delegate specific tasks (like getting directions or finding places) to the external A2A service, enabling richer, more context-aware conversations.

## Features

*   **Conversational AI:** Chat interactively with the Gemini model.
*   **Tool Integration:** Seamlessly uses tools provided by a running A2A server.
*   **Google Maps Capabilities:** Can answer questions requiring:
    *   Geocoding (address to coordinates)
    *   Reverse Geocoding (coordinates to address)
    *   Place Search (finding restaurants, shops, etc.)
    *   Place Details
    *   Directions
    *   Distance Matrix
    *   Elevation
*   **Secure API Key Handling:** The Google Maps API key remains securely within the A2A server, not exposed to this chat application or the Gemini model directly.
*   **Dynamic Tool Discovery:** Fetches available tools (skills) from the A2A server's Agent Card at startup.

## Prerequisites

1.  **Node.js:** LTS version recommended.
2.  **npm:** Included with Node.js.
3.  **Google Maps A2A Server:** The separate [google-maps-a2a-server](https://github.com/jeantimex/google-maps-a2a-server) project **must be running** and accessible (by default, on `http://localhost:3000`).
4.  **Google Gemini API Key:** Obtain an API key from [Google AI Studio](https://aistudio.google.com/app/apikey). Ensure the API is enabled for your Google Cloud project.

## Setup & Installation

1.  **Clone or Download:** Get the code for this project. If cloned:
    ```bash
    git clone https://github.com/jeantimex/gemini-a2a-chat.git
    cd gemini-a2a-chat
    ```
    If just using the `chat.js` file, create a directory and place the file inside.

2.  **Install Dependencies:** In the project directory, run:
    ```bash
    npm install
    ```

3.  **Create Environment File:**
    Create a file named `.env` in the root of this project directory.

4.  **Configure API Keys:**
    Add your Gemini API key and the URL for your running A2A server to the `.env` file:
    ```env
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
    A2A_SERVER_URL=http://localhost:3000
    ```
    *   Replace `YOUR_GEMINI_API_KEY_HERE` with your actual key.
    *   Adjust `A2A_SERVER_URL` if your A2A server runs on a different port or host.

    **⚠️ Security Warning:** The `.env` file contains your secret Gemini API key. Ensure this file is included in your `.gitignore` if you commit this project to version control.

## Running the Application

1.  **Start the Google Maps A2A Server:** Make sure your separate `google-maps-a2a-server` is running in its own terminal (`node server.js` in its directory).

2.  **Start the Chat Application:** In the terminal for *this* project (`gemini-a2a-chat`), run:
    ```bash
    node chat.js
    ```

3.  The application will first attempt to fetch the Agent Card from the A2A server to discover available tools.
4.  You will then be prompted to enter your message ("You: ").
5.  Type your questions and press Enter. Type `quit` to exit.

## How It Works: The Technology Behind It

This application orchestrates a conversation between you, the Gemini model, and the A2A server. Here's the flow:

1.  **Initialization:**
    *   The Node.js app starts.
    *   It makes an HTTP `GET` request to the `A2A_SERVER_URL`'s `/.well-known/agent.json` endpoint (Agent Card Discovery).
    *   It parses the `skills` listed in the Agent Card.
    *   These skills are formatted into the `FunctionDeclaration` schema required by the Gemini API.

2.  **Chat Session:**
    *   A chat session is initiated with the Gemini model using the `@google/generative-ai` SDK. The discovered `FunctionDeclaration`s are provided to the model as available `tools`.

3.  **User Interaction:**
    *   You type a message.
    *   The message is sent to the Gemini model via `chat.sendMessage()`.

4.  **Gemini Processing & Function Calling:**
    *   Gemini analyzes your message. Based on its training and the provided function declarations, it decides if:
        *   It can answer directly using its internal knowledge.
        *   It needs to use one of the provided tools (A2A skills) to get necessary information.
    *   If it needs a tool, the Gemini API response *doesn't contain the final text answer*. Instead, it contains a `FunctionCall` object specifying the `name` of the function (skill) to call and the `args` (arguments) extracted from your prompt.

5.  **A2A Server Interaction (if FunctionCall received):**
    *   The Node.js app receives the `FunctionCall`.
    *   It extracts the function name (e.g., `maps_directions`) and arguments (e.g., `{ "origin": "Paris", "destination": "Lyon" }`).
    *   It constructs a standard A2A `tasks/send` request payload (a JSON object).
    *   It makes an HTTP `POST` request to the `A2A_SERVER_URL`'s `/a2a/tasks/send` endpoint using `node-fetch`.
    *   The A2A server receives the request, uses its internal Google Maps API key to call the *actual* Google Maps API, and sends back an A2A Task response (JSON) indicating `status: "completed"` with results in `artifacts`, or `status: "failed"` with an `error`.

6.  **Sending Results Back to Gemini:**
    *   The Node.js app receives the A2A server's response.
    *   It extracts the relevant `result` data (from the artifact) or the `error` message.
    *   It formats this information into a `FunctionResponse` object as required by the Gemini API.
    *   It sends this `FunctionResponse` back to the Gemini model using *another* `chat.sendMessage()` call.

7.  **Final Answer Generation:**
    *   Gemini receives the `FunctionResponse` containing the results from the A2A tool.
    *   It now uses this information to generate the final, user-facing natural language answer.
    *   This final text response is sent back to the Node.js application.

8.  **Display:**
    *   The Node.js app prints the final text response from Gemini to the console.
    *   The loop waits for your next input.

## Usage Examples

Ask questions like:

*   `What are the coordinates for 1 Infinite Loop, Cupertino?`
*   `How do I walk from Buckingham Palace to the British Museum?`
*   `Find me some vegan restaurants near the Brandenburg Gate in Berlin.`
*   `Tell me more about Place ID ChIJPTacEpBQwokRKwIlDXelxkA` (Place ID for Statue of Liberty)
*   `How long does it usually take to drive from London to Manchester?`
*   `What's the elevation of Mount Everest?` (May require specific phrasing for the API)
*   `What is the capital of France?` (Gemini should answer this directly without using a tool)

## Troubleshooting

*   **Error Fetching Agent Card:** Ensure your `google-maps-a2a-server` is running and accessible at the `A2A_SERVER_URL` specified in `.env`. Check for firewall issues.
*   **A2A Task Failed:** Look at the error message printed. It might come from the A2A server itself (e.g., invalid arguments) or directly from the Google Maps API (e.g., API key issues on the *A2A server*, billing not enabled, specific API not enabled in GCP). Check the A2A server's console output for more details.
*   **Gemini API Key Error:** Double-check the `GEMINI_API_KEY` in `.env`. Ensure the Gemini API is enabled in your Google Cloud project.
*   **Gemini Safety Blocks:** If Gemini responds that it can't answer due to safety settings, you might need to adjust the `safetySettings` in `chat.js` or rephrase your prompt.
*   **"Function X is not available"**: This means Gemini tried to call a function name that wasn't in the list provided by the Agent Card. Check the A2A server's `agent.json` and the `formatSkillsForGemini` function.

## Example Chat

1. Ask for place address.
```
Chat with Gemini (type 'quit' to exit)
You: What are the coordinates for the White House?
Sending to Gemini...
Gemini requested function calls: [
  {
    "name": "maps_geocode",
    "args": {
      "address": "1600 Pennsylvania Ave NW, Washington, DC 20500"
    }
  }
]

Calling A2A Server Skill: maps_geocode
A2A Server Response Status: completed

Sending function responses back to Gemini...

Gemini: The coordinates for the White House are approximately 38.8977° N, 77.0365° W.
```

2. Ask for directions.
```
You: Give me walking directions from the Eiffel Tower to the Louvre Museum.
Sending to Gemini...
Gemini requested function calls: [
  {
    "name": "maps_directions",
    "args": {
      "origin": "Eiffel Tower, Paris",
      "destination": "Louvre Museum, Paris",
      "mode": "walking"
    }
  }
]

Calling A2A Server Skill: maps_directions
A2A Server Response Status: completed

Sending function responses back to Gemini...

Gemini: To walk from the Eiffel Tower to the Louvre Museum, it will take approximately 46 minutes and cover a distance of 3.3 km.  The route primarily follows Rue de l'Université.  More detailed, step-by-step instructions are available but too extensive to fully reproduce here.
```

3. Plan a trip to Tokyo!
```
You: plan me a trip to Tokyo for a week, I like eating sushi and ramen.
Sending to Gemini...

Gemini: I cannot create a full travel itinerary for you as I do not have access to real-time information such as flight and accommodation availability, pricing, and your personal preferences beyond your interest in sushi and ramen.  However, I can give you a framework to build your own itinerary:

**Day 1: Arrival and Shinjuku Exploration**

* Arrive at Narita (NRT) or Haneda (HND) airport. Take the Narita Express or Limousine Bus to your hotel in Shinjuku.
* Explore Shinjuku Gyoen National Garden for a relaxing start.
* Enjoy dinner at a ramen restaurant in Shinjuku – many options cater to different tastes and budgets.

**Day 2:  Culture and Trendy Vibes in Shibuya & Harajuku**

* Visit the iconic Shibuya Crossing.
* Explore the trendy shops and cafes in Harajuku, perhaps visiting Takeshita Street.
* Enjoy dinner:  Find a high-quality sushi restaurant in Shibuya or Harajuku.

**Day 3:  Asakusa and Ueno - Traditional Tokyo**

* Explore the historic Asakusa district, including Senso-ji Temple and Nakamise-dori street.
* Visit Ueno Park, home to several museums (Tokyo National Museum, etc.) and Ueno Zoo.
* Dinner: Look for a restaurant in Asakusa or Ueno serving traditional Japanese cuisine.

**Day 4:  Day Trip to Hakone (Optional)**

* Consider a day trip to Hakone, a mountain resort town known for its stunning views of Mount Fuji (weather permitting), hot springs, and art museums.  This will require planning transportation.

**Day 5:  Ginza and Imperial Palace**

* Explore Ginza, Tokyo's upscale shopping district.
* Visit the Imperial Palace East Garden (free entry).
* Dinner: Ginza offers many high-end dining options, including fantastic sushi.

**Day 6:  More Sushi and Ramen!**

* Dedicate this day to exploring different areas and trying more sushi and ramen.  Consider exploring different neighborhoods like Ikebukuro or Akihabara.  You could even take a cooking class!

**Day 7: Departure**

* Depart from Narita (NRT) or Haneda (HND) airport.


**To make this itinerary more concrete:**

* **Book flights and accommodation:** Use online travel agencies or booking sites.
* **Research specific restaurants:** Use Google Maps, TripAdvisor, or other review sites to find highly-rated sushi and ramen places.  Make reservations where possible, especially for dinner.
* **Purchase a Japan Rail Pass:**  If you plan on extensive travel outside of Tokyo, a JR Pass may be cost-effective.  Consider using a Suica or Pasmo card for easier travel on public transport within Tokyo.
* **Plan transportation:** Tokyo has an excellent public transportation system.  Use a navigation app like Google Maps.

Remember to factor in travel time between locations.  This is a flexible framework – adjust it based on your budget, interests, and the time you have available.
```

## License

This project is licensed under the terms of the MIT License.

See the [LICENSE](LICENSE) file for the full license text and permissions.