import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Plus,
  Search,
  Loader2,
  ChevronRight,
  Sparkles,
  RefreshCw,
  FileDown,
  Eye,
  BookOpen,
  Info,
  Layers,
  ArrowRight,
  UserCheck,
  Edit3,
  Undo2,
  Key
} from "lucide-react";
import * as XLSX from "xlsx";
import { PageItem, ConsolidatedStudent } from "./types";
import { sampleClassData } from "./sampleData";

export default function App() {
  // --- States ---
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"master" | "calibration" | "roster">("master");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isRenderingPdf, setIsRenderingPdf] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  
  // --- Fuzzy Name Roster States ---
  const [customRoster, setCustomRoster] = useState<Record<number, string>>({});
  const [enableFuzzyAlignment, setEnableFuzzyAlignment] = useState(true);
  const [editingRosterIndex, setEditingRosterIndex] = useState<number | null>(null);
  const [editingRosterValue, setEditingRosterValue] = useState("");
  
  // Custom API key state from localStorage
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem("custom_gemini_api_key") || "";
  });

  const handleApiKeyChange = (val: string) => {
    const trimmed = val.trim();
    setCustomApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem("custom_gemini_api_key", trimmed);
    } else {
      localStorage.removeItem("custom_gemini_api_key");
    }
  };

  // Custom manual insertions
  const [showAddStudentField, setShowAddStudentField] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [showAddSubjectField, setShowAddSubjectField] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Dynamic Injection of PDF.js CDN ---
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  useEffect(() => {
    if ((window as any).pdfjsLib) {
      setPdfjsLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        setPdfjsLoaded(true);
      }
    };
    document.body.appendChild(script);
  }, []);

  // Show a temporary notification
  const triggerNotification = (type: "success" | "error" | "info", text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(prev => prev?.text === text ? null : prev);
    }, 4000);
  };

  // Load the beautiful preloaded sample datasets
  const handleLoadSample = () => {
    setPages(sampleClassData);
    setSelectedPageId(sampleClassData[0].id);
    setActiveTab("master");
    triggerNotification("success", "已成功加载西联G24紫荆班4门科目(语文阅读、英文写作、数学、听力)的示例手写数据！");
  };

  // Clear workspace
  const handleClearAll = () => {
    if (window.confirm("确定要清空当前的全部上传文件和统计数据吗？")) {
      setPages([]);
      setSelectedPageId(null);
      setActiveTab("master");
      triggerNotification("info", "工作区已重置。");
    }
  };

  // --- PDF & Image Upload Processing ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processUploadedFiles(Array.from(files));
  };

  const processUploadedFiles = async (fileList: File[]) => {
    setIsRenderingPdf(true);
    const newItems: PageItem[] = [];

    for (const file of fileList) {
      const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");

      if (isPdf) {
        try {
          if (!pdfjsLoaded) {
            triggerNotification("info", "PDF 引擎正在加载，请稍候...");
            // wait brief moment for library
            await new Promise(r => setTimeout(r, 1000));
          }

          const arrayBuffer = await file.arrayBuffer();
          const pdfjsLib = (window as any).pdfjsLib;
          if (!pdfjsLib) {
            throw new Error("PDF 库加载失败，请检查网络连接或稍后重试。");
          }

          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const numPages = pdf.numPages;

          triggerNotification("info", `开始渲染 PDF 文件 （共 ${numPages} 页）...`);

          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 }); // Good scale for OCR text crispness
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (context) {
              await page.render({ canvasContext: context, viewport }).promise;
              const base64Url = canvas.toDataURL("image/jpeg", 0.85);
              newItems.push({
                id: `pdf-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
                fileName: `${file.name.replace(".pdf", "")} - 第 ${i} 页`,
                imageUrl: base64Url,
                status: "pending"
              });
            }
          }
        } catch (err: any) {
          console.error("Error splitting PDF:", err);
          triggerNotification("error", `渲染 PDF 发生错误: ${err.message || err}`);
        }
      } else if (file.type.startsWith("image/")) {
        // Simple image file
        try {
          const base64 = await fileToBase64(file);
          newItems.push({
            id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            fileName: file.name,
            imageUrl: base64,
            status: "pending"
          });
        } catch (err) {
          triggerNotification("error", `读取图片 ${file.name} 失败`);
        }
      }
    }

    if (newItems.length > 0) {
      setPages(prev => {
        const updated = [...prev, ...newItems];
        // Default select first newly uploaded item if none selected
        if (!selectedPageId) {
          setSelectedPageId(newItems[0].id);
        }
        return updated;
      });
      triggerNotification("success", `成功导入 ${newItems.length} 个登记表单据，等待智能分析！`);
    }
    setIsRenderingPdf(false);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // --- Single Page / Document Extraction ---
  const triggerExtraction = async (id: string) => {
    const item = pages.find(p => p.id === id);
    if (!item) return;

    // Update status to processing
    setPages(prev =>
      prev.map(p => (p.id === id ? { ...p, status: "processing", error: undefined } : p))
    );

    try {
      let parsedData: any = null;

      // 如果用户在UI中配置了自定义 Gemini API Key，我们通过前端直接进行 API 解析呼叫！
      // 这提供了对静态部署环境（例如 GitHub Pages）的完美支持，极速响应且不依赖后端代理，安全地直达 Google 神经网络。
      if (customApiKey && customApiKey.trim() !== "") {
        let base64Data = item.imageUrl;
        let mimeType = "image/jpeg";

        if (item.imageUrl.startsWith("data:")) {
          const parts = item.imageUrl.split(";base64,");
          mimeType = parts[0].split(":")[1];
          base64Data = parts[1];
        }

        const prompt = `您是一个专业的教务和手工表格分析助手。
请仔细分析并识别这张由老师手写填写的“班级学生作业登记表（查次数、查质量）”。

你需要精确地从图片中识别和提取出以下几个要点：
1. **班级名称 (className)**：通常在顶部的标题，格式如“西联G24紫荆班学生作业登记表”。请提取出完整的班级名称。
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

        // 使用通用、稳定的 gemini-2.5-flash 模型调用客户端
        const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${customApiKey.trim()}`;
        const response = await fetch(restUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data
                    }
                  },
                  {
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  className: {
                    type: "STRING",
                    description: "班级名称"
                  },
                  subject: {
                    type: "STRING",
                    description: "科目名称"
                  },
                  students: {
                    type: "ARRAY",
                    description: "学生行信息",
                    items: {
                      type: "OBJECT",
                      properties: {
                        index: { type: "INTEGER" },
                        name: { type: "STRING" },
                        submitted: { type: "NUMBER" },
                        required: { type: "NUMBER" },
                        remarks: { type: "STRING" }
                      },
                      required: ["name"]
                    }
                  }
                },
                required: ["subject", "students"]
              }
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          let errJson: any;
          try {
            errJson = JSON.parse(errText);
          } catch (e) {}
          const errorMsg = errJson?.error?.message || `API 端错误 (代码 ${response.status}): ${errText}`;
          throw new Error(errorMsg);
        }

        const rawResult = await response.json();
        const outputText = rawResult?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!outputText) {
          throw new Error("模型无法正常提取返回文本，请检查您的 API 密钥属性及配额。");
        }

        // 清理潜在的 markdown 特殊符号
        let cleaned = outputText.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        }
        parsedData = JSON.parse(cleaned.trim());

      } else {
        // 未配置自定义 API key 时，请求托管的 Express 后端接口
        const response = await fetch("/api/parse-page", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            imageStr: item.imageUrl,
            fileName: item.fileName
          })
        });

        if (!response.ok) {
          // 如果返回 404，说明是在纯静态托管环境（如 GitHub Pages）中没有可用 Express 容器服务
          if (response.status === 404) {
            throw new Error(
              "当前运行环境为纯静态网站（由于您使用了 GitHub Pages 等静态部署流程）。\n\n" +
              "【解决方案】:\n" +
              "您只需要在页面最上方的「配置外部 Gemini 密钥」输入框中，填入个人的 API 密钥，系统将自动激活前端直接解析功能，直接连接 Gemini 并且完美的在任何地方支持 OCR 提取！"
            );
          }
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || `HTTP 错误代码: ${response.status}`);
        }

        parsedData = await response.json();
      }

      // Auto-fill missing required numbers based on the rule that if only some/one row has a required number, all rows share it
      if (parsedData && Array.isArray(parsedData.students)) {
        const validRequired = parsedData.students
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
          
          parsedData.students = parsedData.students.map((st: any) => {
            const req = Number(st.required);
            if (isNaN(req) || req <= 0) {
              return { ...st, required: popularValue };
            }
            return st;
          });
        }
      }

      setPages(prev =>
        prev.map(p =>
          p.id === id
            ? {
                ...p,
                status: "completed",
                result: {
                  className: parsedData.className || "手写统计班级",
                  subject: parsedData.subject || "未知科目",
                  students: parsedData.students || []
                }
              }
            : p
        )
      );
      triggerNotification("success", `单页 [${parsedData.subject || "未知"}] 分析完成！`);
    } catch (err: any) {
      console.error("Extraction error:", err);
      setPages(prev =>
        prev.map(p => (p.id === id ? { ...p, status: "failed", error: err.message || "请求失败" } : p))
      );
      triggerNotification("error", `一页分析失败: ${err.message || "未知错误"}`);
    }
  };

  // Force parse all pending/failed pages
  const extractAllPages = async () => {
    const queue = pages.filter(p => p.status === "pending" || p.status === "failed");
    if (queue.length === 0) {
      triggerNotification("info", "没有待提取的单页登记表。");
      return;
    }

    setIsProcessingAll(true);
    triggerNotification("info", `开始流水线分析，一共 ${queue.length} 个登记表单页...`);

    // Execute sequentially to prevent server rate limiting or front overload
    for (const item of queue) {
      await triggerExtraction(item.id);
    }

    setIsProcessingAll(false);
    triggerNotification("success", "所有作业表分析解析指令已执行完毕！");
  };

  // Remove individual sheet
  const handleRemovePage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("确认要移除这页作业统计表吗？")) {
      setPages(prev => prev.filter(p => p.id !== id));
      if (selectedPageId === id) {
        const remaining = pages.filter(p => p.id !== id);
        setSelectedPageId(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  };

  // --- Sheet Calibration Modifiers (Single sheet correction) ---
  const handleUpdatePageResultHeader = (field: "className" | "subject", value: string) => {
    if (!selectedPageId) return;
    setPages(prev =>
      prev.map(p => {
        if (p.id === selectedPageId && p.result) {
          return {
            ...p,
            result: {
              ...p.result,
              [field]: value
            }
          };
        }
        return p;
      })
    );
  };

  const handleUpdateStudentRowOnPage = (stIndex: number, field: "name" | "submitted" | "required" | "remarks", value: any) => {
    if (!selectedPageId) return;
    setPages(prev =>
      prev.map(p => {
        if (p.id === selectedPageId && p.result) {
          const updatedStudents = [...p.result.students];
          if (updatedStudents[stIndex]) {
            updatedStudents[stIndex] = {
              ...updatedStudents[stIndex],
              [field]: field === "submitted" || field === "required" ? Number(value) || 0 : value
            };
          }
          return {
            ...p,
            result: {
              ...p.result,
              students: updatedStudents
            }
          };
        }
        return p;
      })
    );
  };

  const handleAddStudentRowOnPage = () => {
    if (!selectedPageId) return;
    setPages(prev =>
      prev.map(p => {
        if (p.id === selectedPageId && p.result) {
          const nextIdx = p.result.students.length + 1;
          return {
            ...p,
            result: {
              ...p.result,
              students: [
                ...p.result.students,
                { index: nextIdx, name: "新学生", submitted: 0, required: 5, remarks: "" }
              ]
            }
          };
        }
        return p;
      })
    );
  };

  const handleRemoveStudentRowOnPage = (stIndex: number) => {
    if (!selectedPageId) return;
    setPages(prev =>
      prev.map(p => {
        if (p.id === selectedPageId && p.result) {
          return {
            ...p,
            result: {
              ...p.result,
              students: p.result.students.filter((_, idx) => idx !== stIndex)
            }
          };
        }
        return p;
      })
    );
  };

  // --- Fuzzy Name Roster & Correction Engine ---
  
  // Helper to compute edit distance (Levenshtein distance)
  const getEditDistance = (s1: string, s2: string): number => {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // deletion
            dp[i][j - 1] + 1,    // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }
    return dp[m][n];
  };

  const getChineseSimilarity = (name1: string, name2: string): number => {
    if (!name1 || !name2) return 0;
    if (name1 === name2) return 1.0;
    const dist = getEditDistance(name1, name2);
    const maxLen = Math.max(name1.length, name2.length);
    if (maxLen === 0) return 0.0;
    return 1 - dist / maxLen;
  };

  // 1. Dynamic calculated roster map (Record<index, standardName>) based on frequencies
  const computedRoster = useMemo(() => {
    const completed = pages.filter(p => p.status === "completed" && p.result);
    const indexGroups: Record<number, Record<string, number>> = {};
    
    completed.forEach(page => {
      page.result!.students.forEach(st => {
        const idx = st.index;
        const name = st.name?.trim();
        if (!idx || !name) return;
        
        if (!indexGroups[idx]) {
          indexGroups[idx] = {};
        }
        indexGroups[idx][name] = (indexGroups[idx][name] || 0) + 1;
      });
    });
    
    const rosterMap: Record<number, string> = {};
    Object.keys(indexGroups).forEach(idxStr => {
      const idx = Number(idxStr);
      const nameMap = indexGroups[idx];
      let bestName = "";
      let maxCount = -1;
      Object.keys(nameMap).forEach(name => {
        if (nameMap[name] > maxCount) {
          maxCount = nameMap[name];
          bestName = name;
        }
      });
      
      // Use user override if exists, otherwise the most frequent auto-detected name
      if (customRoster[idx]) {
        rosterMap[idx] = customRoster[idx];
      } else if (bestName) {
        rosterMap[idx] = bestName;
      }
    });

    // Merge manually edited/added items in customRoster which are not in indexGroups yet
    Object.keys(customRoster).forEach(idxStr => {
      const idx = Number(idxStr);
      rosterMap[idx] = customRoster[idx];
    });
    
    return rosterMap;
  }, [pages, customRoster]);

  // 2. High performance alignment resolver
  const getAlignedStudentName = useCallback((rawName: string, index: number | undefined): string => {
    const name = rawName.trim();
    if (!name) return "";
    if (!enableFuzzyAlignment) return name;

    // A. Match by index first if standard name exists for this index
    if (index !== undefined && computedRoster[index]) {
      const stdName = computedRoster[index];
      // If ocrName has high similarity to the roster student at this index, we trust the index!
      if (getChineseSimilarity(name, stdName) >= 0.5) {
        return stdName;
      }
    }

    // B. Search standard names in computedRoster for the closest fuzzy name match
    let bestMatchName = name;
    let bestScore = 0;
    Object.values(computedRoster).forEach(stdNameVal => {
      const stdName = stdNameVal as string;
      const score = getChineseSimilarity(name, stdName);
      if (score > bestScore) {
        bestScore = score;
        bestMatchName = stdName;
      }
    });

    // If similarity is high enough, map to the roster student
    if (bestScore >= 0.65) {
      return bestMatchName;
    }

    return name;
  }, [computedRoster, enableFuzzyAlignment]);

  // --- Dynamic Consolidation Calculations ---
  const { subjects, consolidatedStudents, classNameInfo } = useMemo(() => {
    const completed = pages.filter(p => p.status === "completed" && p.result);
    
    // 1. Unique extracted standard subjects
    const uniqueSubjects = Array.from(
      new Set(completed.map(p => p.result!.subject.trim()))
    ).filter(Boolean);

    // Collect class names to display standard classroom name
    const classNames = completed.map(p => p.result!.className?.trim()).filter(Boolean);
    const mainClass = classNames.length > 0 ? classNames[0] : "紫荆班";

    // 2. Student map containing score arrays for every subject
    const studentMap: Record<
      string,
      {
        name: string;
        firstIndex: number;
        scores: Record<string, { submitted: number; required: number; remarks: string }>;
      }
    > = {};

    completed.forEach(page => {
      const sub = page.result!.subject.trim();
      page.result!.students.forEach(st => {
        const rawName = st.name?.trim() || "";
        if (!rawName) return;

        // Apply our alignment engine to resolve any handwriting OCR variations
        const name = getAlignedStudentName(rawName, st.index);
        if (!name) return;

        if (!studentMap[name]) {
          studentMap[name] = {
            name,
            firstIndex: st.index || 99,
            scores: {}
          };
        }

        studentMap[name].scores[sub] = {
          submitted: st.submitted !== undefined ? st.submitted : 0,
          required: st.required !== undefined ? st.required : 0,
          remarks: st.remarks || ""
        };
      });
    });

    // Sort students by their index or alphabet
    const sortedStudents = Object.values(studentMap).sort((a, b) => {
      if (a.firstIndex !== b.firstIndex) {
        return a.firstIndex - b.firstIndex;
      }
      return a.name.localeCompare(b.name, "zh-Hans-CN");
    });

    return {
      subjects: uniqueSubjects,
      consolidatedStudents: sortedStudents,
      classNameInfo: mainClass
    };
  }, [pages, getAlignedStudentName]);

  // Handle manual additions directly in the consolidated master scoreboard
  const handleAddStudentMaster = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newStudentName.trim();
    if (!name) return;

    if (consolidatedStudents.some(s => s.name === name)) {
      triggerNotification("error", "该学生姓名已存在于汇总表中。");
      return;
    }

    // To add a student to the master scoreboard, we simply add them with empty scores
    // into ALL completed pages so that they render in the master consolidated array
    setPages(prev =>
      prev.map(p => {
        if (p.status === "completed" && p.result) {
          const defaultRequired = p.result.students[0]?.required ?? 5;
          return {
            ...p,
            result: {
              ...p.result,
              students: [
                ...p.result.students,
                { index: p.result.students.length + 1, name, submitted: defaultRequired, required: defaultRequired, remarks: "手动作业行" }
              ]
            }
          };
        }
        return p;
      })
    );

    setNewStudentName("");
    setShowAddStudentField(false);
    triggerNotification("success", `已在所有分析单页中添加学生 [${name}] 行。`);
  };

  const handleAddSubjectMaster = (e: React.FormEvent) => {
    e.preventDefault();
    const subName = newSubjectName.trim();
    if (!subName) return;

    if (subjects.includes(subName)) {
      triggerNotification("error", "该作业科目已存在于数据集中。");
      return;
    }

    // To add a subject manually, we create a virtual completed page item with empty scores for all existing names
    const existingStudentNames = consolidatedStudents.map(s => s.name);
    // If no students exist, load standard sample placeholder list
    const studentList = existingStudentNames.length > 0 ? existingStudentNames : ["付蕾衣", "郭锦乔", "郭逸良"];

    const newPageItem: PageItem = {
      id: `manual-sub-${Date.now()}`,
      fileName: `手动创建科目 - ${subName}`,
      imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=60",
      status: "completed",
      result: {
        className: classNameInfo,
        subject: subName,
        students: studentList.map((n, i) => ({
          index: i + 1,
          name: n,
          submitted: 5,
          required: 5,
          remarks: "手动填充"
        }))
      }
    };

    setPages(prev => [...prev, newPageItem]);
    setNewSubjectName("");
    setShowAddSubjectField(false);
    setSelectedPageId(newPageItem.id);
    triggerNotification("success", `手动创建并初始化了数科科目 [${subName}]！`);
  };

  // Modify master cells directly
  const handleUpdateMasterCell = (studentName: string, subject: string, field: "submitted" | "required", value: any) => {
    const numVal = Number(value) || 0;
    
    // An edit to the master cell should update the score row inside the respective subject's PageItem
    setPages(prev =>
      prev.map(p => {
        if (p.status === "completed" && p.result && p.result.subject === subject) {
          const updatedStudents = p.result.students.map(st => {
            const alignedName = getAlignedStudentName(st.name || "", st.index);
            if (alignedName === studentName) {
              return { ...st, [field]: numVal };
            }
            return st;
          });
          return {
            ...p,
            result: {
              ...p.result,
              students: updatedStudents
            }
          };
        }
        return p;
      })
    );
  };

  // --- Filtering ---
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return consolidatedStudents;
    const lower = searchQuery.toLowerCase();
    return consolidatedStudents.filter(s => s.name.toLowerCase().includes(lower));
  }, [consolidatedStudents, searchQuery]);

  // --- Excel Output exporter ---
  const handleExportToExcel = () => {
    if (pages.filter(p => p.status === "completed").length === 0) {
      triggerNotification("error", "没有提取完成的数据可供下载，请先加载示例数据或上传识别！");
      return;
    }

    // Setup headers
    // Row 1: 序号 | 姓名 | Math (实交) | Math (应交) | Math (备注) etc.
    const headers = ["序号", "学生姓名"];
    subjects.forEach(sub => {
      headers.push(`${sub} (实交)`, `${sub} (应交)`, `${sub} (备注)`);
    });

    // Rows
    const dataRows = filteredStudents.map((st, sIndex) => {
      const row = [sIndex + 1, st.name];
      subjects.forEach(sub => {
        const score = st.scores[sub];
        if (score) {
          row.push(score.submitted as any, score.required as any, score.remarks || "");
        } else {
          row.push("" as any, "" as any, "");
        }
      });
      return row;
    });

    // Write worksheet
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    // Apply auto width sizing for neat columns
    const colWidths = [
      { wch: 6 },  // No.
      { wch: 12 }, // Name
    ];
    subjects.forEach(() => {
      colWidths.push({ wch: 11 }, { wch: 11 }, { wch: 15 });
    });
    worksheet["!cols"] = colWidths;

    // Workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "学生提交情况汇总");

    // Download file
    const fileSuffix = new Date().toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }).replace("/", "");
    XLSX.writeFile(workbook, `作业汇总填空表_${classNameInfo}_${fileSuffix}.xlsx`);
    
    triggerNotification("success", `作业统计 Excel 文件已成功生成并下载！`);
  };

  const selectedPage = pages.find(p => p.id === selectedPageId);

  // Drag and drop handlers
  const [dragOver, setDragOver] = useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => {
    setDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processUploadedFiles(Array.from(files));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col selection:bg-slate-200">
      
      {/* Top Banner Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-sky-600 text-white p-2.5 rounded-lg">
            <Layers className="h-6 w-6" id="app-logo-icon" />
          </div>
          <div>
            <h1 className="font-display font-semibold text-lg tracking-tight text-slate-900" id="app-title-head">
              手写作业智能电子统计系统
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              极速识别扫描件（PDF/图片） · 多学科自动汇总核对 · 零损导出 Excel 填空
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleLoadSample}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-200"
            title="一键加载已经准备好的真实手写成绩表"
            id="load-sample-btn"
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-500 fill-sky-200" />
            <span>加载真实示例数据</span>
          </button>

          {pages.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-200"
              id="clear-all-btn"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>清空重置</span>
            </button>
          )}

          <div className="text-[11px] font-mono bg-slate-100 px-2 py-1 text-slate-500 rounded border border-slate-200">
            Node: 13-14周
          </div>
        </div>
      </header>

      {/* Custom Gemini API Key Configuration Panel */}
      <div className="bg-amber-50/60 border-b border-amber-200/60 px-6 py-2.5 flex items-center justify-between flex-wrap gap-3 text-xs" id="api-key-config-panel">
        <div className="flex items-center space-x-2 text-slate-700">
          <Key className="h-4 w-4 text-amber-500 shrink-0" />
          <span>
            <strong>配置外部 Gemini 密钥 (可选)</strong>：如果遭遇接口调用出错或超出限额，您可以在此输入您的个人 <strong>Gemini API Key</strong> (一般由 <code className="bg-amber-100/60 px-1 py-0.5 rounded text-amber-800 font-mono">AIzaSy</code> 开头)。密钥仅保存在您的浏览器本地缓存中，不上传至任何第三方服务器。
          </span>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <input
            type="password"
            placeholder="输入您的 Gemini API Key (AIzaSy...)"
            value={customApiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            className="bg-white border border-amber-200 focus:border-amber-400 rounded-lg px-2.5 py-1 text-xs w-64 text-slate-800 focus:outline-hidden shadow-xs transition-colors"
            id="custom-api-key-field"
          />
          {customApiKey ? (
            <button
              onClick={() => handleApiKeyChange("")}
              className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              id="clear-custom-key-btn"
            >
              清除
            </button>
          ) : (
            <span className="text-slate-500/70 text-xs font-medium select-none">
              (使用默认服务)
            </span>
          )}
        </div>
      </div>

      {/* Primary Workspace Layout */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: Page Manager Panel (Width 1/4) */}
        <section className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
          
          {/* Section Upload Box */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 block">
              扫描件投递与上传
            </h2>
            
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 ${
                dragOver
                  ? "border-sky-500 bg-sky-50"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
              id="upload-dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <Upload className={`mx-auto h-8 w-8 mb-2 transition-transform duration-300 ${dragOver ? "text-sky-500 scale-110" : "text-slate-400"}`} />
              <p className="text-xs font-semibold text-slate-700">点击或并拖拽上传</p>
              <p className="text-[10px] text-slate-400 mt-1">支持多页 PDF / 图片</p>
            </div>

            {isRenderingPdf && (
              <div className="mt-3 flex items-center space-x-2 text-xs text-sky-600 bg-sky-50 p-2 rounded-lg border border-sky-100">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>正在提取并渲染 PDF 页面，请稍候...</span>
              </div>
            )}
          </div>

          {/* Uploaded Page Items Queue Grid */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 pb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                单页清单 ({pages.length} 页)
              </span>
              
              {pages.length > 0 && pages.some(p => p.status === "pending" || p.status === "failed") && (
                <button
                  onClick={extractAllPages}
                  disabled={isProcessingAll}
                  className="text-xs text-sky-600 hover:text-sky-700 font-bold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                  id="extract-all-text-btn"
                >
                  {isProcessingAll ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>正在处理...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      <span>智能分析全部</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {pages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <FileText className="h-10 w-10 mb-2 stroke-1 text-slate-300" />
                <p className="text-xs font-medium">暂无作业登记表</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                  请点击上方区域上传手写单据扫描件，或者加载系统为您准备好的示例成绩表。
                </p>
                
                <button
                  onClick={handleLoadSample}
                  className="mt-4 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-100 text-sky-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                  id="empty-action-load-sample"
                >
                  直接体验示例数据
                </button>
              </div>
            ) : (
              <div className="p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-310px)]">
                {pages.map((p, idx) => {
                  const isSelected = p.id === selectedPageId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedPageId(p.id);
                        if (p.status === "completed") {
                          setActiveTab("calibration");
                        }
                      }}
                      className={`group flex items-center space-x-3 p-2.5 rounded-xl cursor-pointer border transition-all duration-200 ${
                        isSelected
                          ? "bg-slate-100/80 border-slate-300/80 shadow-xs"
                          : "bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200"
                      }`}
                      id={`page-item-${p.id}`}
                    >
                      <div className="h-11 w-9 bg-slate-100 border border-slate-200 rounded overflow-hidden shrink-0 relative flex items-center justify-center">
                        <img
                          src={p.imageUrl}
                          alt="thumbnail"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/5" />
                        <span className="absolute bottom-0 right-0 bg-slate-800/70 text-[8px] text-white px-1 py-0.5 rounded-tl font-mono font-bold">
                          p{idx+1}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate" title={p.fileName}>
                          {p.fileName}
                        </p>
                        
                        <div className="flex items-center mt-1">
                          {p.status === "pending" && (
                            <span className="inline-flex items-center text-[10px] tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                              待分析
                            </span>
                          )}
                          {p.status === "processing" && (
                            <span className="inline-flex items-center text-[10px] tracking-wide text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded font-medium">
                              <Loader2 className="h-2 w-2 animate-spin mr-1" />
                              分析中...
                            </span>
                          )}
                          {p.status === "completed" && (
                            <span className="inline-flex items-center text-[10px] tracking-wide text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-100/70">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 mr-1" />
                              {p.result?.subject || "已完成"}
                            </span>
                          )}
                          {p.status === "failed" && (
                            <span className="inline-flex items-center text-[10px] tracking-wide text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-medium" title={p.error}>
                              <XCircle className="h-2.5 w-2.5 text-red-400 mr-1" />
                              识别失败
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action hover tools */}
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {p.status === "pending" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerExtraction(p.id);
                            }}
                            className="bg-sky-50 hover:bg-sky-100 p-1 rounded border border-sky-200 text-sky-600 text-[10px] font-bold"
                            title="立即单页智能分析"
                            id={`extract-single-${p.id}`}
                          >
                            分析
                          </button>
                        )}
                        <button
                          onClick={(e) => handleRemovePage(p.id, e)}
                          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="移除"
                          id={`delete-page-${p.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT AREA: Active Table Workspace with Tabs (Master Scoreboard vs Calibration) */}
        <section className="flex-1 bg-slate-50 p-6 flex flex-col overflow-hidden relative">
          
          {/* Top Info alert / notification message */}
          <AnimatePresence>
            {notification && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 shadow-md rounded-xl px-5 py-3 border flex items-center space-x-2.5 min-w-[300px] max-w-lg ${
                  notification.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : notification.type === "error"
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-sky-50 border-sky-100 text-sky-800"
                }`}
                id="alert-toast"
              >
                {notification.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
                {notification.type === "error" && <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />}
                {notification.type === "info" && <Info className="h-5 w-5 text-sky-500 shrink-0" />}
                <p className="text-xs font-semibold leading-relaxed">{notification.text}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Tab Header Block */}
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div className="flex items-center space-x-2 bg-slate-200/60 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("master")}
                className={`flex items-center space-x-1.5 px-4  py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "master"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                id="tab-master-btn"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>一键汇总总表 ({filteredStudents.length} 人)</span>
              </button>
              
              <button
                disabled={!selectedPage}
                onClick={() => setActiveTab("calibration")}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !selectedPage ? "opacity-40 cursor-not-allowed" : ""
                } ${
                  activeTab === "calibration"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                id="tab-calibration-btn"
                title={selectedPage ? "对当前选中单页的识别值进行人工校准" : "请先选择左侧任意纸电单页"}
              >
                <Eye className="h-4 w-4" />
                <span>单页人工校准</span>
              </button>

              <button
                onClick={() => setActiveTab("roster")}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "roster"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                id="tab-roster-btn"
              >
                <UserCheck className="h-4 w-4" />
                <span>智能姓名对齐 ({Object.keys(computedRoster).length} 人)</span>
              </button>
            </div>

            {/* Quick dashboard score recap in title row */}
            <div className="text-xs text-slate-500 font-medium">
              当前统计班级: <strong className="text-slate-800">{classNameInfo || "未指定"}</strong> · 
              已解析科目: <strong className="text-sky-600">{subjects.length > 0 ? subjects.join(", ") : "无"}</strong>
            </div>
          </div>

          {/* TAB CONTENT 1: MASTER SUMMARY BOARD */}
          {activeTab === "master" && (
            <div className="bg-white border border-slate-200 rounded-xl flex-1 flex flex-col overflow-hidden shadow-xs">
              
              {/* Toolbar in summary screen */}
              <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center space-x-3 w-full md:max-w-xs">
                  <div className="relative w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="搜索学生姓名..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-200 pl-9 pr-4 py-1.5 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden"
                      id="student-search-input"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-wrap md:flex-nowrap gap-y-2">
                  {/* Add Student Button */}
                  <div className="relative">
                    {showAddStudentField ? (
                      <form onSubmit={handleAddStudentMaster} className="flex items-center space-x-1 bg-white border border-slate-300 p-1 rounded-lg absolute right-0 bottom-full mb-1 z-10 shadow-lg">
                        <input
                          autoFocus
                          type="text"
                          required
                          placeholder="新学生姓名"
                          value={newStudentName}
                          onChange={(e) => setNewStudentName(e.target.value)}
                          className="border-none px-2 py-1 text-xs outline-hidden w-28 text-slate-800"
                        />
                        <button type="submit" className="bg-sky-600 text-white px-2 py-1 rounded text-xs font-semibold">确认</button>
                        <button type="button" onClick={() => setShowAddStudentField(false)} className="text-slate-400 px-1 py-1 text-xs">取消</button>
                      </form>
                    ) : null}
                    
                    <button
                      onClick={() => {
                        setShowAddStudentField(true);
                        setShowAddSubjectField(false);
                      }}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:text-slate-800 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-xs"
                      id="add-student-master-btn"
                    >
                      <Plus className="h-3.5 w-3.5 text-slate-400" />
                      <span>添加学生</span>
                    </button>
                  </div>

                  {/* Add Subject Button */}
                  <div className="relative">
                    {showAddSubjectField ? (
                      <form onSubmit={handleAddSubjectMaster} className="flex items-center space-x-1 bg-white border border-slate-300 p-1 rounded-lg absolute right-0 bottom-full mb-1 z-10 shadow-lg">
                        <input
                          autoFocus
                          type="text"
                          required
                          placeholder="例如: 物理学"
                          value={newSubjectName}
                          onChange={(e) => setNewSubjectName(e.target.value)}
                          className="border-none px-2 py-1 text-xs outline-hidden w-28 text-slate-800"
                        />
                        <button type="submit" className="bg-sky-600 text-white px-2 py-1 rounded text-xs font-semibold">生成</button>
                        <button type="button" onClick={() => setShowAddSubjectField(false)} className="text-slate-400 px-1 py-1 text-xs">取消</button>
                      </form>
                    ) : null}

                    <button
                      onClick={() => {
                        setShowAddSubjectField(true);
                        setShowAddStudentField(false);
                      }}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:text-slate-800 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-xs"
                      id="add-subject-master-btn"
                    >
                      <Plus className="h-3.5 w-3.5 text-slate-400" />
                      <span>添加科目列</span>
                    </button>
                  </div>

                  {/* Export Button */}
                  <button
                    onClick={handleExportToExcel}
                    className="flex items-center space-x-2 px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer border border-sky-700 hover:scale-101"
                    id="export-excel-btn"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    <span>导出 Excel 表单</span>
                  </button>
                </div>
              </div>

              {/* Data Table block */}
              {dynamicTablePlaceholderInfo()}
            </div>
          )}

          {/* TAB CONTENT 2: INDIVIDUAL PAGE CALIBRATION & VERIFICATION */}
          {activeTab === "calibration" && selectedPage && (
            <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
              
              {/* Zoomable Image Panel */}
              <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 flex flex-col overflow-hidden shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                    <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                    <span>原始手写登记单预览</span>
                  </h3>
                  <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-2 py-0.5 rounded border border-slate-200">
                    {selectedPage.fileName}
                  </span>
                </div>

                <div className="flex-1 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-auto p-4 relative group">
                  <img
                    src={selectedPage.imageUrl}
                    alt="Current verification sheet scan"
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full rounded shadow-sm object-contain select-none transition-transform duration-200"
                    id="calibration-zoomed-img"
                  />
                  <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-[10px] text-white py-1 px-2.5 rounded-md font-sans">
                      💡 请对照本图片内容，检查右侧解析出来的数据。双击右侧表格项可直接校正。
                  </div>
                </div>
              </div>

              {/* Manual Correction Table panel */}
              <div className="w-[450px] bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-xs shrink-0">
                
                {/* Header info of single page parser */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800">
                      单页智能识别结果
                    </h3>
                    <button
                      onClick={() => triggerExtraction(selectedPage.id)}
                      className="text-sky-600 hover:text-sky-700 text-xs font-bold flex items-center space-x-1"
                      id="calibration-reparse-btn"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>重新解析此页</span>
                    </button>
                  </div>

                  {selectedPage.result && (
                    <div className="grid grid-cols-2 gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                          班级名称
                        </label>
                        <input
                          type="text"
                          value={selectedPage.result.className || ""}
                          onChange={(e) => handleUpdatePageResultHeader("className", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 px-2 py-1 rounded text-xs text-slate-800 font-medium focus:outline-hidden"
                          id="calibration-class-input"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                          提取科目
                        </label>
                        <input
                          type="text"
                          value={selectedPage.result.subject || ""}
                          onChange={(e) => handleUpdatePageResultHeader("subject", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 px-2 py-1 rounded text-xs text-slate-800 font-bold focus:outline-hidden"
                          id="calibration-subject-input"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Editor container list of students on sheet */}
                <div className="flex-1 overflow-y-auto p-3">
                  {selectedPage.status === "completed" && selectedPage.result ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1 mb-2">
                        <span>序号 · 学生姓名</span>
                        <div className="flex space-x-8 pr-12">
                          <span>实交</span>
                          <span>应交</span>
                        </div>
                      </div>

                      {selectedPage.result.students.map((st, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-transparent hover:border-slate-200/60 transition-all gap-2"
                        >
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <span className="text-[10px] font-mono font-bold text-slate-400 w-5">
                              {st.index || sIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={st.name || ""}
                              onChange={(e) => handleUpdateStudentRowOnPage(sIdx, "name", e.target.value)}
                              className="bg-transparent border-b border-transparent focus:border-slate-300 font-semibold text-xs text-slate-800 w-24 py-0.5"
                            />
                            <input
                              type="text"
                              placeholder="添加备注..."
                              value={st.remarks || ""}
                              onChange={(e) => handleUpdateStudentRowOnPage(sIdx, "remarks", e.target.value)}
                              className="bg-transparent border-none text-[10px] text-slate-400 focus:outline-hidden truncate w-24"
                            />
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={st.submitted}
                              onChange={(e) => handleUpdateStudentRowOnPage(sIdx, "submitted", e.target.value)}
                              className="w-12 bg-white border border-slate-200 text-center font-bold px-1 py-0.5 rounded text-xs"
                            />
                            <span className="text-slate-400 text-xs">/</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={st.required}
                              onChange={(e) => handleUpdateStudentRowOnPage(sIdx, "required", e.target.value)}
                              className="w-12 bg-white border border-slate-200 text-center font-bold px-1 py-0.5 rounded text-xs"
                            />

                            <button
                              onClick={() => handleRemoveStudentRowOnPage(sIdx)}
                              className="text-slate-300 hover:text-red-500 p-1 transition-colors ml-1"
                              title="删除行"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={handleAddStudentRowOnPage}
                        className="w-full flex items-center justify-center space-x-1 py-2 border border-dashed border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700 text-xs rounded-lg mt-3"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>在此表页面添加学生成绩记录</span>
                      </button>
                    </div>
                  ) : selectedPage.status === "processing" ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full border-4 border-sky-100 border-t-sky-600 animate-spin" />
                        <Sparkles className="h-5 w-5 text-sky-500 absolute top-3.5 left-3.5 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">Gemini 智能眼正在极速阅读中...</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
                          系统正在自动探测表格边界、提取班级和作业科目，并还原由于打勾打叉及手写造成的非标准数字。
                        </p>
                      </div>
                    </div>
                  ) : selectedPage.status === "failed" ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                      <div className="bg-red-50 p-3 rounded-full mb-3 border border-red-100">
                        <XCircle className="h-8 w-8 text-red-500" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">智能分析失败</p>
                      <div className="mt-2 text-xs text-red-600 bg-red-50/50 p-3 rounded-lg border border-red-100/75 max-w-full text-left font-mono break-all whitespace-pre-wrap">
                        {selectedPage.error || "未知解析错误，请确认网络连接或自定义 API 密钥。"}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-3 max-w-[340px]">
                        如果您使用的是默认服务而达到调用限额，请在页面顶部的 <strong>配置外部 Gemini 密钥</strong> 中添加您个人的 API 密钥。
                      </p>
                      <button
                        onClick={() => triggerExtraction(selectedPage.id)}
                        className="mt-4 flex items-center space-x-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>重新开始识别</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
                      <AlertCircle className="h-10 w-10 text-slate-300 stroke-1 mb-2" />
                      <p className="text-xs font-semibold">该页尚未进行智能分析</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[2400px]">
                        请点击下方或者左侧的“开始分析”按钮，调用 Gemini AI 系统完成全页的手写表格读取。
                      </p>

                      <button
                        onClick={() => triggerExtraction(selectedPage.id)}
                        className="mt-4 flex items-center space-x-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs transition-transform"
                      >
                        <Sparkles className="h-3.5 w-3.5 fill-white" />
                        <span>立即开始单页识别</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer status indicating calibration sync */}
                <div className="p-3 bg-slate-50 border-t border-slate-150 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span className="flex items-center text-emerald-600">
                    <UserCheck className="h-3 w-3 mr-1" />
                    已自动实时同步至汇总表
                  </span>
                  
                  <button
                    onClick={() => setActiveTab("master")}
                    className="text-slate-600 hover:text-slate-800 flex items-center space-x-1"
                  >
                    <span>返回汇总总表</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

              </div>

            </div>
          )}

          {/* TAB CONTENT 3: SMART ROSTER ALIGNMENT */}
          {activeTab === "roster" && (
            <div className="bg-white border border-slate-200 rounded-xl flex-1 flex flex-col overflow-hidden shadow-xs p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-sky-50 rounded-lg text-sky-600">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-800">智能班级花名册与手写姓名对齐</h2>
                      <p className="text-xs text-slate-400 mt-0.5">自动修正手写识别中的同音别字、字形误差，将同一位学生的不同识别记录完美融合到单行中。</p>
                    </div>
                  </div>
                  
                  {/* Toggle Enable Fuzzy Alignment */}
                  <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs">
                    <input
                      type="checkbox"
                      id="toggle-fuzzy"
                      checked={enableFuzzyAlignment}
                      onChange={(e) => {
                        setEnableFuzzyAlignment(e.target.checked);
                        triggerNotification("info", e.target.checked ? "已开启智能姓名模糊校对机制" : "已关闭智能姓名校对，将展现原始OCR名称");
                      }}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
                    />
                    <label htmlFor="toggle-fuzzy" className="text-xs font-semibold text-slate-600 cursor-pointer">
                      启用智能姓名模糊校对
                    </label>
                  </div>
                </div>

                <div className="mt-4 p-3.5 bg-sky-50/50 border border-sky-100 rounded-xl text-xs text-sky-800 leading-relaxed">
                  <strong>💡 运作机理</strong>：当不同科目登记表中，同一个学生的名字因手写潦草被误识为别字时（例如“付蕾衣”被误识为“付雷衣”或“付蕾依”），系统会结合<strong>【表格序号匹配】</strong>和<strong>【字形相似度算法】</strong>进行智能映射，并将其在各个科目下的实交、应交、备注数据聚合在同一位学生名下。
                  您可以在下方直接编辑每个学号对应的<strong>标准姓名</strong>，编辑后全单页的关联识别别字将一秒同步自动纠错！
                </div>
              </div>

              {/* Roster list view */}
              <div className="flex-1 overflow-auto border border-slate-150 rounded-xl">
                <table className="min-w-full divide-y divide-slate-200 border-collapse">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase w-20 border-b border-slate-200">学号/序号</th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-slate-800 uppercase w-56 border-b border-slate-200">标准花名册姓名 (可编辑)</th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase border-b border-slate-200">被智能合并的手写 / OCR 识别原始词</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100 text-xs">
                    {Object.keys(computedRoster).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                          当前尚未解析任何登记表，暂未提取出班级学生名册。请先加载示例数据或上传您的登记表！
                        </td>
                      </tr>
                    ) : (
                      Object.keys(computedRoster)
                        .map(Number)
                        .sort((a, b) => a - b)
                        .map((idx) => {
                          const standardName = computedRoster[idx];
                          const isEditing = editingRosterIndex === idx;

                          // Find all original OCR names across all completed sheets that match this standard student
                          const matchedOcrWords: { subject: string; originalName: string }[] = [];
                          pages.forEach(p => {
                            if (p.status === "completed" && p.result) {
                              p.result.students.forEach(st => {
                                if (st.name) {
                                  const aligned = getAlignedStudentName(st.name, st.index);
                                  if (aligned === standardName) {
                                    matchedOcrWords.push({
                                      subject: p.result!.subject,
                                      originalName: st.name
                                    });
                                  }
                                }
                              });
                            }
                          });

                          // Group matched names to keep them unique in display badges
                          const uniqueMatches = Array.from(new Set(matchedOcrWords.map(m => `${m.originalName} (${m.subject})`)));

                          return (
                            <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                              <td className="px-5 py-3.5 font-mono font-bold text-slate-400 border-r border-slate-100">
                                {idx}
                              </td>
                              <td className="px-5 py-3.5 font-semibold text-slate-800 border-r border-slate-100">
                                {isEditing ? (
                                  <div className="flex items-center space-x-1.5">
                                    <input
                                      type="text"
                                      value={editingRosterValue}
                                      onChange={(e) => setEditingRosterValue(e.target.value)}
                                      className="border border-sky-300 bg-white rounded px-2 py-1 text-xs font-bold text-slate-800 outline-hidden w-32 focus:ring-1 focus:ring-sky-500"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => {
                                        const trimmed = editingRosterValue.trim();
                                        if (trimmed) {
                                          setCustomRoster(prev => ({ ...prev, [idx]: trimmed }));
                                          setEditingRosterIndex(null);
                                          triggerNotification("success", `已将学号 ${idx} 的标准姓名更改为「${trimmed}」`);
                                        }
                                      }}
                                      className="bg-sky-600 hover:bg-sky-700 text-white p-1 rounded-md text-[10px] font-bold cursor-pointer"
                                    >
                                      保存
                                    </button>
                                    <button
                                      onClick={() => setEditingRosterIndex(null)}
                                      className="text-slate-400 hover:text-slate-600 px-1 py-1"
                                    >
                                      取消
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-2 group/btn">
                                    <span className="text-slate-900 font-bold">{standardName}</span>
                                    <button
                                      onClick={() => {
                                        setEditingRosterIndex(idx);
                                        setEditingRosterValue(standardName);
                                      }}
                                      className="p-1 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 cursor-pointer transition-colors"
                                      title="编辑此学号的姓名"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-slate-500">
                                <div className="flex flex-wrap gap-1.5">
                                  {uniqueMatches.map((badgeText, bIdx) => (
                                    <span key={bIdx} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                      {badgeText}
                                    </span>
                                  ))}
                                  {uniqueMatches.length === 0 && (
                                    <span className="text-slate-300 italic">暂无对应的手写识别词组</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Roster Footer reset */}
              <div className="mt-4 flex justify-between items-center text-xs text-slate-400">
                <span>提示：点击姓名旁边的编辑图标即可纠正。若您清空了工作区，花名册也会相应清空。</span>
                {Object.keys(customRoster).length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm("确定要重置花名册到自动探测的默认名称吗？")) {
                        setCustomRoster({});
                        triggerNotification("info", "已清除所有手动对齐的姓名重写规则。");
                      }
                    }}
                    className="flex items-center space-x-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-lg font-medium transition-all cursor-pointer border border-slate-200"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    <span>恢复到默认自动识别值</span>
                  </button>
                )}
              </div>
            </div>
          )}

        </section>

      </main>

    </div>
  );

  // Dynamic table view generator to prevent large bloated jsx code inside App render return
  function dynamicTablePlaceholderInfo() {
    if (subjects.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
          <Layers className="h-12 w-12 text-slate-300 stroke-1 mb-3 animate-pulse" />
          <h3 className="text-sm font-bold text-slate-700">汇总表尚无可用数据</h3>
          <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
            您当前尚未解析完成任何作业统计档案单。
            通过左侧面板上传图片扫描件或多页 PDF 成绩登记单，并一键调用
            <strong>【智能分析全部】</strong>，系统在这里便会自动实时渲染多单融合后的汇总看板！
          </p>

          <button
            onClick={handleLoadSample}
            className="mt-6 flex items-center space-x-1.5 px-4 py-2 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
            id="table-action-seed-btn"
          >
            <Sparkles className="h-4 w-4 text-sky-600" />
            <span>立即一键填充示例成绩包</span>
          </button>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="min-w-full divide-y divide-slate-200 border-collapse">
          {/* Header Row */}
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-xs border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16 bg-slate-50 border-r border-slate-200">
                序号
              </th>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-800 uppercase tracking-wider w-36 bg-slate-50 border-r border-slate-200 sticky left-0 z-20">
                学生姓名
              </th>
              
              {subjects.map(sub => (
                <th
                  key={sub}
                  colSpan={2}
                  className="px-4 py-2 text-center text-xs font-extrabold text-slate-705 border-r border-slate-200 bg-slate-50"
                >
                  <div className="flex items-center justify-center space-x-1.5">
                    <span className="bg-sky-50 text-sky-700 text-[10px] font-bold px-2 py-0.5 rounded border border-sky-100">
                      {sub}
                    </span>
                  </div>
                  <div className="flex justify-center space-x-6 text-[9px] text-slate-450 mt-1 font-semibold">
                    <span>实交</span>
                    <span>应交</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Student rows in scoreboard body */}
          <tbody className="bg-white divide-y divide-slate-100 font-sans text-xs">
            {filteredStudents.map((st, sIndex) => (
              <tr key={st.name} className="hover:bg-slate-50/50 transition-colors">
                {/* serial index */}
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-400 font-mono font-medium border-r border-slate-100">
                  {sIndex + 1}
                </td>
                
                {/* student name label, pinned/sticky on wide screens */}
                <td className="px-5 py-2.5 whitespace-nowrap font-semibold text-slate-900 border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span>{st.name}</span>
                    {/* Visual status cue - if there is any incomplete subjects homework */}
                    {Object.values(st.scores).some((sc: any) => sc.submitted < sc.required) && (
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-400" title="该学子有作业未补交齐" />
                    )}
                  </div>
                </td>

                {/* Score grids cell block */}
                {subjects.map(sub => {
                  const score = st.scores[sub];
                  if (!score) {
                    return (
                      <td key={sub} colSpan={2} className="px-4 py-2.5 text-center text-slate-300 font-mono italic border-r border-slate-100 bg-slate-50/20">
                        未录入
                      </td>
                    );
                  }

                  const isComplete = score.submitted >= score.required;
                  const hasDeficit = score.submitted < score.required;

                  return (
                    <td
                      key={sub}
                      colSpan={2}
                      className={`px-3 py-2 border-r border-slate-150 transition-colors ${
                        hasDeficit ? "bg-amber-50/30 hover:bg-amber-50/60" : "hover:bg-slate-100/40"
                      }`}
                    >
                      <div className="flex items-center justify-center space-x-1.5">
                        
                        {/* actual submitted editable cell widget */}
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={score.submitted}
                            onChange={(e) => handleUpdateMasterCell(st.name, sub, "submitted", e.target.value)}
                            className={`w-9 h-6 text-center rounded font-bold border ${
                              hasDeficit
                                ? "border-amber-200 text-amber-700 bg-amber-50"
                                : "border-slate-200 text-slate-700 bg-white"
                            }`}
                          />
                          <span className="text-slate-400 text-[10px]">/</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={score.required}
                            onChange={(e) => handleUpdateMasterCell(st.name, sub, "required", e.target.value)}
                            className="w-9 h-6 text-center text-[11px] text-slate-400 bg-transparent rounded border border-transparent focus:border-slate-200 focus:bg-white focus:text-slate-700"
                          />
                        </div>

                        {/* Status badge micro-icon */}
                        {isComplete ? (
                          <span className="inline-block" title={`已齐: ${score.submitted}/${score.required}`}>
                            ✅
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] text-amber-600 font-bold" title={`缺 ${score.required - score.submitted} 次`}>
                            -{score.required - score.submitted}
                          </span>
                        )}

                        {score.remarks && (
                          <span className="cursor-help text-[10px] text-slate-400 truncate max-w-[50px] inline-block font-medium" title={score.remarks}>
                            💬
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}
