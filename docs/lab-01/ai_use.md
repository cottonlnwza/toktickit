Lab 1 — การใช้งาน AI และ Reflection

LLM/Agent ที่ใช้: Codex และ ChatGPT

แนวทางการใช้งาน AI

ผมเริ่มการทำ Lab 1 โดยเลือกใช้ Codex และ ChatGPT ควบคู่กัน แต่แบ่งหน้าที่ของ AI ทั้งสองตัวออกจากกันอย่างชัดเจน เพื่อให้ผมยังสามารถควบคุมขอบเขตของงานและเข้าใจสิ่งที่กำลังทำในแต่ละขั้นตอนได้

การใช้งาน ChatGPT

ผมใช้ ChatGPT เป็นตัวช่วยหลักในการ ทำความเข้าใจโจทย์และวางแผนการทำงาน โดยผมรวบรวมไฟล์ต่าง ๆ ที่อาจารย์ส่งมา เช่น Lab Sheet, Glossary, Git/GitHub Cheat Sheet และเอกสารประกอบการเรียน แล้วให้ ChatGPT อ่านและอธิบายเนื้อหาโดยละเอียดว่า

* Lab นี้เรียนเกี่ยวกับอะไร
* Project ที่อาจารย์ให้ทำคืออะไร
* แต่ละ Issue ต้องทำอะไรบ้าง
* มีข้อกำหนดหรือข้อห้ามอะไร
* Git/GitHub workflow ต้องทำตามลำดับอย่างไร
* ต้องเก็บหลักฐานอะไรสำหรับส่งงาน

ผมกำหนดให้ ChatGPT อธิบายเนื้อหาในรูปแบบที่เข้าใจง่าย และยกตัวอย่างให้เห็นภาพ เพื่อให้ผมเข้าใจ requirement ก่อนเริ่มเขียนโค้ดจริง

หลังจากเข้าใจงานแล้ว ผมใช้ ChatGPT ช่วย แยกงานออกเป็นขั้นตอนย่อยและควบคุม scope เช่น ให้ทำทีละ Issue, ห้ามทำงานของ Issue ถัดไปล่วงหน้า, ตรวจ requirement ก่อนแก้ไฟล์ และหยุดรอให้ผมตรวจสอบก่อนดำเนินการขั้นต่อไป

จากนั้น ChatGPT จะช่วยสร้าง prompt ที่มีรายละเอียดและข้อจำกัดชัดเจน เพื่อนำไปใช้สั่ง Codex

การใช้งาน Codex

ผมใช้ Codex เป็นตัวช่วยหลักในการ ตรวจ repository และลงมือเขียนโค้ด

Codex จะทำงานตามขั้นตอนและขอบเขตที่กำหนดไว้จากการวางแผนกับ ChatGPT เช่น

1. ตรวจสอบ repository ก่อนแก้ไข
2. รายงานว่าจะต้องแก้ไฟล์ใดบ้าง
3. หยุดรอการตรวจสอบก่อนเริ่มแก้
4. แก้เฉพาะ Issue ที่กำลังทำ
5. ห้ามแก้ไฟล์หรือ feature ที่อยู่นอกขอบเขต
6. รัน test และ build หลังจากแก้ไข
7. รายงานผลลัพธ์และไฟล์ที่เปลี่ยนแปลง

ผมไม่ได้ปล่อยให้ Codex ทำงานทั้งหมดต่อเนื่องโดยอัตโนมัติ แต่ควบคุมการทำงาน ทีละขั้นตอน (step by step)

หลังจาก Codex ทำงานในแต่ละขั้นเสร็จ ผมจะนำผลที่ได้กลับมาให้ ChatGPT ช่วยวิเคราะห์อีกครั้งว่า สิ่งที่ Codex ทำตรงกับ requirement ของอาจารย์หรือไม่ มีงานหลุด scope หรือไม่ และยังมีสิ่งใดที่ต้องตรวจสอบเพิ่มเติม

ดังนั้น workflow หลักของผมคือ

อ่าน requirement → ทำความเข้าใจกับ ChatGPT → วางแผน → สร้าง prompt → ให้ Codex ลงมือ → ตรวจผล → ส่งผลกลับให้ ChatGPT วิเคราะห์ → ทำขั้นตอนถัดไป

⸻

Selected AI Prompts

Prompt 1 — วางแผน Issue #2 และล็อกขอบเขตงาน

Prompt text

We are now working ONLY on Issue #2: Health Check. Do NOT modify any file yet. Inspect the repository first, including the backend health route, Express structure, frontend Check System button, API call logic, status display, and Vitest/Supertest tests. Then respond with A-I analysis and stop.

จุดประสงค์

ผมใช้ prompt นี้เพื่อให้ Codex ตรวจสอบโครงสร้างของ project ก่อนลงมือแก้ไข และกำหนดชัดเจนว่ากำลังทำเฉพาะ Issue #2 เท่านั้น

สิ่งที่ผมทำกับผลลัพธ์

