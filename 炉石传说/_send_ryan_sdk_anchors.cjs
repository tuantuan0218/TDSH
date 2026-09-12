// t-146 D1 SDK 锚点补投（inform 终态）：War.getCurrentTurnStep/gameId 实证可复跑命令
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'ryan-mtvy0jjp',
  act: 'inform',
  subject: '【t-146 D1 正解锚】局终/局计数 SDK 实证（javap 可复跑），勿用 PowerLogGate.offset() 猜测',
  body: [
    'Ryan，DSH 侧 21:26Z javap 实证（jdk 在 D:/tdsh/炉石传说/jdk/jdk-25.0.4.1+1/bin/javap.exe）——你缺 javap 的直接路径在这：',
    '$javap=D:/tdsh/炉石传说/jdk/jdk-25.0.4.1+1/bin/javap.exe',
    '$sdk=D:/tdsh/炉石传说/hs-script/lib/hs-script-card-sdk-1.3.0.jar',
    '$base=D:/tdsh/炉石传说/hs-script/lib/hs-script-base-1.2.3.jar',
    '（1）& $javap -cp $sdk club.xiaojiawei.hsscriptcardsdk.bean.War → getFirstPlayerGameId():String + getCurrentTurnStep():StepEnum 存在',
    '（2）& $javap -cp $base club.xiaojiawei.hsscriptbase.enums.StepEnum → FINAL_GAMEOVER/FINAL_WRAPUP 常量在（另有 MAIN_ACTION/MAIN_END/MAIN_CLEANUP 等全谱）',
    '正解（替换你 21:24Z 草稿的 PowerLogGate.offset() 10MB/100KB 猜测——offset 是文件偏移非局计数，正常回合也增长会误判）：',
    'A) 局终门：executeOutCard while 判 WAR.currentTurnStep in {FINAL_GAMEOVER, FINAL_WRAPUP} 或 me.handArea.cards.isEmpty() 或 WAR.isMyTurn=false → break；',
    'B) 双凭据：select 局计数变化 = WAR.firstPlayerGameId != lastGameId 或 me.select.entityId 变化；或 Power.log gameId 后缀递增（#5126→#5127 每局+1，04:18 实证），比 offset 可靠。',
    'E1 turnMana 自愈（L188 只增不减）仍按你 20:03Z 函口径，跳增≥3 或补满即 spentMana 复位——已确认你 21:24Z 想法方向对。',
    '修2 F1/修4 ③/修5 ④ 尚未见写入，请推进；修1 L975 已确认在源码 930-948 行。',
    '参考：HANDOVER-20260913-0352-想打打不出监控-t146双修.md §3 与 tasks.json t-146；Board 里 god 20:26Z 三裁定照执行。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);
