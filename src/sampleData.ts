import { PageItem } from "./types";

export const sampleClassData: PageItem[] = [
  {
    id: "sample-1",
    fileName: "西联G24紫荆班学生作业登记表_语文阅读.png",
    imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60", // Placeholder but look-alike
    status: "completed",
    result: {
      className: "西联G24紫荆班",
      subject: "语文阅读",
      students: [
        { index: 1, name: "付蕾衣", submitted: 4, required: 6, remarks: "缺2次" },
        { index: 2, name: "郭锦乔", submitted: 5, required: 6, remarks: "补交红字" },
        { index: 3, name: "郭逸良", submitted: 6, required: 6, remarks: "全交" },
        { index: 4, name: "林隆志", submitted: 1, required: 6, remarks: "多处未交" },
        { index: 5, name: "林芷伊", submitted: 6, required: 6, remarks: "全交" },
        { index: 6, name: "吕雨瑄", submitted: 4, required: 6, remarks: "" },
        { index: 7, name: "沙彤", submitted: 6, required: 6, remarks: "红圈补" },
        { index: 8, name: "尚子皓", submitted: 6, required: 6, remarks: "" },
        { index: 9, name: "田栩莎", submitted: 6, required: 6, remarks: "" },
        { index: 10, name: "王虹霁", submitted: 4, required: 6, remarks: "" },
        { index: 11, name: "杨镕瑜", submitted: 6, required: 6, remarks: "红圈补" },
        { index: 12, name: "张鼎炫", submitted: 5, required: 6, remarks: "补画" },
        { index: 13, name: "张喻雯", submitted: 6, required: 6, remarks: "红圈补" },
        { index: 14, name: "黄锦润", submitted: 0, required: 6, remarks: "未交" },
      ]
    }
  },
  {
    id: "sample-2",
    fileName: "西联G24紫荆班学生作业登记表_英文写作.png",
    imageUrl: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=60",
    status: "completed",
    result: {
      className: "西联G24紫荆班",
      subject: "英文写作",
      students: [
        { index: 1, name: "付蕾衣", submitted: 3, required: 5, remarks: "" },
        { index: 2, name: "郭锦乔", submitted: 5, required: 5, remarks: "全交" },
        { index: 3, name: "郭逸良", submitted: 8, required: 8, remarks: "含加分" },
        { index: 4, name: "林隆志", submitted: 3, required: 5, remarks: "" },
        { index: 5, name: "林芷伊", submitted: 5, required: 5, remarks: "全交" },
        { index: 6, name: "吕雨瑄", submitted: 5, required: 5, remarks: "全交" },
        { index: 7, name: "沙彤", submitted: 5, required: 5, remarks: "全交" },
        { index: 8, name: "尚子皓", submitted: 8, required: 8, remarks: "加项满分" },
        { index: 9, name: "田栩莎", submitted: 8, required: 8, remarks: "加项满分" },
        { index: 10, name: "王真涵", submitted: 0, required: 5, remarks: "缺考/缺交" },
        { index: 11, name: "杨镕瑜", submitted: 5, required: 5, remarks: "全交" },
        { index: 12, name: "张鼎炫", submitted: 4, required: 5, remarks: "差1" },
        { index: 13, name: "张喻雯", submitted: 8, required: 8, remarks: "" },
        { index: 14, name: "黄锦润", submitted: 0, required: 5, remarks: "" },
      ]
    }
  },
  {
    id: "sample-3",
    fileName: "西联G24紫荆班学生作业登记表_数学.png",
    imageUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=60",
    status: "completed",
    result: {
      className: "西联G24紫荆班",
      subject: "数学",
      students: [
        { index: 1, name: "付蕾衣", submitted: 10, required: 10, remarks: "笔改补齐" },
        { index: 2, name: "郭锦乔", submitted: 9, required: 10, remarks: "红三角" },
        { index: 3, name: "郭逸良", submitted: 10, required: 10, remarks: "" },
        { index: 4, name: "林隆志", submitted: 10, required: 10, remarks: "" },
        { index: 5, name: "林芷伊", submitted: 10, required: 10, remarks: "" },
        { index: 6, name: "吕雨瑄", submitted: 10, required: 10, remarks: "有补交" },
        { index: 7, name: "沙彤", submitted: 10, required: 10, remarks: "" },
        { index: 8, name: "尚子皓", submitted: 10, required: 10, remarks: "" },
        { index: 9, name: "田栩莎", submitted: 10, required: 10, remarks: "" },
        { index: 10, name: "王虹霁", submitted: 7, required: 10, remarks: "缺3" },
        { index: 11, name: "杨镕瑜", submitted: 10, required: 10, remarks: "" },
        { index: 12, name: "张鼎炫", submitted: 10, required: 10, remarks: "" },
        { index: 13, name: "张喻雯", submitted: 10, required: 10, remarks: "" },
        { index: 14, name: "黄锦润", submitted: 0, required: 10, remarks: "未交" },
      ]
    }
  },
  {
    id: "sample-4",
    fileName: "西联G24紫荆班学生作业登记表_听力.png",
    imageUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=60",
    status: "completed",
    result: {
      className: "西联G24紫荆班",
      subject: "听力",
      students: [
        { index: 1, name: "付蕾衣", submitted: 8, required: 9, remarks: "" },
        { index: 2, name: "郭锦乔", submitted: 7, required: 9, remarks: "缺2" },
        { index: 3, name: "郭逸良", submitted: 9, required: 9, remarks: "全交" },
        { index: 4, name: "林隆志", submitted: 1.5, required: 9, remarks: "旷课主要" },
        { index: 5, name: "林芷伊", submitted: 9, required: 9, remarks: "" },
        { index: 6, name: "吕雨瑄", submitted: 8.5, required: 9, remarks: "" },
        { index: 7, name: "沙彤", submitted: 9, required: 9, remarks: "" },
        { index: 8, name: "尚子皓", submitted: 9, required: 9, remarks: "" },
        { index: 9, name: "田栩莎", submitted: 8, required: 9, remarks: "" },
        { index: 10, name: "王虹霁", submitted: 8, required: 9, remarks: "" },
        { index: 11, name: "杨镕瑜", submitted: 9, required: 9, remarks: "" },
        { index: 12, name: "张鼎炫", submitted: 7.5, required: 9, remarks: "" },
        { index: 13, name: "张喻雯", submitted: 9, required: 9, remarks: "" },
        { index: 14, name: "黄锦润", submitted: 0, required: 9, remarks: "" },
      ]
    }
  }
];
