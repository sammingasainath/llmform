
// const openai = new OpenAI({
//     apiKey: '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', // Replace with your actual OpenAI API key
// });

const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: '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' });

// Initialize assistant
let assistant;
let thread;

async function initializeAssistant() {
  assistant = await openai.beta.assistants.create({
    name: "Real Estate Assistant",
    instructions: `You are a helpful real estate assistant located in Visakhapatnam, Andhra Pradesh. Your task is to collect the customer's name, phone number, and the action they want to perform (Buy/Sell/Rent/ToLet) in multiple steps of conversation. Be friendly and professional. Only ask for one piece of information at a time. After collecting each piece of information, confirm it. Once you have collected all three pieces of information, say "Thank you, I have collected all the necessary information. Our conversation will now end. You can use the buttons below for additional actions." and stop the conversation.`,
    model: "gpt-3.5-turbo",
  });

  thread = await openai.beta.threads.create();
}

initializeAssistant();

app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;

  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: userMessage
  });

  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistant.id
  });

  let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

  while (runStatus.status !== 'completed') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
  }

  const messages = await openai.beta.threads.messages.list(thread.id);
  const lastMessage = messages.data[0].content[0].text.value;

  let extractedData = null;

  // Check if all data is collected
  if (lastMessage.includes("I have collected all the necessary information")) {
    // Use GPT-3.5 to extract the data
    const extractionPrompt = `
    Extract the following information from the conversation history:
    1. Customer's name
    2. Customer's phone number
    3. Action the customer wants to perform (Buy/Sell/Rent/ToLet)

    Provide the extracted information in the following JSON format:
    {
      "name": "Customer's name",
      "phone": "Customer's phone number",
      "action": "Action (Buy/Sell/Rent/ToLet)"
    }

    Conversation history:
    ${messages.data.map(msg => `${msg.role}: ${msg.content[0].text.value}`).join('\n')}
    `;

    const extraction = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: extractionPrompt }],
    });

    extractedData = JSON.parse(extraction.choices[0].message.content);
    console.log("Collected customer data:", JSON.stringify(extractedData, null, 2));

    // Create a new thread for the next customer
    thread = await openai.beta.threads.create();
  }

  res.json({ 
    message: lastMessage, 
    dataCollected: extractedData !== null,
    extractedData: extractedData
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});