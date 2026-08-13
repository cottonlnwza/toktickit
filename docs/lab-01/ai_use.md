Lab 1 — การใช้งาน AI และ Reflection

LLM/Agent ที่ใช้: Codex และ ChatGPT

ผมใช้ ChatGPT และ Codex ควบคู่กัน โดย ChatGPT ใช้สำหรับอ่านเอกสารของอาจารย์ อธิบาย requirement ให้เข้าใจง่าย วางแผนงาน แบ่ง scope และสร้าง prompt สำหรับใช้กับ Codex ส่วน Codex ใช้สำหรับ inspect repository และ implement code ตามขั้นตอนที่กำหนด

ผมควบคุมการทำงานแบบ step by step โดยให้ Codex ตรวจ repository และเสนอแผนก่อนแก้ไฟล์ จากนั้นจึง implement เฉพาะ Issue ที่กำลังทำ รัน test/build และส่งผลกลับมาให้ผมตรวจสอบร่วมกับ ChatGPT ก่อนทำขั้นตอนต่อไป

Workflow:
อ่าน requirement → ทำความเข้าใจกับ ChatGPT → วางแผน → สร้าง prompt → ให้ Codex ลงมือ → ตรวจผล → วิเคราะห์อีกครั้ง → ทำขั้นตอนถัดไป

Selected Key Prompts

1. Issue #2 Planning

We are now working ONLY on Issue #2: Health Check. Do NOT modify any file yet. Inspect the repository first… Then respond with A-I analysis and stop.

ใช้เพื่อตรวจ scope และไฟล์ที่ต้องแก้ก่อนเริ่ม implement

2. Issue #2 Implementation

Implement ONLY Issue #2: Health Check… run server tests/build and client tests/build. Do not commit or push.

ใช้เพื่อ implement เฉพาะ Health Check และตรวจ test/build

3. Issue #3 Category Seed

Implement ONLY Issue #3: Category Database + Seed… Use Prisma upsert… seed twice, duplicate verification…

ใช้แยกงาน database/seed ออกจาก API และ frontend

4. Issue #4 Planning

Start ONLY Issue #4… Do NOT modify files yet… No authentication, ticket creation, image upload, Playwright…

ใช้ตรวจ implementation plan และป้องกันงานหลุด scope

5. Issue #4 Implementation

Implement ONLY Issue #4. Add GET /api/categories through Prisma… run server/client tests and builds…

ใช้ implement category list แบบ end-to-end และตรวจทั้ง Online/Offline

6. Screenshot Evidence Review

Review all new screenshots in pic/pic_lab1… mark PASS / CONDITIONAL PASS / FAIL…

ใช้คัดเลือก screenshot ที่เหมาะสำหรับ submission

7. Peer Review Verification

Complete reviewer.md using only real GitHub review history. Do not invent reviewer names, PR links, approvals, comments, or responses.

ใช้ตรวจสอบ peer review จากข้อมูลจริงก่อนบันทึกลงเอกสาร

8. Test Documentation

Work ONLY on docs/lab-01/tests.md… Use only actual Lab 1 tests that currently exist.

ใช้จัดทำ tests.md จาก test และผล build ที่มีอยู่จริง

9. ChatGPT — AI Documentation

อาจารย์เขาอยากได้ข้อมูลว่าเราสั่งงานเอไอมันยังไงมีพ้อมในลักษณะไหนมากกว่า

ใช้เพื่อปรับ ai_use.md ให้แสดง prompt และวิธีนำผล AI ไปใช้จริง

10. ChatGPT — Test Documentation

แล้วไฟล์ testหล่ะ
เพืิ่มเนื้่อหาในtestให้สอดคล้องด้วย

ใช้ตรวจและเพิ่มรายละเอียดใน tests.md ให้ตรงกับ test files จริง

Reflection

การกำหนด prompt ให้มีขอบเขตชัดเจน เช่น “ONLY Issue #…”, “inspect first” และ “stop for approval” ช่วยลดงานเกิน scope และทำให้ผมตรวจสอบได้ทีละขั้นตอน

ผมไม่ได้ยอมรับผลจาก AI ทันทีทุกครั้ง เช่น กรณี peer review ที่ยังไม่มีหลักฐานจริง และ Git workflow ของ documentation branch ที่ผิด ผมจึงหยุด แก้ไข และตรวจสอบข้อมูลจริงก่อนดำเนินการต่อ

จาก Lab นี้ผมเรียนรู้ว่า AI ช่วยวิเคราะห์ วางแผน และ implement งานได้ดี แต่ผู้ใช้ยังต้องตรวจ repository, test/build และ Git history ก่อนยอมรับผลลัพธ์ทุกครั้ง