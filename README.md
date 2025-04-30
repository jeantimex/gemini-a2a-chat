# Gemini A2A Travel Agent: AI-Powered Trip Planning

This project demonstrates how Google's Gemini language model can function as an intelligent travel agent by integrating with a custom Agent-to-Agent (A2A) server. The travel agent leverages the capabilities of the [google-maps-a2a-server](https://github.com/jeantimex/google-maps-a2a-server) to provide context-aware travel recommendations, directions, and location information.

The core concept is using Gemini's "Function Calling" (also known as Tool Use) feature to delegate specific tasks to the external A2A service, enabling richer, more natural conversations about travel planning.

## Agent Capabilities

This project showcases how an AI agent can work effectively by:

1. **Natural Language Understanding:** Processing user queries in everyday language
2. **Autonomous Tool Selection:** Choosing the appropriate Google Maps tool based on user intent
3. **Multi-turn Conversations:** Maintaining context across a conversation
4. **Result Integration:** Combining tool outputs with AI reasoning to provide comprehensive responses
5. **Clear Progress Indicators:** Showing when the agent is working on a request
6. **Domain Specialization:** Focusing on travel-related tasks with specialized knowledge

## Features

*   **Travel Agent Mode:** A specialized agent that demonstrates how AI can act as a travel assistant, helping with trip planning and leveraging Google Maps tools.
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
*   **Secure API Key Handling:** The Google Maps API key remains securely within the A2A server, not exposed to this application or the Gemini model directly.
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

## Running the Travel Agent

1.  **Start the Google Maps A2A Server:** Make sure your separate `google-maps-a2a-server` is running in its own terminal (`node server.js` in its directory).

2.  **Start the Travel Agent:** In the terminal for this project, run:
    ```bash
    node travel-agent.js
    ```

3.  The application will first attempt to fetch the Agent Card from the A2A server to discover available tools.
4.  You will then be prompted to enter your message ("You: ").
5.  Type your travel questions and press Enter. Type `quit` to exit.

The travel agent provides a focused experience for travel planning:
- It uses a travel-specific system prompt
- Shows clear indicators when it's using A2A skills
- Optimized for trip planning and travel recommendations
- Maintains conversation context for multi-turn travel discussions

## Travel Agent Example

Here's an example of how the travel agent uses A2A skills:

```
🌍 Travel Planner Agent - Type 'quit' to exit.

You: I'm planning a trip to San Francisco. What are some must-visit places?
Sending to Gemini...
🔧 Agent is working on your request...
📍 Using A2A skill: maps_places_search
📝 With arguments: {"query":"tourist attractions in San Francisco","type":"tourist_attraction"}
✅ Skill result received: {"results":[{"name":"Golden Gate Bridge","rating":4.8,"vicinity":"San Francisco, CA"},{"name":"Alcatraz Island","rating":4.7,"vicinity":"San Francisco, CA"},{"name":"Fisherman's Wharf","rating":4.5,"vicinity":"Beach Street & The Embarcadero"}]}

🧭 Agent: San Francisco has many amazing places to visit! Here are some must-see attractions:

1. **Golden Gate Bridge** (Rating: 4.8/5) - The iconic suspension bridge connecting San Francisco to Marin County. You can walk or bike across for stunning views of the city and bay.

2. **Alcatraz Island** (Rating: 4.7/5) - The famous former federal prison in the middle of San Francisco Bay. Take a ferry tour to explore the historic site.

3. **Fisherman's Wharf** (Rating: 4.5/5) - A popular waterfront area with restaurants, shops, sea lion viewing, and access to boat tours.

Other places worth visiting include:
- Lombard Street (the "crookedest street")
- Chinatown
- Golden Gate Park
- Union Square
- Painted Ladies (Victorian houses)
- Twin Peaks for panoramic views

Would you like specific recommendations for restaurants, hotels, or transportation options while you're in San Francisco?
```

