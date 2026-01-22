import React, { useState } from 'react';

const GroupIdFinder: React.FC = () => {
    const [isCopied, setIsCopied] = useState(false);
    const exampleGroupId = 'Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

    const handleCopy = () => {
        navigator.clipboard.writeText(exampleGroupId).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const codeSnippet = `{
  "events": [
    {
      "type": "message",
      "replyToken": "...",
      "source": {
        "userId": "U...",
        "type": "group",
        "groupId": "${exampleGroupId}"
      },
      "timestamp": 1674382800000,
      "mode": "active",
      "message": {
        "type": "text",
        "id": "...",
        "text": "สวัสดี"
      }
    }
  ]
}`;

    return (
        <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
            <p>
                ถูกต้องครับ! หลังจากที่คุณเชิญบอทเข้ากลุ่มและพิมพ์ข้อความแล้ว ให้กลับมาที่หน้านี้ (ใน LINE Developers Console) แล้วกดปุ่ม <code className="bg-slate-200 text-slate-800 font-bold px-2 py-1 rounded-md">Verify</code> ตามรูปที่คุณส่งมาครับ
            </p>
            <p className="font-bold text-slate-800">
                เมื่อกดแล้ว ระบบจะแสดงหน้าต่างข้อมูล (เรียกว่า "Request Body") ซึ่งมีหน้าตาคล้ายๆ ด้านล่างนี้:
            </p>

            <div className="bg-slate-900 text-white p-4 rounded-xl font-mono text-xs relative overflow-x-auto">
                <pre>
                    <code dangerouslySetInnerHTML={{ __html: codeSnippet.replace(exampleGroupId, `<span class="bg-yellow-400 text-black px-1 rounded">${exampleGroupId}</span>`) }} />
                </pre>
            </div>
            
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1">
                    <p className="font-bold text-blue-800">
                        สิ่งที่คุณต้องหาคือ <code className="bg-blue-200 px-1.5 py-0.5 rounded">"groupId"</code> ที่มีตัว <code className="bg-blue-200 px-1.5 py-0.5 rounded">C</code> นำหน้าครับ
                    </p>
                    <p className="text-blue-600 text-xs mt-1">
                        คัดลอกค่านี้ไปใส่ใน Cloudflare Worker Settings ได้เลย
                    </p>
                </div>
                <button 
                    onClick={handleCopy}
                    className={`px-4 py-2 rounded-lg font-semibold text-white transition-all w-full md:w-auto ${isCopied ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                    {isCopied ? 'คัดลอกแล้ว!' : 'คัดลอก ID ตัวอย่าง'}
                </button>
            </div>
        </div>
    );
};

export default GroupIdFinder;
