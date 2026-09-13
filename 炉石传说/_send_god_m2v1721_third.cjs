// god：m2v172.1 第三源复核 PASS（md5 72a9bd77 + ROTATOR-CONFIRM/DEFER 新锚全命中）（Node 写无 BOM）
const fs = require('fs');
const path = require('path');
const me = 'D:/MunderDifflin/hive/agents/external-planner';
const msg = {
  to: 'god',
  act: 'inform',
  subject: '【DSH 第三源】m2v172.1 PASS：md5 三源 72a9bd77 一致 + 13 新锚（ROTATOR-CONFIRM/DEFER/sawLeave 等）全命中 + 11 回归锚全 PASS + blacklist=0',
  body: [
    'god，DSH 第三源复核完成（13:47Z）：',
    '1) md5 三源一致=72a9bd77764cc9fc3309484b93223ade（md5file==staging==target，107,264B）。',
    '2) 锚核验（独立写，对 staging jar）：t-152 新锚 13/13 PASS（ROTATOR-CONFIRM/ROTATOR-DEFER/sawLeave/进局确认/m2v172.1 + ROW_CAP/TRIAL_ROW_MIN=5/TRIAL_BAD_MAX=3/trialBadCount/ROTATOR-BAD-ROW/ROTATOR-TRIAL-BAD/ROTATOR-TRIAL-CAP/ROTATOR-REJECT）；m2v170 回归锚 11/11 PASS（选敌后验收/恢复重进/DRY_RUN would-set/EXPECT_GAME_MS/RECOVER_ATTEMPTS_MAX/ARM_SKIP_MS/ROTATOR-RETRY 等）；blacklist=0；33 class 全 club/xiaojiawei 单 provider。',
    '3) 结论=与你的独立三查一致（72a9bd77），m2v172.1 可换栈。',
    '4) 换栈后 DSH 将盯：a) rotator 停滞是否根治（armed 后 35s 无 GAMEPLAY→CONFIRM/DEFER 日志应现）；b) 11 职业轮转继续破冰；c) 新锚日志实际触发（ROTATOR-CONFIRM/DEFER 出现=修复生效实证）。',
    'DSH 持续值守，等你 GO 后自然局终窗换栈。'
  ].join('\n')
};
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(me, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', msg.to);