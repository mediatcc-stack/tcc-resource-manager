
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Critical Error: Could not find root element to mount the application.");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
                <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    );

    // ลงทะเบียน Service Worker เพื่อให้เพิ่มเว็บลงหน้าจอหลักของโทรศัพท์ได้
    // (ตัว SW ไม่แคชอะไรเลย — ดูคำอธิบายใน public/sw.js)
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.warn('Service Worker registration failed:', err);
        });
      });
    }
  } catch (error) {
    console.error("Application Render Error:", error);
    rootElement.innerHTML = `
      <div style="padding: 20px; color: white; text-align: center; font-family: Sarabun, sans-serif;">
        <h2>เกิดข้อผิดพลาดในการโหลดระบบ</h2>
        <p>กรุณาตรวจสอบ Console หรือติดต่อผู้ดูแลระบบ</p>
        <button onclick="location.reload()" style="padding: 10px 20px; border-radius: 8px; border: none; background: #0D448D; color: white; cursor: pointer;">ลองใหม่อีกครั้ง</button>
      </div>
    `;
  }
}