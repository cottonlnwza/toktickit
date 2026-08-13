Lab 1 — การใช้งาน AI และ Reflection

LLM/Agent ที่ใช้: Codex และ ChatGPT

วิธีการใช้งาน AI

ผมเริ่มการทำ Lab 1 โดยเลือกใช้ Codex และ ChatGPT ควบคู่กัน และแบ่งหน้าที่ของ AI ทั้งสองตัวออกจากกันอย่างชัดเจน

ChatGPT

ผมใช้ ChatGPT เป็นตัวช่วยในการทำความเข้าใจโจทย์และวางแผนการทำงาน โดยผมรวบรวมไฟล์ต่าง ๆ ที่อาจารย์ส่งมา รวมถึงเอกสารประกอบการสอน แล้วให้ ChatGPT อ่านและอธิบายโดยละเอียดว่าเนื้อหาทั้งหมดเกี่ยวกับอะไร Lab นี้เรียนเรื่องอะไร Project ที่ต้องทำคืออะไร และแต่ละส่วนมี requirement อย่างไร

ผมกำหนดให้ ChatGPT อธิบายในรูปแบบที่เข้าใจง่าย และยกตัวอย่างให้เห็นภาพ เพื่อให้ผมเข้าใจ requirement ก่อนเริ่มลงมือทำงานจริง

หลังจากนั้นผมใช้ ChatGPT ช่วยสรุปงาน แบ่งงานออกเป็นขั้นตอน และควบคุมไม่ให้การทำงานหลุดออกจาก scope ของ Lab จากนั้นจึงให้ ChatGPT ช่วยสร้าง prompt ที่มีรายละเอียดและข้อจำกัดชัดเจน เพื่อนำไปใช้กับ Codex

Codex

ผมใช้ Codex เป็นตัวช่วยในการ inspect repository และเขียนโค้ดตามขั้นตอนที่ได้วางแผนไว้

ผมไม่ได้ให้ Codex ทำงานทั้งหมดในครั้งเดียว แต่ควบคุมการทำงานแบบ step by step เช่น ให้ตรวจ repository ก่อน ให้รายงานแผนก่อนแก้ไฟล์ แก้เฉพาะ Issue ที่กำลังทำ รัน test/build หลังจากแก้ไข และหยุดรอให้ผมตรวจสอบก่อนทำขั้นตอนถัดไป

หลังจาก Codex ทำงานในแต่ละขั้นตอน ผมจะนำผลกลับมาให้ ChatGPT ช่วยวิเคราะห์อีกครั้งว่าสิ่งที่ทำตรงกับ requirement หรือไม่ มีงานหลุด scope หรือมีจุดที่ต้องแก้ไขเพิ่มเติมหรือไม่

Workflow หลักของผมคือ:

อ่าน requirement → ทำความเข้าใจกับ ChatGPT → วางแผน → สร้าง prompt → ให้ Codex ลงมือ → ตรวจผล → ให้ ChatGPT วิเคราะห์ → ทำขั้นตอนถัดไป

⸻

Selected Key Prompts

Prompt 1 — ตรวจ Requirement ก่อนเริ่ม Issue #2

Prompt

We are now working ONLY on Issue #2: Health Check. Do NOT modify any file yet. Inspect the repository first, including the backend health route, Express structure, frontend Check System button, API call logic, status display, and Vitest/Supertest tests. Then respond with A-I analysis and stop.

นำผลไปใช้อย่างไร

ผมใช้ผลจาก prompt นี้เพื่อตรวจสอบก่อนว่า Issue #2 จำเป็นต้องแก้ไฟล์ใดบ้าง และตรวจว่า Codex เข้าใจ scope ถูกต้องก่อนอนุญาตให้แก้โค้ด

⸻

Prompt 2 — Implement เฉพาะ Issue #2

Prompt

Implement ONLY Issue #2: Health Check. Modify only server/src/app.ts, client/src/api.ts, and client/src/App.tsx. Do not implement category logic. After changes, show files changed, explain changes, show important code sections, and run server tests/build and client tests/build. Do not commit or push.

นำผลไปใช้อย่างไร

ผมตรวจไฟล์ที่ Codex แก้ และตรวจ test/build ก่อนที่จะดำเนินการต่อ เพื่อป้องกันไม่ให้ Codex ทำงานของ Issue อื่นล่วงหน้า

⸻

Prompt 3 — ทำ Category Database และ Seed

Prompt

Implement ONLY Issue #3: Category Database + Seed. Do NOT implement /api/categories or frontend category fetching. Add the Category model, seed exactly Account and Access, Hardware, Software, and Network. Use Prisma upsert so the seed is idempotent. Run prisma validate, migration, seed twice, duplicate verification, server build, and existing tests.

นำผลไปใช้อย่างไร

ผมใช้ prompt นี้เพื่อแยกงาน database ออกจาก API และ frontend และตรวจว่าการ seed ซ้ำไม่ทำให้เกิดข้อมูล duplicate

⸻

Prompt 4 — Inspect ก่อนทำ Issue #4

Prompt

Start ONLY Issue #4: Display the IT Request Category List. Do NOT modify files yet. Inspect server app, Prisma helper, category tests, frontend API, App component, and frontend tests. Report A-I only. No authentication, ticket creation, image upload, Playwright, unrelated refactoring, new dependencies, or pic/ changes.

นำผลไปใช้อย่างไร

