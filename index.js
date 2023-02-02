const acorn = require("acorn");
const fs = require("fs");
const undici = require("undici");

// Support env vars in .env
require("dotenv").config();
if(!process.env.OPENAI_TOKEN) {
    console.error('Must set the OPENAI_TOKEN env var');
    process.exit(1)
}

// Given a file, parse out all the comments containing AI prompts
function parse(file) {
  const comments = [];
  acorn.parse(file, {
    ecmaVersion: 2022,
    onComment: function (block, text, start, end) {
      const isAI = text.trim().startsWith("AI: ");
      if (!isAI) {
        return;
      }
      const prompt = text.trim().substring(3).trim();
      comments.push({ prompt, start, end });
    },
  });
  return comments;
}

// Take a comment prompt and pass it through OpenAI
async function ai(comment) {
  const { prompt } = comment;
  const OPENAI_URL = "https://api.openai.com/v1";

  const response = await undici.request(`${OPENAI_URL}/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_TOKEN}`,
    },
    body: JSON.stringify({
      model: "text-davinci-003",
      temperature: 0,
      n: 1,
      max_tokens: 500,
      prompt,
    }),
  });
  const { statusCode, body } = response;
  if (statusCode !== 200) {
    console.error("sadness");
    process.exit(1);
  }
  const completion = await body.json();
  return {
    ...comment,
    completion: completion.choices[0].text.trim(),
  };
}

// Run the program
async function main(path) {
  let file = fs.readFileSync(path, "utf-8");
  const comment = parse(file)[0];
  if (!comment) {
    console.log("No comments found");
    return;
  }
  const response = await ai(comment);
  const { start, end, completion, prompt } = response;
  const prefix = file.slice(0, start);
  const suffix = file.slice(end);
  file = prefix + completion + suffix;
  fs.writeFileSync(path, file, "utf-8");
  console.log("Updated file");
}

const path = process.argv[2];
console.log(`Running on ${path}`);
if (path) {
  main(path);
}
