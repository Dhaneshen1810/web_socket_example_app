require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const OpenAI = require("openai");

const chatGptApiKey = process.env.OPENAI_API_KEY;

console.log("test", chatGptApiKey);

const openai = new OpenAI({
  apiKey: chatGptApiKey,
});

const httpServer = http.createServer();

const roomId = 1;

const maxNumberOfWrongs = 5;

let players = [];
let sentence = "";
let turn = "";
let numberOfWrongs = 0;

// Helper functions
const isCorrectLetter = (sentence, letter) =>
  sentence.toLowerCase().includes(letter.toLowerCase());

const getTurn = (players, turn) => {
  if (turn === players[0]) {
    return players[1];
  }

  return players[0];
};
//-----------------

const io = new Server(httpServer, {
  cors: {
    // origin: "http://localhost:3000", // Replace with your frontend URL
    origin: "https://www.nownidhi.com/",
    methods: ["GET", "POST"],
    // allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

async function getChatResponse(prompt) {
  try {
    const params = {
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
    };
    const chatCompletion = await openai.chat.completions.create(params);

    const newSentence = chatCompletion.choices[0].message.content;
    console.log("Response is", newSentence);
    return newSentence;
  } catch (error) {
    console.error("Error fetching chat response:", error);
    return "Error";
  }
}

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  socket.on("join_room", async (name, callback) => {
    socket.join(roomId);

    players.push(name);

    if (sentence === "") {
      const newSentence = await getChatResponse(
        "Hey chat write me a 5 word sentence about my dog Alex. The word Alex should be in it"
      );

      sentence = newSentence;
      turn = name;
    }

    io.to(roomId).emit("joined", { players, sentence, turn, numberOfWrongs });
    console.log(`${name} has joined the room`);
    callback({ success: true, data: name });
  });

  socket.on("send_letter", (data) => {
    console.log("New letter:", data.letter);
    const isCorrect = isCorrectLetter(sentence, data.letter);

    if (!isCorrect) {
      numberOfWrongs++;

      // change turn if player hits maximum number of wrongs
      if (numberOfWrongs === maxNumberOfWrongs) {
        turn = getTurn(players, turn);
        numberOfWrongs = 0;
      }
    }

    io.to(roomId).emit("receive_letter", {
      letter: data.letter,
      turn,
      numberOfWrongs,
      isCorrect,
    });
  });

  socket.on("send_msg", (data) => {
    console.log(data, "DATA");
    //This will send a message to a specific room ID
    socket.to(data.roomId).emit("receive_msg", data);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    players = [];
    sentence = "";
    turn = "";
    numberOfWrongs = 0;
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.io server is running on port ${PORT}`);
});
