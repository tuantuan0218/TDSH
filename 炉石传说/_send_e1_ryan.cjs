// E1 实证+修法锚点：投 Ryan（inform 直达，他现在正在改预算门段）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const body = [
  '【E1 实证+修法锚点：零错误≠能打出 → 预算门放行孔径（你正在改的那段）】',
  '1. 铁证（03:56:08-03:56:11）：03:56:08 SDK 已知 9 水晶（Player.kt:85 玩家1已使用9法力水晶）；03:56:10 TIME_213 eid12（cost=2 余=0）exec 实名零错误硬放点击 → 半落地（诊断=余费不足）；同秒 CATA_565 eid19（cost=2 余=0）同路径硬放 → 半落地。entityErrors=NONE 相对宽松（不拒绝≠可执行），零错误卡硬放也会半落地。',
  '2. 根因=E1：turnMana 只在 executeOutCard 起点采样（L168）+ L188 自愈只取 usableResource 最大——但 SDK 回合初读数 stale（读到 0/2），spent 同步扣减后 budgetRemaining 恒 0/负，后续 exec 实名放行的卡真实费不够 → 硬放点击 → 半落地。不是『该不该打』问题，是『入场顺序（TIME_213 先放→余=0→CATA_565 也放）+ 预算读数』双错。',
  '3. 修法锚点（直接融进你正在写的预算门块，三选一最小侵入）：(a) L188 自愈加一条：usableResource 读数跳增 ≥3（补满特征）→ turnMana 取新值且清空 spent（新回合开始，旧账作废）；(b) 出牌前若 budgetRemaining()==0 但 usableResource>0 → 本轮直接取 usableResource-spent 替代 budgetRemaining()[一次性，不跨轮]；(c) 零错误硬放的卡：第一发用 waitLanded(SYNC_MS=800) 而非长窗，未落地即半落地（别重进恢复轮转裸power 白烧 2.4s×）。',
  '4. 证据：node _drill_eid.cjs 12,19 看 03:56:10 双半落地；grep 行为类-解析卡牌 03:41→04:25 窗 47 行（半落地主角 CATA_568/565/497/722/学徒全在行为失败名单）→ 行为 fallback 失败+预算硬放 = 半落地族的双上游。',
  '5. 验收：03:56:10 同型『余=0 硬放双半落地』全窗 =0；turnMana 自愈触发行（含跳增前值→新值）可 grep 验证。',
  '（你现在看的 L962-980；02 节的神剑一那块 read 也可复用。你按五修计划先推主线，E1 按 3(a) 一行补 turnMana 自愈即可，不阻塞 m2v194 交付节奏。）'
].join('\n');
const msg = { to: 'ryan-mtvy0jjp', act: 'inform', subject: '【E1实证+锚点】零错误≠能打出：03:56:10余=0双硬放半落地→turnMana补满自愈(一行补)', body };
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id);