ผมตรวจสอบแผนที่ Codex รายงานออกมาก่อนอนุญาตให้แก้ไฟล์ และใช้ผลนั้นตรวจสอบว่าจำเป็นต้องแก้ไฟล์ใดบ้าง

⸻

Prompt 2 — Implement Issue #2 แบบขั้นต่ำและตรวจสอบผล

Prompt text

Implement ONLY Issue #2: Health Check. Modify only server/src/app.ts, client/src/api.ts, and client/src/App.tsx. Do not implement category logic. After changes, show files changed, explain changes, show important code sections, and run server tests/build and client tests/build. Do not commit or push.

จุดประสงค์

ผมใช้ prompt นี้เพื่อให้ Codex implement Health Check โดยไม่ทำงานของ Issue #3 หรือ Issue #4 ล่วงหน้า

สิ่งที่ผมทำกับผลลัพธ์

ผมตรวจสอบไฟล์ที่ถูกแก้ ตรวจ code สำคัญ และตรวจผล test/build ก่อนเก็บหลักฐานและดำเนินการต่อ

⸻

Prompt 3 — สร้าง Category Database และ Seed สำหรับ Issue #3

Prompt text

Implement ONLY Issue #3: Category Database + Seed. Do NOT implement /api/categories or frontend category fetching. Add the Category model, seed exactly Account and Access, Hardware, Software, and Network. Use Prisma upsert so the seed is idempotent. Run prisma validate, migration, seed twice, duplicate verification, server build, and existing tests.

จุดประสงค์

ผมใช้ prompt นี้เพื่อแยกงาน database/schema ของ Issue #3 ออกจากงาน API และ frontend ของ Issue #4

สิ่งที่ผมทำกับผลลัพธ์

ผมตรวจ migration และการ seed โดยเฉพาะการรัน seed ซ้ำสองครั้งเพื่อยืนยันว่าไม่มีข้อมูล category ซ้ำ

⸻

Prompt 4 — วางแผน Issue #4 ก่อนแก้โค้ด

Prompt text

Start ONLY Issue #4: Display the IT Request Category List. Do NOT modify files yet. Inspect server app, Prisma helper, category tests, frontend API, App component, and frontend tests. Report A-I only. No authentication, ticket creation, image upload, Playwright, unrelated refactoring, new dependencies, or pic/ changes.

จุดประสงค์

ผมใช้ prompt นี้เพื่อให้ Codex inspect code ก่อน และป้องกันไม่ให้ทำ feature ที่ยังไม่อยู่ใน scope ของ Lab 1

สิ่งที่ผมทำกับผลลัพธ์

ผมตรวจสอบแผนก่อนเริ่ม implementation และยืนยันว่าใช้ Category model และ seed จาก Issue #3 ที่มีอยู่แล้ว

⸻

Prompt 5 — Implement Issue #4 พร้อม Test และ Manual Verification

Prompt text

Implement ONLY Issue #4. Add GET /api/categories through Prisma, return id and name ordered by id, use a safe 500 error, implement Supertest, fetch health then categories in client API, render Online categories and Offline error in App, mock checkSystem in Vitest, run server/client tests and builds, and manually verify Online and Offline behavior.

จุดประสงค์

ผมใช้ prompt นี้เพื่อ implement การแสดง Category แบบ end-to-end ตั้งแต่ PostgreSQL/Prisma, Express API ไปจนถึง React frontend

สิ่งที่ผมทำกับผลลัพธ์

ผมตรวจ code, ผล test, build และทดลองหน้าเว็บจริงทั้งกรณี backend ใช้งานได้และ backend ใช้งานไม่ได้

⸻

Prompt 6 — ตรวจ Screenshot สำหรับ Submission

Prompt text

Review all new screenshots in pic/pic_lab1 using Screenshot / Submission Evidence Review Mode. For each image, mark PASS / CONDITIONAL PASS / FAIL, identify the Issue and Submission Part, explain what it proves and what is missing, and recommend Keep / Retake / Supporting only. Rename only PASS images using the established naming convention. Do not modify code or delete screenshots.

จุดประสงค์

ผมใช้ prompt นี้เพื่อช่วยตรวจหลักฐานก่อนส่งงาน แทนที่จะเก็บ screenshot ทุกภาพโดยไม่รู้ว่าแต่ละภาพพิสูจน์ requirement ใด

สิ่งที่ผมทำกับผลลัพธ์

ผมเก็บภาพที่สามารถใช้เป็นหลักฐานได้จริง และถ่ายใหม่ในกรณีที่ภาพเดิมแสดงข้อมูลไม่ครบหรือไม่ชัดเจน

⸻

Prompt 7 — ตรวจหลักฐาน Peer Review จาก GitHub

Prompt text

Complete reviewer.md using only real GitHub review history. Do not invent reviewer names, PR links, approvals, comments, or responses. Search GitHub for PRs authored by @Tanaboonnnnn that were reviewed/commented/approved by @cottonlnwza. Use GitHub API/CLI if available. Report exact PR URLs, review verdicts, comments, partner responses, evidence sources, and anything unverified.

