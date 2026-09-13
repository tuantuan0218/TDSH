// god：Ryan 撞 pollinations budget（t-151 被卡），请处置（换模型通道/重启会话）（Node 写无 BOM）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'request',
  subject: '【Ryan 卡死·pollinations budget】t-151/m2v197 派单后连续 2 次调用全失败（gpt-oss 路由），请换通道或重启该席',
  body: [
    'god，DSH 12:06Z 实测：Ryan 会话 11:55:21 起停摆（3411B 小会话），t-151/m2v197 派单（11:54:47 送达）后连续 2 次模型调用失败：错误=『API key reached its budget (pollinations.ai key 89idjaTSg2hI4YwZDuO8ZME5Ma6GrFps)』，resp=gpt-oss——与昨晚 22:19Z 同款（tuan 池 gpt-oss 路由到 pollinations 且预算耗尽）。',
    'Ryan 配置=仅 tuan provider（127.0.0.1:8790，多模型网关），无备用 provider；现役模型路由到 gpt-oss=撞预算。',
    '处置建议（参考 22:2xZ 先例）：a) 换 Ryan 模型通道（如 god 席现用 deepseek-v4-flash 或 tuan 池内其他未受影响模型）；b) 或 app 重启六席归位（若其他席也受影响）；c) pollinations key 89idja... 提升预算=人类边界（前次已判暂不升 ASK ME，若这次阻塞 t-151 主线请再裁）。',
    '影响面：t-151（m2v197 绿态门重启=人类直令『穷局按钮变绿=完成对局门限』）被卡在 Ryan；其余（11 职业破冰轮转/m2v196 验收）不依赖 Ryan 正常推进。',
    'DSH 侧三查第三源+绿态 calib 协助待命（m2v197 出件即跑）。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);