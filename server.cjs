var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
function getAiClient(customKey) {
  const key = customKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY environment variable or a custom API key is required to process handwritten sheets. Please enter your custom Gemini API key in the input box at the top of the webpage, or configure GEMINI_API_KEY in Secrets."
    );
  }
  return new import_genai.GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
});
app.post("/api/parse-page", async (req, res) => {
  try {
    const { imageStr, fileName, customApiKey } = req.body;
    const keyHeader = req.headers["x-gemini-api-key"];
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
        mimeType
      }
    };
    const prompt = `\u60A8\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u6559\u52A1\u548C\u624B\u5DE5\u8868\u683C\u5206\u6790\u52A9\u624B\u3002
\u8BF7\u4ED4\u7EC6\u5206\u6790\u5E76\u8BC6\u522B\u8FD9\u5F20\u7531\u8001\u5E08\u624B\u5199\u586B\u5199\u7684\u201C\u73ED\u7EA7\u5B66\u751F\u4F5C\u4E1A\u767B\u8BB0\u8868\uFF08\u67E5\u6B21\u6570\u3001\u67E5\u8D28\u91CF\uFF09\u201D\u3002

\u4F60\u9700\u8981\u7CBE\u786E\u5730\u4ECE\u56FE\u7247\u4E2D\u8BC6\u522B\u548C\u63D0\u53D6\u51FA\u4EE5\u4E0B\u51E0\u4E2A\u8981\u70B9\uFF1A
1. **\u73ED\u7EA7\u540D\u79F0 (className)**\uFF1A\u901A\u5E38\u5728\u9876\u90E8\u7684\u6807\u9898\uFF0C\u683C\u5F0F\u5982\u201C\u897F\u8054G24\u7D2B\u8346\u73ED\u5B66\u751F\u4F5C\u4E1A\u767B\u8BB0\u8868\u201D\u6216\u201C\u897F\u8054G25\u7D2B\u8346\u73ED\u5B66\u751F\u4F5C\u4E1A\u767B\u8BB0\u8868\u201D\u3002\u8BF7\u63D0\u53D6\u51FA\u5B8C\u6574\u7684\u73ED\u7EA7\u540D\u79F0\u3002
2. **\u79D1\u76EE\u540D\u79F0 (subject)**\uFF1A\u5728\u6807\u9898\u4E0B\u65B9\u6216\u65C1\u8FB9\u7684\u201C\u79D1\u76EE\uFF1A\u201D\u4E4B\u540E\uFF0C\u5305\u542B\u624B\u5199\u6C49\u5B57\u6216\u82F1\u6587\u5355\u8BCD\u3002
   - **\u4E2D\u82F1\u6587\u7CBE\u51C6\u8BC6\u522B\u8981\u70B9**\uFF1A\u79D1\u76EE\u8BC6\u522B\u6781\u5176\u91CD\u8981\u3002\u5982\u679C\u5199\u7684\u662F\u201C\u82F1\u6587\u9605\u8BFB\u201D\u6216\u8005\u662F\u201CEnglish Reading\u201D\uFF0C\u5207\u52FF\u56E0\u4E3A\u601D\u7EF4\u60EF\u6027\u8BC6\u522B\u6210\u201C\u4E2D\u6587\u9605\u8BFB\u201D\uFF01\u540C\u6837\uFF0C\u201C\u82F1\u6587\u5199\u4F5C\u201D\u3001\u201CEnglish Writing\u201D\u4E0D\u80FD\u9519\u5199\u6210\u201C\u4E2D\u6587\u5199\u4F5C\u201D\u3002\u542C\u5230\u3001\u770B\u5230\u6216\u5206\u6790\u65F6\uFF0C\u5FC5\u987B\u4E00\u5B57\u4E00\u5B57\u4ED4\u7EC6\u6838\u5BF9\uFF0C\u4FDD\u6301\u4E2D\u82F1\u6587\u7279\u5F81\u7684\u4E25\u683C\u533A\u5206\u3002
   - \u5E38\u89C1\u82F1\u6587\u79D1\u76EE\u5305\u542B\uFF1A\u201CSpeaking\u201D\u3001\u201CListening\u201D\u3001\u201CEnglish Reading\u201D\u3001\u201CEnglish Writing\u201D\u7B49\uFF0C\u4E2D\u6587\u5305\u542B\uFF1A\u201C\u4E2D\u6587\u9605\u8BFB\u201D\u3001\u201C\u8BED\u6587\u9605\u8BFB\u201D\u3001\u201C\u4E2D\u6587\u5199\u4F5C\u201D\u3001\u201C\u6570\u5B66\u201D\u3001\u201C\u542C\u529B\u201D\u3001\u201C\u542C\u529B/Speaking\u201D\u7B49\u3002
3. **\u5B66\u751F\u4F5C\u4E1A\u60C5\u51B5 (students)**\uFF1A
   \u5206\u6790\u8868\u683C\u4E2D\u6BCF\u4E00\u4E2A\u5B66\u751F\u7684\u884C\u3002
   - **\u5E8F\u53F7 (index)**\uFF1A\u5728\u7B2C\u4E00\u5217\uFF0C\u5E94\u662F\u6570\u5B57 1, 2, 3...
   - **\u59D3\u540D (name)**\uFF1A\u5728\u7B2C\u4E8C\u5217\uFF0C\u8BC6\u522B\u624B\u5199\u540D\u5B57\uFF08\u4F8B\u5982\u5E38\u89C1\u7684\u5B66\u751F\u540D\u5B57\u5B57\u6837\uFF1A\u4ED8\u857E\u8863\u3001\u90ED\u9526\u4E54\u3001\u90ED\u9038\u826F\u3001\u6797\u9686\u5FD7\u3001\u6797\u82B7\u4F0A\u3001\u5415\u96E8\u7444\u3001\u6C99\u5F64\u3001\u5C1A\u5B50\u7693\u3001\u7530\u6829\u838E\u3001\u738B\u8679\u9701\u3001\u738B\u771F\u6DB5\u3001\u6768\u9555\u745C\u3001\u5F20\u9F0E\u70AB\u3001\u5F20\u55BB\u96EF\u3001\u9EC4\u9526\u6DA6\u3001\u57C3\u591A\u591A\u5409\u3001\u8521\u4FCA\u98DE\u3001\u8521\u96E8\u8F69\u3001\u9648\u5955\u8BFA\u7B49\uFF0C\u8BF7\u7279\u522B\u7CBE\u51C6\u8BC6\u522B\u540D\u5B57\u5B57\u5F62\uFF0C\u4E0D\u8981\u53D1\u751F\u6807\u51C6\u522B\u5B57\u8C2C\u8BEF\uFF09\u3002
   - **\u5B9E\u4EA4\u6B21\u6570 (submitted)**\uFF1A\u901A\u5E38\u5728\u5C0F\u8BA1\u4E00\u5217\u4E2D\u540D\u4E3A\u201C\u5B9E\u4EA4\u201D\u7684\u65B9\u683C\u5185\u3002
     - **\u7279\u522B\u6CE8\u610F\u6D82\u6539/\u6253\u53C9\u7B49\u6D82\u753B\u4FEE\u6539\u75D5\u8FF9**\uFF1A\u8001\u5E08\u5728\u624B\u5199\u767B\u8BB0\u8868\u65F6\u6781\u6613\u5199\u9519\u5E76\u539F\u5730\u5212\u6389\u3002
       - \u5982\u679C\u6570\u5B57\u8868\u9762\u6709\u5212\u7EBF\uFF08\u4E00\u6761\u7B14\u76F4\u7684\u6A2A\u7EBF\u3001\u53CC\u6A2A\u7EBF\u659C\u7EBF\uFF09\u3001\u9ED1\u56E2\u6D82\u62B9\u3001\u4EA4\u53C9\u6253\u53C9\u201CX\u201D\u6216\u5706\u5708\u62B9\u9664\uFF0C\u8BF4\u660E\u8FD9\u4E2A\u6570\u5B57\u5DF2\u88AB\u5E9F\u5F03\uFF0C**\u5207\u52FF\u4F7F\u7528\u88AB\u62B9\u6389\u7684\u6570\u503C**\u3002
       - **\u8BF7\u4ED4\u7EC6\u8BC6\u522B\u88AB\u5199\u5728\u88AB\u62B9\u53BB\u6570\u5B57\u65C1\u3001\u4E0A\u65B9\u3001\u6216\u6539\u5199\u7684\u65B0\u6570\u5B57**\uFF0C\u8FD9\u5F80\u5F80\u662F\u6700\u65B0\u4FEE\u6B63\u540E\u7684\u5B9E\u4EA4\u6B21\u6570\u3002
       - \u5982\u679C\u6570\u503C\u65C1\u6709\u7EA2\u8272\u7B14\u8FF9\uFF08\u6216\u989C\u8272\u66F4\u91CD\u3001\u66F4\u6DF1\u65B0\u5199\u7684\u6570\u5B57\uFF09\u4EE3\u8868\u4FEE\u6539\u7248\uFF0C\u8BF7**\u7EDD\u5BF9\u4EE5\u7EA2\u8272/\u4FEE\u6539\u540E\u7684\u6700\u65B0\u6570\u503C\u4E3A\u51C6**\u3002
       - \u5982\u679C\u6570\u5B57\u662F\u7B97\u5F0F\u5F62\u5F0F\uFF08\u5982\u201C5+1\u201D\u3001\u201C4+2\u201D\u7B49\uFF09\uFF0C\u8868\u793A\u8001\u5E08\u8FDB\u884C\u4E86\u5206\u6B21\u7D2F\u52A0\uFF0C\u8BF7\u81EA\u52A8\u8BA1\u7B97\u5176\u7B97\u672F\u603B\u548C\u5E76\u4F5C\u4E3A\u6700\u7EC8\u6570\u5B57\u8FD4\u56DE\u3002
   - **\u5E94\u4EA4\u6B21\u6570 (required)**\uFF1A\u901A\u5E38\u5728\u5C0F\u8BA1\u4E00\u5217\u4E2D\u7684\u201C\u5E94\u4EA4\u201D\u65B9\u683C\u5185\u3002
     - **\u90E8\u5206\u884C\u7701\u7565\u7684\u5408\u5E76\u89C4\u5219**\uFF1A\u6709\u4E9B\u8868\u683C\u5728\u5B9E\u64CD\u4E2D\uFF0C\u8001\u5E08\u53EA\u5728\u5176\u4E2D\u4E00\u884C\u5199\u4E86\u5E94\u4EA4\u6570\u5B57\uFF08\u4F8B\u5982\u201C6\u201D\u6216\u201C8\u201D\uFF09\uFF0C\u4EE3\u8868\u5176\u4ED6\u6240\u6709\u540C\u5B66\u7531\u4E8E\u4F7F\u7528\u76F8\u540C\u7684\u6559\u6750\uFF0C\u5176\u672C\u680F\u76EE\u7684\u5E94\u4EA4\u6570\u91CF\u4E5F\u5168\u90FD\u662F\u540C\u4E00\u4E2A\u6570\u636E\uFF08\u548C\u8FD9\u4E2A\u6570\u5B57\u5B8C\u5168\u4E00\u81F4\uFF09\u3002
     - **\u56E0\u6B64\uFF0C\u5982\u679C\u4F60\u53D1\u73B0\u6574\u5F20\u767B\u8BB0\u8868\u7684\u5E94\u4EA4\u5217\u53EA\u5728\u67D0\u4E2A\u884C\u5199\u4E86\u975E\u96F6\u6570\u5B57\uFF08\u6216\u8005\u5176\u4ED6\u884C\u7559\u7A7A\uFF09\uFF0C\u8BF7\u52A1\u5FC5\u628A\u8BE5\u6570\u5B57\u81EA\u52A8\u590D\u5236\u5E76\u7EE7\u627F\u7ED9\u672C\u5F20\u8868\u683C\u4E0A\u6240\u6709\u5176\u4ED6\u6240\u6709\u7684\u540C\u5B66\uFF01\u4E0D\u8981\u7559\u7A7A\u6216\u8FD4\u56DE0\u3002**
   - **\u5907\u6CE8 (remarks)**\uFF1A\u5305\u62EC\u5B57\u5199\u5F97\u5C0F\u7684\u5907\u6CE8\u6216\u201C\u514D\u4EA4\u201D\u3001\u201C\u672A\u4EA4\u201D\u3001\u201C\u8BF7\u5047\u201D\u3001\u201C\u9AD8\u8003\u5047\u201D\u7B49\u4FE1\u606F\u3002

\u8BF7\u4EE5\u5B8C\u7F8E\u7684\u3001\u7B26\u5408 JSON schema \u7684\u683C\u5F0F\u8FD4\u56DE\u7ED3\u679C\u3002`;
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
          type: import_genai.Type.OBJECT,
          properties: {
            className: {
              type: import_genai.Type.STRING,
              description: "The name of the class, e.g. \u897F\u8054G24\u7D2B\u8346\u73ED, \u897F\u8054G25\u7D2B\u8346\u73ED"
            },
            subject: {
              type: import_genai.Type.STRING,
              description: "The subject name extracted, e.g. \u6570\u5B66, \u8BED\u6587\u9605\u8BFB, Speaking, \u82F1\u8BED\u5199\u4F5C"
            },
            students: {
              type: import_genai.Type.ARRAY,
              description: "The list of students and their homework score rows detected in this table page",
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  index: {
                    type: import_genai.Type.INTEGER,
                    description: "The row index number of the student (1, 2, 3...)"
                  },
                  name: {
                    type: import_genai.Type.STRING,
                    description: "The student name"
                  },
                  submitted: {
                    type: import_genai.Type.NUMBER,
                    description: "The actual times homework was submitted (\u5B9E\u4EA4), parse equations like '5+1' as its sum (6)"
                  },
                  required: {
                    type: import_genai.Type.NUMBER,
                    description: "The required times homework should be submitted (\u5E94\u4EA4)"
                  },
                  remarks: {
                    type: import_genai.Type.STRING,
                    description: "Any hand-written notes or status like \u514D\u4EA4, \u8BF7\u5047, \u9AD8\u8003\u5047, etc."
                  }
                },
                required: ["name"]
              }
            }
          },
          required: ["subject", "students"]
        }
      }
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
    if (jsonParsed && Array.isArray(jsonParsed.students)) {
      const validRequired = jsonParsed.students.map((st) => Number(st.required)).filter((v) => !isNaN(v) && v > 0);
      if (validRequired.length > 0) {
        const counts = {};
        let popularValue = validRequired[0];
        let maxCount = 0;
        for (const val of validRequired) {
          counts[val] = (counts[val] || 0) + 1;
          if (counts[val] > maxCount) {
            maxCount = counts[val];
            popularValue = val;
          }
        }
        jsonParsed.students = jsonParsed.students.map((st) => {
          const req2 = Number(st.required);
          if (isNaN(req2) || req2 <= 0) {
            return { ...st, required: popularValue };
          }
          return st;
        });
      }
    }
    res.json(jsonParsed);
  } catch (err) {
    console.error("[API Error] Failed to parse page:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}
setupServer();
//# sourceMappingURL=server.cjs.map
