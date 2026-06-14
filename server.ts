import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Set up raw base64 body parsers with a high limit (50mb) for scanned PDFs and image files
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini SDK lazily to prevent startup crashes if GEMINI_API_KEY is not defined yet
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required to process handwritten sheets. Please configure it in your Secrets / Env settings.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API endpoint to parse a single page image using Gemini 3.5 Flash
app.post("/api/parse-page", async (req, res) => {
  try {
    const { imageStr, fileName } = req.body;
    if (!imageStr) {
      return res.status(400).json({ error: "No image content provided (imageStr is missing)." });
    }

    let base64Data = imageStr;
    let mimeType = "image/jpeg";

    if (imageStr.startsWith("data:")) {
      const parts = imageStr.split(";base64,");
      mimeType = parts[0].split(":")[1];
      base64Data = parts[1];
    }

    const ai = getAiClient();

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const prompt = `您是一个专业的教务和手工表格分析助手。
请仔细分析并识别这张由老师手写填写的“班级学生作业登记表（查次数、查质量）”。

你需要精确地从图片中识别和提取出以下几个要点：
1. **班级名称 (className)**：通常在顶部的标题，格式如“西联G24紫荆班学生作业登记表”或“西联G25紫荆班学生作业登记表”。请提取出完整的班级名称。
2. **科目名称 (subject)**：在标题下方或旁边的“科目：”之后，包含手写汉字或英文单词。例如：“语文阅读”、“数学”、“英语写作”、“中文写作”、“公民”、“Speaking”、“听力”、“物理”、“化学”、“生物”、“经济”、“历史”等。如果字迹潦草，请结合手写上下文做出最精准的推断，不允许遗漏。
3. **学生作业情况 (students)**：
   分析表格中每一个学生的行。
   - **序号 (index)**：在第一列，应是数字 1, 2, 3...
   - **姓名 (name)**：在第二列，识别手写名字。可能因为写得快略显连笔，请务必还原为字形标准的人名（例如常见的名字字样：付蕾衣、郭锦乔、郭逸良、林隆志、林芷伊、吕雨瑄、沙彤、尚子皓、田栩莎、王虹霁、王真涵、杨镕瑜、张鼎炫、张喻雯、黄锦润、埃多多吉、蔡俊飞、蔡雨轩、陈奕诺等，请特别精准识人名别字）。
   - **实交次数 (submitted)**：通常在小计一列中名为“实交”的方格内。
     - 如果里面的数值是明显的黑墨水或红墨水书写的数字（如 10, 9, 8, 7, 7.5, 6, 5, 4, 3, 2.5, 2, 1, 0.5, 0），请如实提取。
     - 如果里面的数字类似算式如 “5+1” ，代表实际累计提交了 6 次，应直接计算总和并返回对应的数字。
     - 如果学生行被划掉了或用黑笔整行涂改划去，说明该学生不计入此科。
     - 如果有红笔额外修改，以修改后的红笔数值为准。
   - **应交次数 (required)**：通常在小计一列中的“应交”方格内。
     - 注意：有时表格中每个学生的应交格子都没有具体数字，而是被老师用一个贯穿整张表的大括号、大波浪线、或右侧大写字母/红色数字统一写着如“6”或“8”或“10”（表示全班该科目的总次数应交数）。此时，请把这一共同的应交总次数应用并填入列表中的每一个学生里！
   - **备注 (remarks)**：如果在备注列，或者名字/小计里有“免交”、“未交”或请假信息，请计入备注。

请以完美的、符合 JSON schema 的格式返回结果。`;

    console.log(`[Gemini API] Processing page file: ${fileName || "unnamed"} (Mime: ${mimeType}, Size: ${Math.round(base64Data.length * 0.75 / 1024)} KB)`);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [imagePart, prompt],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            className: {
              type: Type.STRING,
              description: "The name of the class, e.g. 西联G24紫荆班, 西联G25紫荆班",
            },
            subject: {
              type: Type.STRING,
              description: "The subject name extracted, e.g. 数学, 语文阅读, Speaking, 英语写作",
            },
            students: {
              type: Type.ARRAY,
              description: "The list of students and their homework score rows detected in this table page",
              items: {
                type: Type.OBJECT,
                properties: {
                  index: {
                    type: Type.INTEGER,
                    description: "The row index number of the student (1, 2, 3...)",
                  },
                  name: {
                    type: Type.STRING,
                    description: "The student name",
                  },
                  submitted: {
                    type: Type.NUMBER,
                    description: "The actual times homework was submitted (实交), parse equations like '5+1' as its sum (6)",
                  },
                  required: {
                    type: Type.NUMBER,
                    description: "The required times homework should be submitted (应交)",
                  },
                  remarks: {
                    type: Type.STRING,
                    description: "Any hand-written notes or status like 免交, 请假, 高考假, etc.",
                  },
                },
                required: ["name"],
              },
            },
          },
          required: ["subject", "students"],
        },
      },
    });

    const resultText = response.text;
    console.log(`[Gemini API] Successfully parsed page. Result length: ${resultText ? resultText.length : 0}`);

    if (!resultText) {
      throw new Error("Empty response from Gemini AI model.");
    }

    const jsonParsed = JSON.parse(resultText);
    res.json(jsonParsed);
  } catch (err: any) {
    console.error("[API Error] Failed to parse page:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// Configure Vite or Serve SPA static files
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}

setupServer();
