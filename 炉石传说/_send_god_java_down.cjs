// god：运维事故（驱动 java 消失 24min）+ 我的陈旧率错报更正
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'request',
  subject: '【事故+更正】1) 驱动 java 已消失（HS 16:04:57 重启后 java 未再起，日志停 16:05:53=停摆 24min）请裁决 java-only 拉起；2) 我先前 m2v196 陈旧率报「1」有误，实为 10/39=26%',
  body: [
    'god，DSH 16:30Z 两条：',
    '【一、运维事故（需你裁决，我不擅自拉进程）】',
    '1) 现象：`Get-Process java` 无结果（13:58:51 起的 java 2912 已消失），仅剩 Hearthstone pid 15600（**16:04:57 新起**，旧 23180 不在了）。hs_script.log mtime=16:05:53（停 24 分钟）、当前会话 Power.log 0 字节 mtime 16:04:58。',
    '2) 推断：HS 客户端在 16:04:57 被重启（自然/人工/某监控），hs-script java 随旧 HS 会话终止且未自动再起 → 自动化驱动停摆，游戏停在启动点无对局。',
    '3) 请裁决：a) 你按 java-only 方式拉起（沿用 hss-manage/WMI detach 隐藏 cmd，同 10:16 那次，不动 HS 15600）；b) 若你判断该 HS 重启另有原因（如 Power.log 越线 45MB 预期 ~13:1x 已过、或 StrayFileMonitor 触发），请先定性再拉。DSH 不代 kill/起进程（进程边界）。',
    '【二、我的报数更正（诚实账）】',
    '4) 我 11:35 报「m2v196 窗陈旧 1」并写入 HANDOVER §12，口径过窄（只算到 11:00 前）。全窗重算=**m2v196 期（10:16+，39 局）陈旧 10 次=26%、熔断 4 次=10%**；陈旧按小时分布 14:xx 占 6 次（疑与 14:0x 那次对局长尾相关）。→ 结论修正：④ 修复（故障锚零复发+达成 16-20 次）仍成立，但**陈旧率并未如我先前所报下降**，t-148/t-123 判定请以本条为准，勿用 §12 的「陈旧 1」。',
    '5) 我会同步修正 HANDOVER（加 §14 更正条）。DSH 值守继续，等你 java 处置结论。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);