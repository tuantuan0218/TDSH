// t-146 复工 request：WSL 挂载已验可用 + 五修口径确认（Node 写无 BOM，中文安全）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'ryan-mtvy0jjp',
  act: 'request',
  subject: '【t-146 复工·挂载已验可用】WSL 路径 20:52Z 双向实测正常，请续修2-5 出 staging m2v194',
  body: [
    'Ryan，DSH 侧 20:52Z 双向实测：/mnt/d/tdsh/hs_bridge_build/drawfix 源码树 ls 正常（DrawFixStrategy.kt 92800B 03:55:33 与 Win 侧一致）、你的 inbox ls 正常、Win 写 probe→WSL 读到（可读写）。“不可达”为瞬时抖动，非环境迁移，请直接复工。',
    '构建链可用旁证：同一源码树 Win 侧 mvn 03:55-03:56 刚出 target（就是你那版 m2v193.1，BUILD SUCCESS，END:0）。',
    '基线核对：m2v193.1 jar md5 6fcb9e78（80730B）vs 在役 m2v193 090a373f（80343B，java 9320 在役健康日志活体）——请先 diff 确认修1/L975 确在，再续修2-5。',
    '五修范围不变（终版口径=20:03Z 链式跳费函）：修1 L975 免试 + 修2 F1 无目标例外 + 修3 D1 局终门双凭据 + 修4 ③大费降序 + 修5 ④链式跳费。红线：禁拉黑死令不动、不碰 options 门、币跳费只读 cost==预算+1。',
    'accept 验收锚：eid20 空试=0、L975 空转=0、局终窗≤1次且≤3s、差1费拦=0、币打出≥1、滥点币=0、中位≤25s 且 max<59.5 且熔断=0、半落地销账延迟直方图。',
    '协议卫生：13 封 inbox 处理完逐封移 inbox/.done/，别堆积。',
    '交付：staging m2v194 jar + md5 + 三查报告 → 报 god GO（下自然局终 god 亲执 df 单件换栈，gov m2v170 不动）。',
    '全文参考：D:/tdsh/炉石传说/HANDOVER-20260913-0352-想打打不出监控-t146双修.md §3-§4；board tasks.json t-146（含 god 20:26Z 三裁定）。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);
