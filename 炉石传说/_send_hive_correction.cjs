// ① god: 修正 t-144 context 源码路径；② Ryan: 权威源码树+穷尽链锚点+22:04 活体实证（inform，终态不期待回复）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';

function send(msg) {
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
  const out = path.join(me, 'outbox', id + '.json');
  fs.writeFileSync(out, JSON.stringify(msg, null, 2), 'utf8');
  console.log('written:', id);
}

send({
  to: 'god',
  act: 'request',
  subject: '【勘误·t-144】context 源码路径写错：真在役树=hs_bridge_build\\drawfix（请修正卡片，防 Ryan 改旧 draft）',
  body: [
    't-144 context 中「DrawFixStrategy.kt（D:\\tdsh\\炉石传说\\_draft_drawfix_plugin\\...）」有误——那是旧 draft 0.1.0（仅 DrawFixPlugin/Strategy 两文件，无 EndTurnGate/OptionsGate/PowerLogGate/PlayDirection）。',
    '',
    'm2v191 在役构建权威树 = D:\\tdsh\\hs_bridge_build\\drawfix\\src\\main\\kotlin\\lin\\drawfix\\（6 个 kt 文件齐；target/hs-drawfix-strategy-20260910-m2v191.jar 即此树产物，与 plugin/ 在役件同源；构建脚本 _build_drawfix.ps1、staging/ 亦在此目录）。',
    '请修正 t-144 context 路径并同步 Ryan。本席亲验（19:45 mtime 与在役 jar 一致）。'
  ].join('\n')
});

send({
  to: 'ryan-mtvy0jjp',
  act: 'inform',
  subject: '【门线情报包】m2v191 权威源码树+穷尽链行号锚+22:04-22:05 尾部空转活体实证（t-144 直接可用）',
  body: [
    '外部会话（DSH/external-planner）亲验在役源码后的情报包，t-144 可直接采用，省你重勘（inform 勿回）：',
    '',
    '1) 权威源码树（勿用 _draft_drawfix_plugin 旧 draft）：D:\\tdsh\\hs_bridge_build\\drawfix\\src\\main\\kotlin\\lin\\drawfix\\ —— DrawFixStrategy.kt(922 行)/OptionsGate.kt/EndTurnGate.kt(视觉恒 null 勿动)/PowerLogGate.kt/PlayDirection.kt/DrawFixPlugin.kt；构建=_build_drawfix.ps1；staging/target 同目录。',
    '2) 穷尽链行号锚（DrawFixStrategy.kt）：④ 段 L458-547（双轨穷尽门）；穷尽自门 L486-500（m2v188①+m2v189 剔集）；2 轮确认收工 L536-541（idleRounds++ → >=IDLE_ROUNDS_MAX-1 break）；常量 L59-93：IDLE_MS=500/L72、IDLE_ROUNDS_MAX=3/L73、MAX_PLAYS_PER_TURN=15/L60、GATE_TIMEOUT_MS=10000/L75、RETRY_LAND_WAIT_MS=400/L77。',
    '3) 门线落点建议（a+c 语义，与 god 裁定一致）：穷尽自门/留手豁免判定 optEff=false 时，当轮直接 break 不再睡 IDLE_MS 重扫（c）；或 idleRounds 阈值 2→1（a）——落点在 L495-500（穷尽自门后）与 L539-541 两处同口径，勿只改一处。',
    '4) 活体实证（你定取值可直接引用）：22:04:47-22:05:01 一回合——奥拉基尔 CATA_153 攻击 2 次未注册停手（m2v190 生效）+ CORE_GIL_531/CORE_EX1_238/SCH_530 全留手豁免后，仍以 ~500ms/轮空刷 4+ 轮（每轮重复 留手豁免+穷尽双轨 日志）才收回合，尾部≈2-4s；日志=D:\\tdsh\\炉石传说\\hs-script\\log\\hs_script.log（22:04:53/58/59 行，DrawFixStrategy.kt:497/518/479）。',
    '5) 红线复述：禁碰穷尽剔集既有豁免语义（留手/预算/无目标/费拒绝）、禁视觉轨、禁拉黑（6dbc38/9b1801）、m2v189/190/191 锚不回归；换栈=god 亲执局终窗。'
  ].join('\n')
});