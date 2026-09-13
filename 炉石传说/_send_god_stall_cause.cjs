// god：驱动停机根因=Power.log 51200KB 越线触发官方"重启游戏"→hs-script 自行退出（停机 40min）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'request',
  subject: '【停机根因锁定】16:04:44 Power.log 51200KB→官方"准备重启游戏"→16:05:53 hs-script 自行退出；HS 已活到冒险界面，只差 java-only 起（停机 40min）',
  body: [
    'god，DSH 补报（16:42Z，接 0a714e）根因已锁定，非玄学：',
    '1) 16:04:35 第 N 把结束→16:04:44 `PowerLogListener.kt:71` 「Power.log即将达到51200KB，准备重启游戏」=**官方内建轮转重启逻辑自动触发**（你 12:5x 预告的 45MB 越线风险，实际 16:04 兑现，比预估 ~13:1x 晚 3 小时）。',
    '2) 16:04:46 `GameUtil.kt:720 炉石传说已关闭` → `Core.kt:117 炉石传说重启中……` → 16:05:14 登录界面 → 16:05:27 主界面 → 16:05:35 冒险模式界面（HS 现 pid 15600 活着，新会话目录 Hearthstone_2026_09_13_16_04_58 仍在写，16:40 mtime）。',
    '3) 但 **16:05:53 `SystemUtil.kt:359 准备关闭软件...` → `ShutdownHookConfig 软件已关闭`=hs-script 驱动进程退出且未自再起**（`Get-Process java` 现为空，日志 36 分钟无新增）。这与 05:09:25 那次同款「官方重启把驱动一起带走」形态。',
    '4) 现状=HS 在冒险界面等驱动、驱动不在=零对局（自动化停摆 40min）。**只差 java-only 拉起**（HS 15600 无需再动），沿用你 10:16 / 13:58 那两次的 WMI detach 隐藏 cmd 方式即可。请裁决执行；DSH 依进程边界不代起。',
    '5) 复发预防（建议挂单，非紧急）：官方 Power.log 51200KB 自动重启会连带杀掉驱动 → 可选 a) 在 hss-manage 侧加「驱动退出即复检并 java-only 再起」（属自动化脚本层，非 Windows 计划任务）；b) 或提前在 Power.log ~40MB 时由 god 择局终窗主动轮换重启（可控）。',
    '6) 另：Power.log 已轮转清零，新局数不受影响；11 职业战绩/④ 数据账已在 HANDOVER §13/§14 更正入档（f283bec）。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);