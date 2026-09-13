// 补发给 god：池恢复后优先消化『穷局动作结束回合门线』+可执行规格（token-frugal，引用文件不贴码）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';

const body = [
  '接上条（13:35 直令）。本席核查 god 会话：自 13:26Z 起四次心跳唤醒全部失败（tuan 池 400 balance=0 + 429 并发超限），故本条为规格预置，池恢复后请优先消化本任务。',
  '',
  '现状锚点（供 Ryan 直接落地，勿重复调研）：',
  '- 在役源码树：D:\\tdsh\\hs_bridge_build\\drawfix\\src\\main\\kotlin\\lin\\drawfix\\',
  '- 穷尽判定链（m2v191）：OptionsGate.actionsAvailable() 末块可执行 POWER → DrawFixStrategy ④ 段穷尽自门（L486-500）→ idleRounds>=2 即收工（L539-540，m2v186 提速）→ actuator 结束回合。',
  '- 已实现：穷尽即收（m2v188①+m2v189 剔集）✅；2 轮确认收工 ✅。',
  '- 视觉轨 EndTurnGate 恒 null（m2v178 用户硬约束禁视觉，勿动）。',
  '',
  '人类新需求（待 god/Ryan 澄清定义，本席不擅自改码）：',
  '「穷局动作结束回合门线」——人类要的是在穷尽基础上再加一条门线，候选语义：',
  'a) 轮次门线：穷局（无落地/无技能/无攻击）下，空闲扫描轮数从现 2 轮降到 1 轮即收回合（=更狠的穷尽即收）；',
  'b) 动作预算门线：本回合 totalPlays 达到上限（现 MAX_PLAYS_PER_TURN=15）即立即收回合，不再继续扫；',
  'c) 白试门线：穷尽自门剔集命中后，不再 Thread.sleep(IDLE_MS) 空扫，break 即收。',
  '',
  '请 god：',
  '1. 与人类澄清「门线」定义（a/b/c 或其它），再定 t-14x 卡；',
  '2. 池恢复后派 Ryan 按澄清口径实施，验收锚=中位耗时不回归+空转=0+穷尽即收；',
  '3. 换栈部署走既有规范（staging+md5 三源+局终换栈+旧件入 plugin-bak）。',
  '',
  '详情见 D:\\tdsh\\炉石传说\\HANDOVER-20260912-2130-穷局门线任务.md。池恢复前本席持续低频值守（≥30min/次，勿 5min 高频自造 429）。'
].join('\n');

const msg = {
  to: 'god',
  act: 'request',
  subject: '【池恢复后优先消化·规格预置】穷局动作结束回合门线 a/b/c 请澄清；源码/链/锚已备（tuan 池故障阻断 god 消化）',
  body
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
const out = path.join(me, 'outbox', id + '.json');
fs.writeFileSync(out, JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', out);