จุดประสงค์

ผมใช้ prompt นี้เพราะข้อมูล peer review ต้องตรงกับสิ่งที่เกิดขึ้นจริงบน GitHub และไม่ควรสร้างข้อมูลขึ้นเอง

สิ่งที่ผมทำกับผลลัพธ์

เมื่อพบว่าตอนแรกยังไม่มีหลักฐาน reciprocal review จริง ผมไม่ได้ใส่ข้อมูลนั้นลงเอกสาร จนกว่าจะมีการ review เกิดขึ้นจริงบน GitHub

⸻

Prompt 8 — จัดทำเอกสาร Test จากผลจริง

Prompt text

Work ONLY on docs/lab-01/tests.md. Inspect the current file, server health/category tests, client App test, and package.json scripts. Use only actual Lab 1 tests that currently exist. Use verified final-main results exactly: server 2 test files passed, 2 tests passed, build tsc passed; client 1 test file passed, 3 tests passed, build tsc && vite build passed. Stop after proposing content.

จุดประสงค์

ผมใช้ prompt นี้เพื่อให้เอกสาร test อ้างอิงเฉพาะ test ที่มีอยู่จริงใน project และผลที่ตรวจสอบแล้ว

สิ่งที่ผมทำกับผลลัพธ์

ผมตรวจสอบว่า test table และผลลัพธ์ตรงกับ test files และ terminal output ที่เกิดขึ้นจริงก่อนยอมรับการแก้ไข

⸻

Prompt 9 — ใช้ ChatGPT ช่วยตีความสิ่งที่อาจารย์ต้องการจาก AI Documentation

Prompt text จริงที่ผมพิมพ์กับ ChatGPT

อาจารญืเขาอยากได้ข้อมูลว่าเราสั่งงานเอไอมันยังไงมีพ้อมในลักษณะไหนมากกว่า

จุดประสงค์

ผมใช้ ChatGPT ช่วยตรวจสอบว่าหัวข้อ AI Use ที่อาจารย์ต้องการควรเป็นเพียงการบอกว่าใช้ AI ทำอะไร หรือควรแสดงรูปแบบ prompt ที่ใช้สั่ง AI จริง ๆ

สิ่งที่ผมทำกับผลลัพธ์

จากคำอธิบายที่ได้ ผมปรับเอกสาร ai_use.md จากเดิมที่เป็นเพียง prompt แบบสรุป ให้แสดง prompt text, จุดประสงค์ และสิ่งที่ผมทำกับผลลัพธ์ของ AI อย่างชัดเจน

⸻

Prompt 10 — ใช้ ChatGPT ตรวจความครบถ้วนของ Test Documentation

Prompt text จริงที่ผมพิมพ์กับ ChatGPT

แล้วไฟล์ testหล่ะ

Follow-up จริง

เพืิ่มเนื้่อหาในtestให้สอดคล้องด้วย

จุดประสงค์

ผมใช้ ChatGPT ตรวจสอบว่า tests.md ถูกนำมารวมใน documentation workflow ครบหรือไม่ และควรเพิ่มเนื้อหาอะไรเพื่อให้ตรงกับ test จริงใน project

สิ่งที่ผมทำกับผลลัพธ์

ผมเพิ่มข้อมูลใน tests.md ให้แสดงว่าแต่ละ test อยู่ในไฟล์ใด ตรวจสอบ behavior อะไร และยังคงใช้ผล test/build ที่เกิดขึ้นจริงโดยไม่ได้สร้างผลลัพธ์ใหม่ขึ้นมา

⸻

Reflection

จากการทำ Lab นี้ ผมพบว่าการใช้ AI ให้มีประสิทธิภาพไม่ได้ขึ้นอยู่กับการสั่งให้ AI “ทำงานให้เสร็จ” เพียงอย่างเดียว แต่ขึ้นอยู่กับการกำหนดขอบเขตและลำดับการทำงานให้ชัดเจนด้วย

การใช้คำสั่ง เช่น “ONLY Issue #…”, “inspect first”, “do not modify” และ “stop for approval” ช่วยให้ผมสามารถควบคุมการทำงานของ Codex และลดโอกาสที่ AI จะทำงานเกิน scope

ผมยังพบว่าผลลัพธ์จาก AI ไม่ควรถูกนำมาใช้ทันทีโดยไม่ตรวจสอบ ผมจึงตรวจ test/build, repository state, GitHub history และผลลัพธ์บนหน้าเว็บจริงก่อนยอมรับงานในแต่ละขั้นตอน

การใช้ ChatGPT และ Codex แยกหน้าที่กันช่วยให้ผมทำงานได้เป็นระบบมากขึ้น โดย ChatGPT ช่วยในด้านการทำความเข้าใจ requirement, การวางแผน และการตรวจสอบ ส่วน Codex ช่วยในการ inspect repository และ implement code ตามขอบเขตที่กำหนด สุดท้ายผมยังเป็นคนควบคุมการตัดสินใจและดำเนินการแต่ละขั้นตอนด้วยตนเอง