This example shows how the travel agent:
1. Understands the travel query
2. Automatically selects the appropriate Google Maps tool
3. Provides visual feedback about which skill is being used
4. Integrates the tool results with additional knowledge
5. Offers a natural follow-up to continue the conversation

## How It Works: The Technology Behind It

This application orchestrates a conversation between you, the Gemini model, and the A2A server. Here's the flow:

1.  **Initialization:**
    *   The Node.js app starts.
    *   It makes an HTTP `GET` request to the `A2A_SERVER_URL`'s `/.well-known/agent.json` endpoint (Agent Card Discovery).
    *   It parses the `skills` listed in the Agent Card.
    *   These skills are formatted into the `FunctionDeclaration` schema required by the Gemini API.

2.  **Chat Session:**
    *   The app initializes a Gemini chat session with the available tools.
    *   You enter a message.
    *   The app sends your message to the Gemini API.

3.  **Gemini Processing:**
    *   Gemini processes your message and determines if it needs to use any of the declared tools.
    *   If it can answer directly, it returns a text response.

4.  **Tool Calling (if needed):**
    *   If it needs a tool, the Gemini API response *doesn't contain the final text answer*. Instead, it contains a `FunctionCall` object specifying the `name` of the function (skill) to call and the `args` (arguments) extracted from your prompt.

5.  **A2A Server Interaction (if FunctionCall received):**
    *   The Node.js app receives the `FunctionCall`.
    *   It extracts the function name (e.g., `maps_directions`) and arguments (e.g., `{ "origin": "Paris", "destination": "Lyon" }`).
    *   It creates a task for the A2A server in the required format.
    *   It sends an HTTP `POST` request to the A2A server's `/a2a/tasks/send` endpoint.

6.  **A2A Server Processing:**
    *   The A2A server receives the task.
    *   It processes the task using the appropriate Google Maps API.
    *   It returns the result in a standardized format.

7.  **Gemini Final Response:**
    *   The Node.js app receives the A2A server's response.
    *   It formats this response as a `FunctionResponse` for Gemini.
    *   It sends this `FunctionResponse` back to the Gemini API.
    *   Gemini now has the information it needed from the tool.
    *   It now uses this information to generate the final, user-facing natural language answer.
    *   This final text response is sent back to the Node.js application.

8.  **Display:**
    *   The Node.js app prints the final text response from Gemini to the console.
    *   The loop waits for your next input.

## Basic Chat Mode

For a simpler demonstration of the A2A integration without the full travel agent experience, you can use the basic chat mode:

```bash
node chat.js
```

This mode provides a more generic chat interface that still connects to the A2A server but without the travel-specific optimizations and visual feedback of the travel agent mode.

## Usage Examples

Ask questions like:

*   `What are the coordinates for 1 Infinite Loop, Cupertino?`
*   `What's the address at 37.7749, -122.4194?`
*   `Find me coffee shops near the Empire State Building`
*   `How do I get from Central Park to Times Square by walking?`
*   `What's the distance between San Francisco and Los Angeles?`
*   `What's the elevation of Mount Everest?`
*   `Plan me a trip to Tokyo for a week, I like eating sushi and ramen.`

## Troubleshooting

*   **Connection Errors:** Ensure the A2A server is running and accessible at the URL specified in your `.env` file.
*   **Gemini API Key Issues:** Verify your API key is correct and the API is enabled for your Google Cloud project.
*   **Gemini Safety Blocks:** If Gemini responds that it can't answer due to safety settings, you might need to adjust the `safetySettings` in `chat.js` or rephrase your prompt.
*   **"Function X is not available"**: This means Gemini tried to call a function name that wasn't in the list provided by the Agent Card. Check the A2A server's `agent.json` and the `formatSkillsForGemini` function.

## Example Chat

1. Ask for coordinates.
```
You: What are the coordinates of the White House?
Sending to Gemini...
Gemini requested function calls: [
  {
    "name": "maps_geocode",
    "args": {
      "address": "White House, Washington DC"
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