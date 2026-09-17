# NST Keyboard Shortcut & Command Architecture Governance

> **มาตรฐานการจัดการคีย์ลัดและคำสั่งส่วนกลาง (Central Command & Keybinding Standard)**  
> รองรับคีย์ลัดระดับร้อยคำสั่ง ครอบคลุมผู้ใช้ทุกภาษาในโลก (100% W3C Hardware Code Standard) ปราศจากการ Hardcode ภาษา และมีระบบตรวจจับบั๊กอัตโนมัติ

---

## 1. กฎเหล็ก 5 ข้อของระบบคีย์ลัด (The 5 Golden Rules)

1. **ห้ามเขียน `addEventListener('keydown', ...)` ใน Component เด็ดขาด**
   * ระบบมี Single Event Listener ประจำอยู่ที่ Root (`CommandProvider`) จุดเดียว
   * หากฝ่าฝืน `npm run check:ui` จะตรวจพบและตีเป็น **ERROR ทันที**
2. **ห้ามตรวจจับด้วย `e.key === 'x'` สำหรับคีย์ลัดที่กดร่วมกับ `Ctrl`, `Alt`, หรือ `Meta`**
   * เพราะ `e.key` จะเปลี่ยนค่าตามภาษาแป้นพิมพ์ของผู้ใช้ (เช่น กด `F` ตอนแป้นไทยจะได้ `"ด"`, รัสเซียจะได้ `"а"`)
   * ระบบถอดรหัสส่วนกลางจะแปลงเป็น **Physical Hardware Key Code (`e.code`)** เช่น `"KeyF"`, `"KeyO"`, `"Enter"` โดยอัตโนมัติ
3. **ลงทะเบียนคีย์ลัดผ่าน `useCommands()` เสมอ**
   * เพื่อให้คีย์ลัดถูกผูก (Register) และปลด (Unregister) อัตโนมัติตาม Lifecycle ของหน้าจอ ไม่ให้มีคีย์ลัดค้างหรือเกิด Memory Leak
4. **กำหนด Scope เสมอหากเป็นคีย์ลัดเฉพาะหน้า**
   * คีย์ลัดของแอปพลิเคชันภาพรวม = `scope: "global"`
   * คีย์ลัดเฉพาะหน้าตารางข้อความ = `scope: "editor"`
   * เพื่อป้องกันไม่ให้คำสั่งข้ามหน้าทำงานทับซ้อนกันเมื่อแอปเติบโตขึ้น
5. **ระบุ `preventInInput: true` (ค่าเริ่มต้น) สำหรับคีย์ลัดตัวอักษร**
   * เพื่อป้องกันไม่ให้คีย์ลัดทำงานกวนเวลาผู้ใช้กำลังพิมพ์ข้อความใน `<input>` หรือ `<textarea>` (ยกเว้นคำสั่งเฉพาะ เช่น `Ctrl+Enter` หรือ `Escape` ที่อนุญาตให้ระบุ `preventInInput: false`)

---

## 2. วิธีใช้งานใน Component

### การลงทะเบียนคำสั่งทั่วไป (`useCommands`)

```tsx
import { useCommands, useActiveScope } from "@/lib/commands";

export const MyFeatureComponent = () => {
  // 1. ระบุ Scope ให้กับหน้านี้ (จะคืนค่า Scope เดิมให้อัตโนมัติเมื่อปิดหน้านี้)
  useActiveScope("my-feature");

  // 2. ลงทะเบียนคำสั่ง
  useCommands([
    {
      id: "my-feature.save",
      title: "Save Changes",
      category: "Feature",
      keybinding: "Ctrl+S",
      scope: "my-feature",
      run: () => handleSave(),
    },
    {
      id: "my-feature.refresh",
      title: "Refresh Data",
      keybinding: "Ctrl+R",
      scope: "my-feature",
      when: () => isReadyToRefresh, // ตรวจสอบเงื่อนไขก่อนรัน
      run: () => handleRefresh(),
    },
  ]);

  return <div>...</div>;
};
```

---

## 3. วิธีการดีบั๊กและตรวจสอบบั๊ก (Debugging & Diagnostics)

เมื่อมีผู้ใช้รายงานว่า *"คีย์ลัดปุ่มนี้กดไม่ติด"* สามารถตรวจสอบได้ทันทีภายใน 10 วินาทีผ่าน **Browser DevTools Console (F12 หรือ Inspect)**:

### 1. เปิดโหมด Debug Console
พิมพ์คำสั่งนี้ใน Console ของ DevTools:
```js
__NST_COMMANDS__.setDebug(true)
```
หรือตั้งค่าแบบ Global Flag:
```js
window.__NST_KEYBINDINGS_DEBUG__ = true
```

### 2. ดู Log วิเคราะห์การกดปุ่มแบบ Real-time
เมื่อกดปุ่มบนคีย์บอร์ด ระบบจะแสดง Log บอกสถานะทุกอย่างแบบละเอียด เช่น:
```text
[NST Shortcut Triggered] command='editor.find' keybinding='Ctrl+F' scope='editor' (hardware code='KeyF', printed key='ด')
```
หรือหากปุ่มไม่ทำงาน Console จะบอกเหตุผลทันที:
* `[NST Shortcut Suppressed in Input]` ➔ คีย์ลัดถูกระงับเพราะผู้ใช้กำลังพิมพ์อยู่ใน Textbox
* `[NST Shortcut Guard Failed]` ➔ ฟังก์ชัน `when()` คืนค่า `false` ทำให้คำสั่งไม่ทำงาน
* `[NST Shortcut Unmatched]` ➔ ไม่มีคำสั่งใดที่ผูกไว้กับคีย์หรือ Scope ปัจจุบัน

### 3. ตรวจสอบและทดสอบคำสั่งทั้งหมดในระบบ
```js
// ดูรายการคำสั่งและคีย์ลัดทั้งหมดที่กำลังทำงานอยู่
console.table(__NST_COMMANDS__.getAll());

// บังคับรันคำสั่งโดยตรงเพื่อทดสอบว่าฟังก์ชันทำงานปกติหรือไม่
__NST_COMMANDS__.execute("file.open-game");
```

---

## 4. ตารางรูปแบบคีย์ลัดที่รองรับ (Keybinding Syntax)

| รูปแบบ | ตัวอย่าง | คำอธิบาย |
|---|---|---|
| Modifiers | `Ctrl+...`, `Shift+...`, `Alt+...`, `Cmd+...` | รองรับทั้งปุ่มซ้ายและขวา |
| ตัวอักษรเดี่ยว | `Ctrl+O`, `Ctrl+Shift+O`, `Ctrl+F` | อิงพิกัดฮาร์ดแวร์สากล ไม่ขึ้นกับภาษาที่พิมพ์ |
| ปุ่มฟังก์ชัน | `F1`, `F2`, `F12` | คีย์ลัดฟังก์ชัน |
| ปุ่มพิเศษ | `Enter`, `Escape`, `Tab`, `Space`, `Backspace` | รองรับ NumpadEnter ด้วย |
| เครื่องหมาย | `Ctrl+,`, `Ctrl+.`, `Ctrl+/`, `Ctrl+-` | ปุ่มเครื่องหมายวรรคตอน |

---

## 5. Automated CI Audit
ทุกครั้งที่มีการรัน:
```bash
npm run check:ui
```
ระบบจะสแกนโค้ดทั้งโปรเจกต์ด้วย AST หากมีใครเผลอเขียน `addEventListener("keydown")` จะแจ้งเตือน Category: **`9. Keyboard Shortcut Governance (@/commands)`** ทันที
