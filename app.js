require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const OpenAI = require("openai");

const chatGptApiKey = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: chatGptApiKey,
});

const httpServer = http.createServer();

const sentencePromp =
  "Hey chat gpt write me a 7 word sentence about my dog Alex. Make Alex like a fictionaly hero";
const roomId = 1;

const maxNumberOfRound = 1;
const maxNumberOfWrongs = 5;

let players = [];
let sentence = "";
let charactersLeft = {};
let scoreBoard = {};
let changeSentence = false;
let turn = "";
let numberOfWrongs = 0;
let turnNumber = 1;
let round = 1;
let gameOver = false;
let winnerPlayer = {};

// Helper functions
const isCorrectLetter = (sentence, letter) =>
  sentence.toLowerCase().includes(letter.toLowerCase());

const getTurn = (players, turn) => {
  if (turn === players[0]) {
    return players[1];
  }

  return players[0];
};

// get unique characters out of sentence
const getUniqueCharacters = (sentence) => {
  const trimmedSentence = sentence.toLowerCase().split(" ");
  const removeAlexKeyWord = trimmedSentence.filter(
    (word) => !word.includes("alex")
  );
  const uniqueCharacters = new Set(removeAlexKeyWord.join("").split(""));

  uniqueCharacters.delete(".");
  uniqueCharacters.delete(",");
  return uniqueCharacters;
};

const getWinner = () => {
  let winner = "";
  let tie = false;
  const player0 = players[0];
  const player1 = players[1];

  if (scoreBoard[player0] > scoreBoard[player1]) {
    winner = player1;
  } else if (scoreBoard[player0] < scoreBoard[player1]) {
    winner = player0;
  } else {
    tie = true;
  }

  return {
    winner,
    tie,
    [player0]: scoreBoard[player0],
    [player1]: scoreBoard[player1],
    player0: {
      name: player0,
      score: scoreBoard[player0],
    },
    player1: {
      name: player1,
      score: scoreBoard[player1],
    },
  };
};
//-----------------

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    // origin: "https://www.nownidhi.com",
    // origin: "https://alex-game.vercel.app",
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
      sentence = await getChatResponse(sentencePromp);
      charactersLeft = getUniqueCharacters(sentence);
      turn = name;
    }

    io.to(roomId).emit("joined", { players, sentence, turn, numberOfWrongs });
    console.log(`${name} has joined the room`);
    callback({ success: true, data: name });
  });

  socket.on("send_letter", async (data) => {
    console.log("New letter:", data.letter);
    isCorrect = isCorrectLetter(sentence, data.letter);

    if (!isCorrect) {
      numberOfWrongs++;
      if (scoreBoard[data.name]) {
        scoreBoard[data.name] = scoreBoard[data.name] + 1;
      } else {
        scoreBoard = {
          ...scoreBoard,
          [data.name]: 1,
        };
      }

      // change turn if player hits maximum number of wrongs
      if (numberOfWrongs === maxNumberOfWrongs) {
        sentence = await getChatResponse(sentencePromp);
        charactersLeft = getUniqueCharacters(sentence);
        changeSentence = true;
        turn = getTurn(players, turn);
        if (turnNumber % 2 === 0) {
          if (round === maxNumberOfRound) {
            gameOver = true;
          } else {
            round++;
          }
        }
        turnNumber++;
        numberOfWrongs = 0;
      } else {
        changeSentence = false;
      }
    } else {
      if (charactersLeft.has(data.letter)) {
        charactersLeft.delete(data.letter);

        console.log("charactersLeft", charactersLeft);

        if (charactersLeft.size === 0) {
          sentence = await getChatResponse(sentencePromp);
          charactersLeft = getUniqueCharacters(sentence);
          changeSentence = true;
          turn = getTurn(players, turn);
          if (turnNumber % 2 === 0) {
            if (round === maxNumberOfRound) {
              gameOver = true;
            } else {
              round++;
            }
          }
          turnNumber++;
          numberOfWrongs = 0;
        } else {
          changeSentence = false;
        }
      }
    }

    if (gameOver) {
      winnerPlayer = getWinner();
    }

    io.to(roomId).emit("receive_letter", {
      letter: data.letter,
      turn,
      numberOfWrongs,
      isCorrect,
      round,
      changeSentence,
      sentence,
      gameOver,
      winnerPlayer,
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
    charactersLeft = {};
    turn = "";
    numberOfWrongs = 0;
    turnNumber = 1;
    round = 1;
    scoreBoard = {};
    gameOver = false;
    winnerPlayer = {};
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.io server is running on port ${PORT}`);
});