ผมใช้ผลจาก Codex เพื่อตรวจ implementation plan ก่อนเริ่มแก้โค้ด และยืนยันว่าไม่มี feature ที่อยู่นอก scope ของ Lab 1

⸻

Prompt 5 — Implement Category List พร้อม Test

Prompt

Implement ONLY Issue #4. Add GET /api/categories through Prisma, return id and name ordered by id, use a safe 500 error, implement Supertest, fetch health then categories in client API, render Online categories and Offline error in App, mock checkSystem in Vitest, run server/client tests and builds, and manually verify Online and Offline behavior.

นำผลไปใช้อย่างไร

ผมตรวจ code, test/build และทดลองหน้าเว็บจริงทั้งกรณี backend ใช้งานได้และใช้งานไม่ได้

⸻

Prompt 6 — ตรวจ Screenshot สำหรับ Submission

Prompt

Review all new screenshots in pic/pic_lab1 using Screenshot / Submission Evidence Review Mode. For each image, mark PASS / CONDITIONAL PASS / FAIL, identify the Issue and Submission Part, explain what it proves and what is missing, and recommend Keep / Retake / Supporting only.

นำผลไปใช้อย่างไร

ผมใช้ผลเพื่อคัดเลือก screenshot ที่ใช้เป็นหลักฐานจริง และถ่ายใหม่ในกรณีที่ภาพเดิมไม่ชัดหรือแสดงข้อมูลไม่ครบ

⸻

Prompt 7 — ตรวจ Peer Review จากข้อมูลจริงบน GitHub

Prompt

Complete reviewer.md using only real GitHub review history. Do not invent reviewer names, PR links, approvals, comments, or responses. Report exact PR URLs, review verdicts, comments, partner responses, evidence sources, and anything unverified.

นำผลไปใช้อย่างไร

ผมใช้ prompt นี้เพื่อป้องกันการใส่ข้อมูล peer review ที่ยังไม่ได้เกิดขึ้นจริง และอัปเดตเอกสารเฉพาะเมื่อมีหลักฐานจาก GitHub แล้วเท่านั้น

⸻

Prompt 8 — จัดทำ Test Documentation

Prompt

Work ONLY on docs/lab-01/tests.md. Inspect the current file, server health/category tests, client App test, and package.json scripts. Use only actual Lab 1 tests that currently exist. Use verified final-main results exactly.

นำผลไปใช้อย่างไร

ผมตรวจว่าเอกสาร tests.md ตรงกับ test files และผล test/build จริงก่อนยอมรับการแก้ไข

⸻

Prompt 9 — ใช้ ChatGPT ช่วยตีความ Requirement ของ AI Documentation

Prompt ที่ผมพิมพ์จริง

อาจารญืเขาอยากได้ข้อมูลว่าเราสั่งงานเอไอมันยังไงมีพ้อมในลักษณะไหนมากกว่า

นำผลไปใช้อย่างไร

ผมใช้คำตอบของ ChatGPT เพื่อปรับ ai_use.md จากการอธิบายแบบกว้าง ๆ ให้แสดง prompt ที่ใช้จริง และบอกว่าผมนำผลจาก AI ไปใช้อย่างไร

⸻

Prompt 10 — ตรวจความครบถ้วนของ Test Documentation

Prompt ที่ผมพิมพ์จริง

แล้วไฟล์ testหล่ะ

Follow-up

เพืิ่มเนื้่อหาในtestให้สอดคล้องด้วย

นำผลไปใช้อย่างไร

ผมใช้ ChatGPT ช่วยตรวจว่า tests.md ยังขาดอะไร และเพิ่ม mapping ระหว่าง test files กับ behavior ที่ test ตรวจสอบ โดยไม่แก้ไขผล test จริง

⸻

Reflection

จากการทำ Lab นี้ ผมพบว่าการเขียน prompt ให้มีขอบเขตชัดเจน เช่น “ONLY Issue #…”, “inspect first”, “do not modify” และ “stop for approval” ช่วยลดปัญหาที่ AI ทำงานเกิน scope และทำให้ผมสามารถตรวจสอบงานได้ทีละขั้นตอน

มีหลายครั้งที่ผมไม่ได้ยอมรับผลจาก AI ทันที ตัวอย่างหนึ่งคือเรื่อง peer review ซึ่งในช่วงแรก AI ยังไม่พบหลักฐาน reciprocal review ของผมบน GitHub ผมจึงไม่ให้ใส่ข้อมูลนั้นลงใน reviewer.md จนกว่าจะมีการ review เกิดขึ้นจริงและสามารถตรวจสอบจาก GitHub ได้

อีกกรณีหนึ่งคือ Git workflow ของ documentation branch ซึ่งตอนแรก branch ถูกสร้างต่อจาก main ทำให้มี commit history ที่ไม่ตรงกับ workflow ที่ต้องการ ผมจึงไม่ merge PR นั้น และสร้าง branch ใหม่จาก lab1-staging ก่อนนำเฉพาะไฟล์ documentation ที่ต้องการมาใส่ใหม่

จากประสบการณ์นี้ ผมเรียนรู้ว่า AI เหมาะสำหรับช่วยวิเคราะห์ วางแผน ตรวจสอบ และ implement งาน แต่ผมยังต้องเป็นคนตรวจ repository, test/build, Git history และผลลัพธ์จริงก่อนตัดสินใจยอมรับงานในแต่ละขั้นตอน