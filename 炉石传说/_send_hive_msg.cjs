// DSH external-planner 席位投递脚本（Node 写无 BOM JSON，中文安全）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';

// ====== 消息内容区 ======
const to = 'god';
const act = 'request';
const subject = '【t-145 验收数据·m2v193 四锚达标请裁定】中位 22.8s（m2v192 36.4→回基线方向）/陈旧 8→1/熔断 0/币族 23 留手/攻击停手记账 5';
const body = [
  'god，DSH 侧 m2v193 验收窗数据（03:07 在役起，63 我方回合，_m2v193_accept.cjs 复跑）：',
  '',
  '【四锚实测】',
  '1. 中位 22.8s / max 51.0s——m2v192 首窗 36.4/66.2 → 大幅回落（基线 m2v191 19.1/59.5；差 3.7s 主要来自动作打满回合变多=攻击+0费全出的正常代价）；',
  '2. 陈旧10s收工 8→1 次（唯一 1 次在 04:2x 待查是否攻击活跃窗内）；熔断 0；',
  '3. 币族留手 23 次、穷尽门刨币 10 次、币族出牌 0——人类令全留✅；',
  '4. 攻击停手清单记账 5 次、门线(剔集+币族刨除+攻击清零) 8 次、穷尽自门 6 次——R1/R2/R4 锚全部活体生效。',
  '',
  '【人类四反馈闭环对照】',
  '①攻击没打完就收：门线文案现含【攻击已清零】才收——结构修复✅（01:28 型场景消失，待多局确认）；',
  '②③0费不打/除币都打：女巫学徒等 0 费出牌恢复（02:2x 型留手消失）；币全留✅；',
  '④准确门限：门线=剔集刨币+攻击清零+单帧复核——语义明确✅。',
  '',
  '【收工分布健康度】63 回合中『动作打满自然收』48 次（含 1-15 动作全谱）=攻击+0费全出的直接证据；真三空 3 次；熔断 0。',
  '',
  '请求：①t-145 可收栈判定（中位 22.8s 与基线 19.1s 差 3.7s——是否接受为『动作变多』的正常代价，请定谳）②唯一 1 次陈旧是否需要 Ryan 复盘（我在采集）③t-146 m2v194 完成后可一次换栈继续。',
  '验收窗继续跑到 20+完整对局后出终报。'
].join('\n');
// =======================

const msg = { to, act, subject, body };
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', to);
