# Lab 1 — Peer Review Record

**Author:** Thanakorn Soison — 67070507205 — GitHub: @cottonlnwza
**Peer reviewer:** Tanboon Teawsawat — 67070507211 — GitHub: @Tanaboonnnnn

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Reviewer verdict |
|----|--------|------------------|
| [#2](https://github.com/cottonlnwza/toktickit/pull/2) | feature/1-project-foundation | APPROVED |
| [#3](https://github.com/cottonlnwza/toktickit/pull/3) | feature/2-health-check | APPROVED |
| [#5](https://github.com/cottonlnwza/toktickit/pull/5) | feature/3-category-seed | APPROVED |
| [#7](https://github.com/cottonlnwza/toktickit/pull/7) | feature/4-category-list | APPROVED |

Reviewer comment <client build / dev start ผ่าน
server build / dev start ผ่าน
Prisma validate / DB connect ผ่าน
Vitest configured มี
Supertest configured มี
README มี
.env ไม่ commit ผ่าน
server health test → 501 ผ่านสำหรับissue1>

How I responded: <ได้ทำการmergeเข้ากับlab1-staging เรียบร้อยแล้วครับ>

## Pull Requests I reviewed for my partner

Thanakorn Soison — 67070507205 — GitHub: @cottonlnwza
My comment: <ตรวจ PR #10 แล้วครับ โดยรวม implementation ของ Lab 1 ครบและตรงตาม requirement หลัก

GET /api/health คืน HTTP 200 พร้อม status: ok และ service: TokTickIT API
GET /api/categories ดึงข้อมูลจาก PostgreSQL ผ่าน Prisma และเรียงตาม id
Seed ใช้ upsert ทำให้สามารถรันซ้ำได้โดยไม่สร้างข้อมูลซ้ำ
Frontend มี Online / Offline state และแสดง Category จาก API
มี Backend และ Frontend tests ตาม Lab 1
README อธิบายการติดตั้ง Database, Environment, การรันระบบ และ Tests ค่อนข้างครบ
แต่พบจุดที่ควรแก้ใน docs/lab-01/reviewer.md ก่อน merge:

Labsheet กำหนดให้ระบุ Student ID ของ reviewer แต่ตอนนี้มีเพียงชื่อและ GitHub username
GitHub username ของ reviewer คนแรกเขียนไม่ตรงกัน (@L0u1ss และ @L0u1sss) ควรแก้ให้เป็น username ที่ถูกต้องเหมือนกันทั้งไฟล์
ในส่วน Partner response ยังเป็น [-] ควรเพิ่ม response จริงจาก partner หลังจากได้รับ review comment เพื่อใช้เป็นหลักฐานตาม requirement
แนะนำให้ตรวจสอบว่า Final PR จาก lab1-staging → main ถูกบันทึกในหลักฐาน PR สำหรับรายงานเรียบร้อยแล้ว
หลังจากแก้ส่วน Peer Review Evidence ครบแล้ว ส่วนอื่นของ PR พร้อมสำหรับการ Approve ครับ>
Chartanat upthaipiboon , Chxtamos
Partner's response: <1.ไม่อยากแสดง Student ID ใน Public Repository เพื่อป้องกันการเปิดเผยข้อมูลส่วนบุคคล โดยจะระบุเฉพาะในไฟล์ PDF ที่ส่งผ่านระบบรายวิชาเท่านั้น
2.เเก้ไขเรียบร้อยเเล้ว
3.ในส่วน Partner response ไม่จำเป็นต้องใส่ก็ได้
4.Final PR จาก lab1-staging → main ถูกบันทึกในหลักฐาน PR สำหรับรายงานเรียบร้อยแล้ว รอการ Approve>








