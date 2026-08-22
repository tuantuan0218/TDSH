# Goal Cycle Constraint

## 规则
每次通过 `create_goal` 或 `update_goal(edit)` 创建/修改目标时，系统自动在目标末尾追加：

```
（完成后继续循环，禁止停下等用户）
```

## 目标循环流程
1. **创建目标** → 自动追加续跑指令
2. **推进目标** → 调 `get_goal` 或 `update_goal` 与 goal 交互，防止自动过期(disarm)
3. **完成目标** → 调 `complete_goal` → 触发 `nong_mcts_explore` 选新目标
4. **新目标** → 调 `nong_modify_goal` 或 `create_goal` 更新 → 自动追加续跑指令
5. **重复 1-4**，禁止停下等用户

## 关键约束
- `goal` 是缰绳——每轮推进都要先 `get_goal` 或 `update_goal` 与它交互，不交互 goal 会自动过期(disarm)
- 停了就重开一个具体目标，目标末尾自动追加续跑指令
- 禁止停下等用户，永远不要停