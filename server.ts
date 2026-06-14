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

// Initialize Gemini SDK dynamically (allowing custom API key overrides per request)
function getAiClient(customKey?: string): GoogleGenAI {
  const key = customKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY environment variable or a custom API key is required to process handwritten sheets. " +
      "Please enter your custom Gemini API key in the input box at the top of the webpage, or configure GEMINI_API_KEY in Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// API Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API endpoint to parse a single page image using Gemini 3.5 Flash
app.post("/api/parse-page", async (req, res) => {
  try {
    const { imageStr, fileName, customApiKey } = req.body;
    const keyHeader = req.headers["x-gemini-api-key"] as string | undefined;
    const keyToUse = customApiKey || keyHeader;

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

    const ai = getAiClient(keyToUse);

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
2. **科目名称 (subject)**：在标题下方或旁边的“科目：”之后，包含手写汉字或英文单词。
   - **中英文精准识别要点**：科目识别极其重要。如果写的是“英文阅读”或者是“English Reading”，切勿因为思维惯性识别成“中文阅读”！同样，“英文写作”、“English Writing”不能错写成“中文写作”。听到、看到或分析时，必须一字一字仔细核对，保持中英文特征的严格区分。
   - 常见英文科目包含：“Speaking”、“Listening”、“English Reading”、“English Writing”等，中文包含：“中文阅读”、“语文阅读”、“中文写作”、“数学”、“听力”、“听力/Speaking”等。
3. **学生作业情况 (students)**：
   分析表格中每一个学生的行。
   - **序号 (index)**：在第一列，应是数字 1, 2, 3...
   - **姓名 (name)**：在第二列，识别手写名字（例如常见的学生名字字样：付蕾衣、郭锦乔、郭逸良、林隆志、林芷伊、吕雨瑄、沙彤、尚子皓、田栩莎、王虹霁、王真涵、杨镕瑜、张鼎炫、张喻雯、黄锦润、埃多多吉、蔡俊飞、蔡雨轩、陈奕诺等，请特别精准识别名字字形，不要发生标准别字谬误）。
   - **实交次数 (submitted)**：通常在小计一列中名为“实交”的方格内。
     - **特别注意涂改/打叉等涂画修改痕迹**：老师在手写登记表时极易写错并原地划掉。
       - 如果数字表面有划线（一条笔直的横线、双横线斜线）、黑团涂抹、交叉打叉“X”或圆圈抹除，说明这个数字已被废弃，**切勿使用被抹掉的数值**。
       - **请仔细识别被写在被抹去数字旁、上方、或改写的新数字**，这往往是最新修正后的实交次数。
       - 如果数值旁有红色笔迹（或颜色更重、更深新写的数字）代表修改版，请**绝对以红色/修改后的最新数值为准**。
       - 如果数字是算式形式（如“5+1”、“4+2”等），表示老师进行了分次累加，请自动计算其算术总和并作为最终数字返回。
   - **应交次数 (required)**：通常在小计一列中的“应交”方格内。
     - **部分行省略的合并规则**：有些表格在实操中，老师只在其中一行写了应交数字（例如“6”或“8”），代表其他所有同学由于使用相同的教材，其本栏目的应交数量也全都是同一个数据（和这个数字完全一致）。
     - **因此，如果你发现整张登记表的应交列只在某个行写了非零数字（或者其他行留空），请务必把该数字自动复制并继承给本张表格上所有其他所有的同学！不要留空或返回0。**
   - **备注 (remarks)**：包括字写得小的备注或“免交”、“未交”、“请假”、“高考假”等信息。

请以完美的、符合 JSON schema 的格式返回结果。`;

    console.log(`[Gemini API] Processing page file: ${fileName || "unnamed"} (Mime: ${mimeType}, Size: ${Math.round(base64Data.length * 0.75 / 1024)} KB)`);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          imagePart,
          { text: prompt }
        ]
      },
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

    let cleanedText = resultText.trim();
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }

    const jsonParsed = JSON.parse(cleanedText.trim());

    // Auto-fill missing required numbers based on the rule that if only some/one row has a required number, all rows share it
    if (jsonParsed && Array.isArray(jsonParsed.students)) {
      const validRequired = jsonParsed.students
        .map((st: any) => Number(st.required))
        .filter((v: number) => !isNaN(v) && v > 0);
      
      if (validRequired.length > 0) {
        // Find the most frequent or first valid non-zero required value
        const counts: Record<number, number> = {};
        let popularValue = validRequired[0];
        let maxCount = 0;
        for (const val of validRequired) {
          counts[val] = (counts[val] || 0) + 1;
          if (counts[val] > maxCount) {
            maxCount = counts[val];
            popularValue = val;
          }
        }
        
        jsonParsed.students = jsonParsed.students.map((st: any) => {
          const req = Number(st.required);
          if (isNaN(req) || req <= 0) {
            return { ...st, required: popularValue };
          }
          return st;
        });
      }
    }

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
