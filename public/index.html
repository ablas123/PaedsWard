<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>PaedsWard - الحل النهائي</title>
    <script src="https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js"></script>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: -apple-system, system-ui, sans-serif;
            background: #f1f5f9;
            padding: 16px;
            max-width: 500px;
            margin: auto;
        }
        .header {
            background: #1a73e8;
            color: white;
            padding: 16px;
            border-radius: 16px 16px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .status-bar {
            background: #e2e8f0;
            padding: 8px 16px;
            font-size: 12px;
            color: #475569;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #cbd5e1;
        }
        .status-bar .online {
            color: #22c55e;
        }
        .status-bar .offline {
            color: #ef4444;
        }
        .content {
            background: white;
            padding: 16px;
            min-height: 60vh;
            border-radius: 0 0 16px 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        }
        .card {
            background: #f8fafc;
            border-right: 4px solid #1a73e8;
            padding: 12px;
            margin-bottom: 8px;
            border-radius: 8px;
        }
        .card .title {
            font-weight: 700;
        }
        button {
            background: #1a73e8;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
        }
        button:active {
            transform: scale(0.96);
        }
        button.secondary {
            background: #e2e8f0;
            color: #1e293b;
        }
        .toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #1e293b;
            color: white;
            padding: 10px 24px;
            border-radius: 30px;
            font-size: 14px;
            z-index: 999;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }
        .flex {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin: 8px 0;
        }
        input,
        textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            margin: 4px 0;
            font-family: inherit;
        }
    </style>
</head>
<body>

    <div id="app">
        <div class="header">
            <span style="font-size:20px;font-weight:800;">🏥 PaedsWard</span>
            <span style="font-size:12px;background:rgba(255,255,255,0.2);padding:4px 12px;border-radius:30px;">حقيقي + ذكي</span>
        </div>

        <div class="status-bar">
            <span id="statusText">⏳ جاري التحميل...</span>
            <span>
                <span id="syncIndicator" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f59e0b;"></span>
                <span id="syncLabel" style="font-size:11px;">محلي</span>
            </span>
        </div>

        <div class="content" id="content">
            <p>جاري تحميل البيانات...</p>
        </div>

        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
            <button onclick="syncNow()">🔄 مزامنة الآن</button>
            <button class="secondary" onclick="addDemoPatient()">➕ إضافة مريض تجريبي</button>
            <button class="secondary" onclick="exportData
